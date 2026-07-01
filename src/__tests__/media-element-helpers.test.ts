// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	attachHlsOrFallback,
	destroyHlsInstance,
	isHls,
	supportsNativeHls,
} from '../adapters/media-element/helpers';

/**
 * These HLS helpers moved into core from the per-package backends. The music
 * package's deleted coverage-fill suite used to exercise them; core owns them
 * now, so the behavioural coverage lives here.
 */

interface FakeHlsConfig {
	autoStartLoad?: boolean;
	[key: string]: unknown;
}

function makeHlsModule(supported: boolean): {
	module: unknown;
	created: Array<{ cfg: FakeHlsConfig; attached: HTMLMediaElement | null; loaded: string | null }>;
} {
	const created: Array<{ cfg: FakeHlsConfig; attached: HTMLMediaElement | null; loaded: string | null }> = [];

	class FakeHls {
		static isSupported(): boolean {
			return supported;
		}

		record: { cfg: FakeHlsConfig; attached: HTMLMediaElement | null; loaded: string | null };

		constructor(cfg: FakeHlsConfig) {
			this.record = { cfg, attached: null, loaded: null };
			created.push(this.record);
		}

		attachMedia(el: HTMLMediaElement): void {
			this.record.attached = el;
		}

		loadSource(url: string): void {
			this.record.loaded = url;
		}

		destroy(): void {}
		stopLoad(): void {}
		startLoad(): void {}
	}

	return { module: FakeHls, created };
}

describe('isHls', () => {
	it('matches .m3u8 URLs, including with a query string, case-insensitively', () => {
		expect(isHls('https://x/stream.m3u8')).toBe(true);
		expect(isHls('https://x/stream.m3u8?token=abc')).toBe(true);
		expect(isHls('https://x/STREAM.M3U8')).toBe(true);
	});

	it('rejects non-HLS URLs', () => {
		expect(isHls('https://x/movie.mp4')).toBe(false);
		expect(isHls('https://x/song.mp3')).toBe(false);
		expect(isHls('https://x/m3u8-in-the-path/file.ts')).toBe(false);
	});
});

describe('supportsNativeHls', () => {
	const original = Object.getOwnPropertyDescriptor(globalThis, 'MediaSource');

	afterEach(() => {
		if (original) {
			Object.defineProperty(globalThis, 'MediaSource', original);
		}
		else {
			delete (globalThis as { MediaSource?: unknown }).MediaSource;
		}
	});

	function elementReporting(answer: CanPlayTypeResult): HTMLMediaElement {
		const el = document.createElement('audio');
		el.canPlayType = (): CanPlayTypeResult => answer;
		return el;
	}

	it('trusts "probably" regardless of MSE', () => {
		(globalThis as { MediaSource?: unknown }).MediaSource = class {};
		expect(supportsNativeHls(elementReporting('probably'))).toBe(true);
	});

	it('trusts "maybe" only when MSE is absent (iOS Safari)', () => {
		delete (globalThis as { MediaSource?: unknown }).MediaSource;
		expect(supportsNativeHls(elementReporting('maybe'))).toBe(true);
	});

	it('rejects "maybe" when MSE is present (Chromium lies)', () => {
		(globalThis as { MediaSource?: unknown }).MediaSource = class {};
		expect(supportsNativeHls(elementReporting('maybe'))).toBe(false);
	});

	it('rejects an empty answer', () => {
		delete (globalThis as { MediaSource?: unknown }).MediaSource;
		expect(supportsNativeHls(elementReporting(''))).toBe(false);
	});
});

describe('attachHlsOrFallback', () => {
	it('wires hls.js when supported and returns the instance', () => {
		const { module, created } = makeHlsModule(true);
		const el = document.createElement('audio');
		const config: FakeHlsConfig = { autoStartLoad: false };

		const handle = attachHlsOrFallback(module, el, 'https://x/live.m3u8', undefined, config);

		expect(handle).toBeDefined();
		expect(created).toHaveLength(1);
		expect(created[0]!.cfg).toBe(config);
		expect(created[0]!.attached).toBe(el);
		expect(created[0]!.loaded).toBe('https://x/live.m3u8');
	});

	it('falls back to el.src with the auth token appended when hls.js is unsupported', () => {
		const { module, created } = makeHlsModule(false);
		const el = document.createElement('audio');
		el.load = vi.fn();

		const handle = attachHlsOrFallback(module, el, 'https://x/live.m3u8', 'Bearer tok-42', {});

		expect(handle).toBeUndefined();
		expect(created).toHaveLength(0);
		expect(el.src).toBe('https://x/live.m3u8?access_token=tok-42');
		expect(el.load).toHaveBeenCalledTimes(1);
	});
});

describe('destroyHlsInstance', () => {
	it('detaches then destroys', () => {
		const order: string[] = [];
		const hls = {
			detachMedia: vi.fn(() => order.push('detach')),
			destroy: vi.fn(() => order.push('destroy')),
			stopLoad: vi.fn(),
			startLoad: vi.fn(),
		};

		destroyHlsInstance(hls);

		expect(order).toEqual(['detach', 'destroy']);
	});

	it('still destroys when detachMedia throws, and swallows a throwing destroy', () => {
		const destroy = vi.fn();
		const throwingDetach = {
			detachMedia: vi.fn(() => {
				throw new Error('detach boom');
			}),
			destroy,
			stopLoad: vi.fn(),
			startLoad: vi.fn(),
		};

		expect(() => destroyHlsInstance(throwingDetach)).not.toThrow();
		expect(destroy).toHaveBeenCalledTimes(1);

		const throwingDestroy = {
			destroy: vi.fn(() => {
				throw new Error('destroy boom');
			}),
			stopLoad: vi.fn(),
			startLoad: vi.fn(),
		};

		expect(() => destroyHlsInstance(throwingDestroy)).not.toThrow();
	});
});
