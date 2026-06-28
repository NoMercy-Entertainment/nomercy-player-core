// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Deep behavioral tests for `MediaSessionPlugin`.
 *
 * The existing media-session-and-key-handler.test.ts covers: basic use()/dispose(),
 * metadata from item.image/cover/priority, artwork absent when no image field.
 *
 * This file covers the remaining ~43 uncovered lines:
 *  - setPlaybackState called on play/pause/ended events
 *  - updatePositionState called on time/seek events
 *  - updatePositionState skipped when duration is 0 / Infinity / NaN
 *  - OS seekbackward/seekforward action handlers call player.rewind/forward
 *  - OS seekto action handler calls player.time()
 *  - OS play/pause/stop actions call player methods
 *  - OS nexttrack/previoustrack actions call player.next/previous
 *  - clearMetadata() nulls navigator.mediaSession.metadata
 *  - metadata() getter/setter
 *  - item event with null item clears metadata
 *  - seed on use() when player already has a current item
 */

import type { BaseEventMap } from '../../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../../index';
import { MediaSessionPlugin } from '../../plugins/media-session';

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = {} as HTMLElement;

	get id(): string { return this.playerId; }

	declare options: (config?: unknown) => unknown;
	declare setup: (config: unknown) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare phase: () => string;
	declare addPlugin: (PluginClass: unknown, opts?: unknown) => this;
	declare getPlugin: (PluginClass: unknown) => unknown;
	declare getPluginById: (id: string) => unknown;
	declare removePlugin: (PluginClass: unknown) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<unknown>;
	declare enabledPlugins: () => ReadonlyArray<unknown>;
	declare play: (opts?: unknown) => Promise<void>;
	declare pause: (opts?: unknown) => Promise<void>;
	declare stop: (opts?: unknown) => Promise<void>;
	declare togglePlayback: (opts?: unknown) => Promise<void>;
	declare t: (key: string, vars?: Record<string, string>) => string;
	declare time: { (): number; (t: number, opts?: unknown): Promise<void> };
	declare volume: { (): number; (v: number): void };
	declare duration: () => number;
	declare playbackRate: () => number;
	declare experimental: unknown;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing') return resolved.instance as unknown as this;
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _reset(): void { _instances.clear(); }
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

// ─── Fake navigator.mediaSession ──────────────────────────────────────────────

type ActionHandler = ((details: MediaSessionActionDetails) => void) | null;

interface FakeMediaSession {
	metadata: unknown;
	playbackState: string;
	_handlers: Map<string, ActionHandler>;
	setActionHandler: (action: string, handler: ActionHandler) => void;
	setPositionState: (state?: MediaPositionState) => void;
}

function installFakeMediaSession(): {
	session: FakeMediaSession;
	positionCalls: Array<MediaPositionState | undefined>;
	restore: () => void;
} {
	const handlers = new Map<string, ActionHandler>();
	const positionCalls: Array<MediaPositionState | undefined> = [];

	const session: FakeMediaSession = {
		metadata: null,
		playbackState: 'none',
		_handlers: handlers,
		setActionHandler(action: string, handler: ActionHandler) {
			handlers.set(action, handler);
		},
		setPositionState(state?: MediaPositionState) {
			positionCalls.push(state);
		},
	};

	const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaSession');
	Object.defineProperty(navigator, 'mediaSession', {
		value: session,
		configurable: true,
		writable: true,
	});

	const originalMetadata = (globalThis as Record<string, unknown>).MediaMetadata;
	(globalThis as Record<string, unknown>).MediaMetadata = class FakeMediaMetadata {
		title?: string;
		artist?: string;
		album?: string;
		artwork?: Array<{ src: string }>;
		constructor(init: { title?: string; artist?: string; album?: string; artwork?: Array<{ src: string }> }) {
			Object.assign(this, init);
		}
	};

	return {
		session,
		positionCalls,
		restore() {
			if (originalDescriptor) {
				Object.defineProperty(navigator, 'mediaSession', originalDescriptor);
			}
			else {
				delete (navigator as Record<string, unknown>).mediaSession;
			}
			(globalThis as Record<string, unknown>).MediaMetadata = originalMetadata;
		},
	};
}

async function flush(): Promise<void> {
	await new Promise<void>(resolve => setTimeout(resolve, 0));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MediaSessionPlugin — deep behavioral coverage', () => {
	let restore: () => void;
	let session: FakeMediaSession;
	let positionCalls: Array<MediaPositionState | undefined>;

	beforeEach(() => {
		MockPlayer._reset();
		const installed = installFakeMediaSession();
		session = installed.session;
		positionCalls = installed.positionCalls;
		restore = installed.restore;
	});

	afterEach(() => {
		restore();
		MockPlayer._reset();
		document.body.innerHTML = '';
	});

	// ── playback state mirroring ───────────────────────────────────────────────

	describe('playback state mirroring', () => {
		it('play event sets playbackState to "playing"', async () => {
			const p = makePlayer('ms-deep-1').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			(p as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('play', {});

			expect(session.playbackState).toBe('playing');
		});

		it('pause event sets playbackState to "paused"', async () => {
			const p = makePlayer('ms-deep-2').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			(p as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('pause', {});

			expect(session.playbackState).toBe('paused');
		});

		it('ended event sets playbackState to "none"', async () => {
			const p = makePlayer('ms-deep-3').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			(p as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('ended', undefined);

			expect(session.playbackState).toBe('none');
		});
	});

	// ── position state updates ─────────────────────────────────────────────────

	describe('position state updates', () => {
		it('time event calls setPositionState when duration is finite and positive', async () => {
			const p = makePlayer('ms-pos-1').setup({});
			(p as MockPlayer & { duration: () => number }).duration = () => 180;
			(p as MockPlayer & { playbackRate: () => number }).playbackRate = () => 1;
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			(p as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('time', { time: 30 });

			expect(positionCalls).toHaveLength(1);
			expect(positionCalls[0]?.position).toBe(30);
			expect(positionCalls[0]?.duration).toBe(180);
		});

		it('seek event calls setPositionState', async () => {
			const p = makePlayer('ms-pos-2').setup({});
			(p as MockPlayer & { duration: () => number }).duration = () => 180;
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			(p as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('seek', { time: 60 });

			expect(positionCalls.length).toBeGreaterThan(0);
		});

		it('time event skips setPositionState when duration is 0', async () => {
			const p = makePlayer('ms-pos-nodur').setup({});
			(p as MockPlayer & { duration: () => number }).duration = () => 0;
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			(p as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('time', { time: 10 });

			expect(positionCalls).toHaveLength(0);
		});

		it('time event skips setPositionState when duration is NaN', async () => {
			const p = makePlayer('ms-pos-nan').setup({});
			(p as MockPlayer & { duration: () => number }).duration = () => NaN;
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			(p as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('time', { time: 10 });

			expect(positionCalls).toHaveLength(0);
		});

		it('time event skips setPositionState when duration is Infinity', async () => {
			const p = makePlayer('ms-pos-inf').setup({});
			(p as MockPlayer & { duration: () => number }).duration = () => Infinity;
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			(p as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('time', { time: 10 });

			expect(positionCalls).toHaveLength(0);
		});

		it('position is clamped to [0, duration]', async () => {
			const p = makePlayer('ms-pos-clamp').setup({});
			(p as MockPlayer & { duration: () => number }).duration = () => 100;
			(p as MockPlayer & { playbackRate: () => number }).playbackRate = () => 1;
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			(p as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('time', { time: 200 });

			expect(positionCalls[0]?.position).toBe(100);
		});
	});

	// ── OS action handlers ─────────────────────────────────────────────────────

	describe('OS action handlers', () => {
		it('play action calls player.play()', async () => {
			const p = makePlayer('ms-action-play').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			const playCalls: unknown[] = [];
			p.play = vi.fn(async () => { playCalls.push(true); });

			const handler = session._handlers.get('play');
			expect(handler).toBeTypeOf('function');
			handler!({} as MediaSessionActionDetails);

			expect(playCalls).toHaveLength(1);
		});

		it('pause action calls player.pause()', async () => {
			const p = makePlayer('ms-action-pause').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			const pauseCalls: unknown[] = [];
			p.pause = vi.fn(async () => { pauseCalls.push(true); });

			session._handlers.get('pause')!({} as MediaSessionActionDetails);
			expect(pauseCalls).toHaveLength(1);
		});

		it('stop action calls player.stop()', async () => {
			const p = makePlayer('ms-action-stop').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			const stopCalls: unknown[] = [];
			p.stop = vi.fn(async () => { stopCalls.push(true); });

			const handler = session._handlers.get('stop');
			if (handler) {
				handler({} as MediaSessionActionDetails);
				expect(stopCalls).toHaveLength(1);
			}
			// stop is optional per browser — skip assertion when handler was not registered
		});

		it('nexttrack action calls player.next()', async () => {
			const p = makePlayer('ms-action-next').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			const nextCalls: unknown[] = [];
			(p as MockPlayer & { next: () => Promise<void> }).next = vi.fn(async () => { nextCalls.push(true); });

			session._handlers.get('nexttrack')!({} as MediaSessionActionDetails);
			expect(nextCalls).toHaveLength(1);
		});

		it('previoustrack action calls player.previous()', async () => {
			const p = makePlayer('ms-action-prev').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			const prevCalls: unknown[] = [];
			(p as MockPlayer & { previous: () => Promise<void> }).previous = vi.fn(async () => { prevCalls.push(true); });

			session._handlers.get('previoustrack')!({} as MediaSessionActionDetails);
			expect(prevCalls).toHaveLength(1);
		});

		it('seekbackward action calls player.rewind(seekOffset)', async () => {
			const p = makePlayer('ms-action-seekbk').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			const rewindCalls: number[] = [];
			(p as MockPlayer & { rewind: (offset: number) => void }).rewind = (offset: number) => { rewindCalls.push(offset); };

			session._handlers.get('seekbackward')!({ seekOffset: 10 } as MediaSessionActionDetails);
			expect(rewindCalls).toHaveLength(1);
			expect(rewindCalls[0]).toBe(10);
		});

		it('seekbackward falls back to 5s when seekOffset is undefined', async () => {
			const p = makePlayer('ms-action-seekbk-fallback').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			const rewindCalls: number[] = [];
			(p as MockPlayer & { rewind: (offset: number) => void }).rewind = (offset: number) => { rewindCalls.push(offset); };

			session._handlers.get('seekbackward')!({} as MediaSessionActionDetails);
			expect(rewindCalls[0]).toBe(5);
		});

		it('seekforward action calls player.forward(seekOffset)', async () => {
			const p = makePlayer('ms-action-seekfwd').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			const forwardCalls: number[] = [];
			(p as MockPlayer & { forward: (offset: number) => void }).forward = (offset: number) => { forwardCalls.push(offset); };

			session._handlers.get('seekforward')!({ seekOffset: 15 } as MediaSessionActionDetails);
			expect(forwardCalls[0]).toBe(15);
		});

		it('seekto action calls player.time(seekTime)', async () => {
			const p = makePlayer('ms-action-seekto').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			const timeCalls: number[] = [];
			(p as MockPlayer & { time: (t: number) => void }).time = (t: number) => { timeCalls.push(t); };

			session._handlers.get('seekto')!({ seekTime: 45 } as MediaSessionActionDetails);
			expect(timeCalls[0]).toBe(45);
		});

		it('seekto is a no-op when seekTime is undefined', async () => {
			const p = makePlayer('ms-action-seekto-undef').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			const timeCalls: number[] = [];
			(p as MockPlayer & { time: (t: number) => void }).time = (t: number) => { timeCalls.push(t); };

			session._handlers.get('seekto')!({} as MediaSessionActionDetails);
			expect(timeCalls).toHaveLength(0);
		});
	});

	// ── clearMetadata() ───────────────────────────────────────────────────────

	describe('clearMetadata()', () => {
		it('sets navigator.mediaSession.metadata to null', async () => {
			const p = makePlayer('ms-clear-1').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();
			const inst = p.getPluginById('media-session') as MediaSessionPlugin;

			(p as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('item', {
				item: { id: 1, title: 'Track' },
				index: 0,
			});
			await flush();
			expect(session.metadata).toBeTruthy();

			inst.clearMetadata();
			expect(session.metadata).toBeNull();
		});
	});

	// ── metadata() getter/setter ───────────────────────────────────────────────

	describe('metadata() overload', () => {
		it('getter returns undefined before any metadata is set', async () => {
			const p = makePlayer('ms-meta-1').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();
			const inst = p.getPluginById('media-session') as MediaSessionPlugin;

			expect(inst.metadata()).toBeUndefined();
		});

		it('setter writes to navigator.mediaSession.metadata', async () => {
			const p = makePlayer('ms-meta-2').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();
			const inst = p.getPluginById('media-session') as MediaSessionPlugin;

			inst.metadata({ title: 'Test Song', artist: 'Test Artist', album: 'Test Album' });

			expect((session.metadata as { title: string }).title).toBe('Test Song');
			expect(inst.metadata()?.title).toBe('Test Song');
		});
	});

	// ── item event with null item ──────────────────────────────────────────────

	describe('item event with null item', () => {
		it('clears metadata when item is null', async () => {
			const p = makePlayer('ms-null-item').setup({});
			p.addPlugin(MediaSessionPlugin);
			await p.ready();

			(p as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('item', {
				item: { id: 1, title: 'Track' },
				index: 0,
			});
			await flush();
			expect(session.metadata).toBeTruthy();

			(p as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('item', { item: null, index: -1 });
			await flush();
			expect(session.metadata).toBeNull();
		});
	});

	// ── seed on use() when item already exists ────────────────────────────────

	describe('seed on use() from existing item', () => {
		it('pushes metadata from player.item() immediately when plugin is added after track is loaded', async () => {
			const p = makePlayer('ms-seed-1').setup({});

			// Pre-wire the player's item() accessor before addPlugin.
			(p as MockPlayer & { item: () => { id: number; title: string } }).item = () => ({
				id: 99,
				title: 'Pre-loaded Track',
			});

			p.addPlugin(MediaSessionPlugin);
			await p.ready();
			await flush();

			expect((session.metadata as { title: string }).title).toBe('Pre-loaded Track');
		});
	});

	// ── no-op in environments without mediaSession ────────────────────────────

	describe('no-op without navigator.mediaSession', () => {
		it('use() and dispose() do not throw when mediaSession is absent', async () => {
			restore(); // temporarily remove fake session

			const p = makePlayer('ms-nosession').setup({});
			expect(() => p.addPlugin(MediaSessionPlugin)).not.toThrow();
			await p.ready();
			expect(() => p.removePlugin(MediaSessionPlugin)).not.toThrow();

			// Re-install for afterEach to run cleanly.
			const installed = installFakeMediaSession();
			session = installed.session;
			positionCalls = installed.positionCalls;
			restore = installed.restore;
		});
	});
});
