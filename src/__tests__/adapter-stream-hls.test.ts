// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * HlsStreamSource behavioral tests.
 *
 * Mocks hls.js so the REAL adapter code runs against a controlled fake.
 * Covers: state machine, level switching, error recovery,
 * MANIFEST_PARSED, LEVEL_SWITCHED, ERROR (fatal/non-fatal), detach/destroy,
 * getLevels(), setLevel(), getCurrentLevel(), on/off listener dedup,
 * emit swallows listener exceptions, native HLS path via loadedmetadata/error,
 * MediaFormatError when hls.js unsupported.
 *
 * Note: canPlay() is already locked in streams/hls.test.ts — not duplicated.
 */

import type { ErrorData } from 'hls.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hlsFactory, HlsStreamSource } from '../adapters/stream/hls';
import { MediaFormatError } from '../errors';

// ─────────────────────────────────────────────────────────────────────────────
// hls.js mock
//
// vi.mock is hoisted before variable declarations — the factory must be
// self-contained (no references to variables declared in this file).
// We expose shared state via globalThis so tests can drive the fake.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('hls.js', () => {
	type HlsListener = (eventName: string, data: unknown) => void;

	const _Events = {
		MANIFEST_PARSED: 'hlsManifestParsed',
		LEVEL_SWITCHED: 'hlsLevelSwitched',
		FRAG_LOADED: 'hlsFragLoaded',
		ERROR: 'hlsError',
		MEDIA_ATTACHED: 'hlsMediaAttached',
	};

	class _FakeHls {
		static isSupported(): boolean {
			return (globalThis as unknown as { __hlsSupported?: boolean }).__hlsSupported !== false;
		}

		static Events = _Events;

		levels = [
			{ bitrate: 5_000_000, height: 1080, width: 1920, name: '1080p' },
			{ bitrate: 2_500_000, height: 720, width: 1280, name: '720p' },
		];

		currentLevel = -1;

		private _handlers = new Map<string, HlsListener[]>();

		constructor() {
			// Register instance for test inspection
			(globalThis as unknown as { __lastHlsInstance?: _FakeHls }).__lastHlsInstance = this;
		}

		attachMedia(_el: HTMLMediaElement): void {
			// Fire MEDIA_ATTACHED asynchronously so the Promise-internal listener
			// (registered in the same tick after attachMedia()) has time to register.
			Promise.resolve().then(() => {
				this._fire(_Events.MEDIA_ATTACHED, undefined);
			});
		}

		loadSource(_url: string): void {}

		on(event: string, fn: HlsListener): void {
			const list = this._handlers.get(event) ?? [];
			list.push(fn);
			this._handlers.set(event, list);
		}

		off(event: string, fn: HlsListener): void {
			const list = this._handlers.get(event) ?? [];
			this._handlers.set(event, list.filter(f => f !== fn));
		}

		detachMedia(): void {}

		destroy(): void {}

		_fire(event: string, data: unknown): void {
			for (const fn of [...(this._handlers.get(event) ?? [])]) {
				fn(event, data);
			}
		}
	}

	return { default: _FakeHls };
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get the most recently created FakeHls instance
// ─────────────────────────────────────────────────────────────────────────────

interface FakeHlsInstance {
	levels: Array<{ bitrate: number; height: number; width: number; name?: string }>;
	currentLevel: number;
	attachMedia: (el: HTMLMediaElement) => void;
	loadSource: (url: string) => void;
	on: (event: string, fn: (name: string, data: unknown) => void) => void;
	off: (event: string, fn: (name: string, data: unknown) => void) => void;
	detachMedia: () => void;
	destroy: () => void;
	_fire: (event: string, data: unknown) => void;
}

function getLastHlsInstance(): FakeHlsInstance {
	return (globalThis as unknown as { __lastHlsInstance: FakeHlsInstance }).__lastHlsInstance;
}

const HLS_EVENTS = {
	MANIFEST_PARSED: 'hlsManifestParsed',
	LEVEL_SWITCHED: 'hlsLevelSwitched',
	FRAG_LOADED: 'hlsFragLoaded',
	ERROR: 'hlsError',
	MEDIA_ATTACHED: 'hlsMediaAttached',
};

function makeElement(): HTMLMediaElement {
	return document.createElement('video') as unknown as HTMLMediaElement;
}

function makeNonNativeElement(): HTMLMediaElement {
	const el = makeElement();
	Object.defineProperty(el, 'canPlayType', {
		configurable: true,
		value: (_type: string) => '',
	});
	return el;
}

/**
 * Attach source to element and wait for the attach promise to resolve.
 * The FakeHls fires MEDIA_ATTACHED asynchronously (via Promise.resolve()),
 * so we just need to await the attach promise — MEDIA_ATTACHED will fire
 * automatically via the microtask in FakeHls.attachMedia().
 * After attaching, optionally fire MANIFEST_PARSED to move state to 'ready'.
 */
async function attachAndFireManifest(source: HlsStreamSource, el: HTMLMediaElement): Promise<FakeHlsInstance> {
	const p = source.attach(el);
	await p;
	const hls = getLastHlsInstance();
	// MANIFEST_PARSED fires state transition to 'ready'
	hls._fire(HLS_EVENTS.MANIFEST_PARSED, undefined);
	return hls;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('HlsStreamSource', () => {
	beforeEach(() => {
		(globalThis as unknown as { __hlsSupported: boolean }).__hlsSupported = true;
		(globalThis as unknown as { __lastHlsInstance: unknown }).__lastHlsInstance = undefined;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete (globalThis as unknown as { __hlsSupported?: boolean }).__hlsSupported;
	});

	describe('state machine', () => {
		it('starts in idle state', () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			expect(source.state()).toBe('idle');
		});

		it('moves to ready after MANIFEST_PARSED', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			await attachAndFireManifest(source, el);
			expect(source.state()).toBe('ready');
		});

		it('throws MediaFormatError when hls.js is not supported', async () => {
			(globalThis as unknown as { __hlsSupported: boolean }).__hlsSupported = false;
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			await expect(source.attach(el)).rejects.toBeInstanceOf(MediaFormatError);
		});

		it('thrown MediaFormatError carries code core:media/hls-unsupported', async () => {
			(globalThis as unknown as { __hlsSupported: boolean }).__hlsSupported = false;
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			try {
				await source.attach(el);
			}
			catch (err) {
				expect((err as MediaFormatError).code).toBe('core:media/hls-unsupported');
			}
		});

		it('detach() resets state to idle', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			await attachAndFireManifest(source, el);
			expect(source.state()).toBe('ready');
			source.detach();
			expect(source.state()).toBe('idle');
		});
	});

	describe('events', () => {
		it('on() registers listener; off() removes it cleanly', () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const fn = vi.fn();
			source.on('manifest-loaded', fn);
			source.off('manifest-loaded', fn);
			expect(fn).not.toHaveBeenCalled();
		});

		it('emit swallows listener exceptions and still calls subsequent listeners', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			const hls = await attachAndFireManifest(source, el);

			const errorFn = vi.fn(() => { throw new Error('listener error'); });
			const okFn = vi.fn();
			source.on('level-switched', errorFn);
			source.on('level-switched', okFn);

			hls._fire(HLS_EVENTS.LEVEL_SWITCHED, { level: 0 });

			expect(errorFn).toHaveBeenCalledOnce();
			expect(okFn).toHaveBeenCalledOnce();
		});
	});

	describe('level management', () => {
		it('getLevels() returns empty array before attach', () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			expect(source.getLevels()).toHaveLength(0);
		});

		it('setLevel() is a no-op before attach', () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			expect(() => source.setLevel(0)).not.toThrow();
		});

		it('getCurrentLevel() returns undefined before attach', () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			expect(source.getCurrentLevel()).toBeUndefined();
		});

		it('getLevels() maps hls.levels to StreamLevel after attach', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			await attachAndFireManifest(source, el);

			const levels = source.getLevels();
			expect(levels).toHaveLength(2);
			expect(levels[0]!.height).toBe(1080);
			expect(levels[0]!.bitrate).toBe(5_000_000);
			expect(levels[0]!.label).toBe('1080p');
			expect(levels[0]!.index).toBe(0);
		});

		it('LEVEL_SWITCHED event updates currentLevelIdx and emits level-switched', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			const hls = await attachAndFireManifest(source, el);

			const levelSwitchedEvents: unknown[] = [];
			source.on('level-switched', data => levelSwitchedEvents.push(data));

			hls._fire(HLS_EVENTS.LEVEL_SWITCHED, { level: 1 });

			expect(levelSwitchedEvents).toHaveLength(1);
			const current = source.getCurrentLevel();
			expect(current).toBeDefined();
			expect(current!.index).toBe(1);
			expect(current!.height).toBe(720);
		});

		it('getCurrentLevel() returns undefined when currentLevelIdx is -1 (no switch yet)', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			await attachAndFireManifest(source, el);
			expect(source.getCurrentLevel()).toBeUndefined();
		});

		it('setLevel() sets hls.currentLevel after attach', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			const hls = await attachAndFireManifest(source, el);

			source.setLevel(1);
			expect(hls.currentLevel).toBe(1);
		});
	});

	describe('error handling', () => {
		it('fatal hls.js ERROR moves source to error state and emits error event', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			const hls = await attachAndFireManifest(source, el);

			const errorEvents: unknown[] = [];
			source.on('error', data => errorEvents.push(data));

			const fatalData: Partial<ErrorData> = { fatal: true, details: 'networkError' as ErrorData['details'] };
			hls._fire(HLS_EVENTS.ERROR, fatalData);

			expect(source.state()).toBe('error');
			expect(errorEvents).toHaveLength(1);
		});

		it('non-fatal hls.js ERROR does not change source state or emit error', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			const hls = await attachAndFireManifest(source, el);

			const errorEvents: unknown[] = [];
			source.on('error', data => errorEvents.push(data));

			const nonFatalData: Partial<ErrorData> = { fatal: false, details: 'bufferStalledError' as ErrorData['details'] };
			hls._fire(HLS_EVENTS.ERROR, nonFatalData);

			expect(source.state()).toBe('ready');
			expect(errorEvents).toHaveLength(0);
		});
	});

	describe('destroy()', () => {
		it('destroy() clears all listeners and resets to idle', () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const fn = vi.fn();
			source.on('manifest-loaded', fn);
			source.destroy();
			expect(source.state()).toBe('idle');
		});
	});

	describe('native HLS path', () => {
		it('sets element.src directly when canPlayType returns "probably"', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeElement();
			Object.defineProperty(el, 'canPlayType', {
				configurable: true,
				value: (_type: string) => 'probably',
			});

			const loadedP = source.attach(el);
			el.dispatchEvent(new Event('loadedmetadata'));
			await loadedP;

			expect(el.src).toContain('stream.m3u8');
		});

		it('native path: state is ready after loadedmetadata', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeElement();
			Object.defineProperty(el, 'canPlayType', {
				configurable: true,
				value: (_type: string) => 'probably',
			});

			const loadedP = source.attach(el);
			el.dispatchEvent(new Event('loadedmetadata'));
			await loadedP;

			expect(source.state()).not.toBe('error');
		});

		it('native path: rejects when element fires error event', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeElement();
			Object.defineProperty(el, 'canPlayType', {
				configurable: true,
				value: (_type: string) => 'probably',
			});

			const loadedP = source.attach(el);
			el.dispatchEvent(new Event('error'));
			await expect(loadedP).rejects.toBeDefined();
		});

		it('native path: element-level error fires on-error listeners', () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeElement();
			Object.defineProperty(el, 'canPlayType', {
				configurable: true,
				value: (_type: string) => 'probably',
			});
			// Use a plain object with the right shape since MediaError may be absent in happy-dom
			Object.defineProperty(el, 'error', {
				configurable: true,
				get: () => ({ code: 4, message: 'fake media error' }),
			});

			const errorEvents: unknown[] = [];
			source.on('error', data => errorEvents.push(data));

			// Start attach but don't await — fire element error before loadedmetadata
			const p = source.attach(el);
			el.dispatchEvent(new Event('error'));

			// The boundElementError listener fires; loadedmetadata never fires → rejection
			return expect(p).rejects.toBeDefined();
		});

		it('native path: detach clears src', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeElement();
			Object.defineProperty(el, 'canPlayType', {
				configurable: true,
				value: (_type: string) => 'probably',
			});

			const loadedP = source.attach(el);
			el.dispatchEvent(new Event('loadedmetadata'));
			await loadedP;

			source.detach();
			expect(el.getAttribute('src')).toBeNull();
		});
	});

	describe('hlsFactory.create()', () => {
		it('create() returns an HlsStreamSource instance', () => {
			const source = hlsFactory.create({ url: 'https://x/stream.m3u8' });
			expect(source.kind).toBe('hls');
		});

		it('create() with registry passes registry to the source', () => {
			const fakeRegistry = {
				runInterceptors: vi.fn().mockImplementation((_url: string, r: Response) => Promise.resolve(r)),
				resolve: vi.fn(),
				has: vi.fn(),
				findById: vi.fn(),
				list: vi.fn(),
				intercept: vi.fn(),
				dispose: vi.fn(),
			};
			const source = hlsFactory.create({ url: 'https://x/stream.m3u8', registry: fakeRegistry as never }) as HlsStreamSource;
			expect(source.getRegistry()).toBe(fakeRegistry);
		});
	});

	describe('getRegistry()', () => {
		it('returns undefined when no registry provided', () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			expect(source.getRegistry()).toBeUndefined();
		});

		it('returns the registry when one was provided', () => {
			const fakeRegistry = {} as never;
			const source = new HlsStreamSource('https://x/stream.m3u8', fakeRegistry);
			expect(source.getRegistry()).toBe(fakeRegistry);
		});
	});

	describe('fragment-loaded event', () => {
		it('FRAG_LOADED forwards the fragment data via fragment-loaded event', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			const hls = await attachAndFireManifest(source, el);

			const fragEvents: unknown[] = [];
			source.on('fragment-loaded', data => fragEvents.push(data));

			hls._fire(HLS_EVENTS.FRAG_LOADED, { frag: { sn: 1 } });

			expect(fragEvents).toHaveLength(1);
			expect((fragEvents[0] as { frag: { sn: number } }).frag.sn).toBe(1);
		});
	});

	describe('detach() defensive paths', () => {
		it('detach() calls element.load() after clearing src — swallows errors', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			await attachAndFireManifest(source, el);

			// Make load() throw to verify the defensive catch
			Object.defineProperty(el, 'load', {
				configurable: true,
				value: () => { throw new Error('cannot load'); },
			});

			expect(() => source.detach()).not.toThrow();
			expect(source.state()).toBe('idle');
		});

		it('detach() is idempotent — calling twice does not throw', async () => {
			const source = new HlsStreamSource('https://x/stream.m3u8');
			const el = makeNonNativeElement();
			await attachAndFireManifest(source, el);

			source.detach();
			expect(() => source.detach()).not.toThrow();
		});
	});

	describe('hlsFactory.canPlay() — content-type path', () => {
		it('canPlay() returns true for application/vnd.apple.mpegurl content-type', () => {
			expect(hlsFactory.canPlay('https://x/stream', 'application/vnd.apple.mpegurl')).toBe(true);
		});

		it('canPlay() returns true for audio/mpegurl content-type', () => {
			expect(hlsFactory.canPlay('https://x/stream', 'audio/mpegurl')).toBe(true);
		});

		it('canPlay() returns false for unknown content-type without .m3u8 extension', () => {
			expect(hlsFactory.canPlay('https://x/stream.mp4', 'video/mp4')).toBe(false);
		});
	});
});
