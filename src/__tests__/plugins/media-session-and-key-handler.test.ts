// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * MediaSessionPlugin + KeyHandlerPlugin behaviour. Locks the just-landed
 * real impls so regressions on the OS-bridge surface or keyboard router
 * surface immediately.
 *
 * Mirrors the conventions in `tier1-features.test.ts`: a self-contained
 * MockPlayer built on the kit's shared mixins so plugins exercise the real
 * spine, not a hand-rolled stub. happy-dom lacks `navigator.mediaSession` /
 * `MediaMetadata`, so the MediaSession suite stubs both globally before each
 * test and restores them after.
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
import { KeyHandlerPlugin } from '../../plugins/key-handler';
import { MediaSessionPlugin } from '../../plugins/media-session';

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = <HTMLElement>{};

	get id(): string {
		return this.playerId;
	}

	declare options: any;
	declare setup: (config: any) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare phase: () => string;
	declare addPlugin: (PluginClass: any, opts?: any) => this;
	declare getPlugin: (PluginClass: any) => any;
	declare getPluginById: (id: string) => any;
	declare removePlugin: (PluginClass: any) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<any>;
	declare enabledPlugins: () => ReadonlyArray<any>;
	declare play: (opts?: any) => Promise<void>;
	declare pause: (opts?: any) => Promise<void>;
	declare stop: (opts?: any) => Promise<void>;
	declare togglePlayback: (opts?: any) => Promise<void>;
	declare t: (key: string, vars?: Record<string, string>) => string;
	declare time: { (): number; (seconds: number, opts?: any): Promise<void> };
	declare volume: { (): number; (level: number): void };
	declare experimental: any;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing') {
			return resolved.instance as unknown as this;
		}
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void {
		_instances.clear();
	}
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

describe('MediaSessionPlugin', () => {
	let originalMediaSession: PropertyDescriptor | undefined;
	let originalMediaMetadata: typeof globalThis.MediaMetadata | undefined;

	beforeEach(() => {
		MockPlayer._resetRegistry();

		// happy-dom doesn't ship MediaSession / MediaMetadata. Install minimal
		// stand-ins so the plugin's `use()` runs the real wiring path.
		originalMediaSession = Object.getOwnPropertyDescriptor(navigator, 'mediaSession');
		const handlers = new Map<string, MediaSessionActionHandler | null>();
		const fakeSession = {
			metadata: null as unknown,
			playbackState: 'none' as MediaSessionPlaybackState,
			setActionHandler(action: string, handler: MediaSessionActionHandler | null): void {
				handlers.set(action, handler);
			},
			setPositionState(_state?: MediaPositionState): void {
				// no-op
			},
			_handlers: handlers,
		};
		Object.defineProperty(navigator, 'mediaSession', {
			value: fakeSession,
			configurable: true,
			writable: true,
		});

		originalMediaMetadata = (globalThis as any).MediaMetadata;
		(globalThis as any).MediaMetadata = class FakeMediaMetadata {
			title?: string;
			artist?: string;
			album?: string;
			artwork?: Array<{ src: string }>;
			constructor(init: { title?: string; artist?: string; album?: string; artwork?: Array<{ src: string }> }) {
				this.title = init.title;
				this.artist = init.artist;
				this.album = init.album;
				this.artwork = init.artwork;
			}
		};
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
		if (originalMediaSession) {
			Object.defineProperty(navigator, 'mediaSession', originalMediaSession);
		}
		else {
			delete (navigator as any).mediaSession;
		}
		if (originalMediaMetadata !== undefined) {
			(globalThis as any).MediaMetadata = originalMediaMetadata;
		}
		else {
			delete (globalThis as any).MediaMetadata;
		}
	});

	/** Flush the microtask queue so async plugin internals settle. */
	async function flushMicrotasks(): Promise<void> {
		await new Promise<void>(resolve => setTimeout(resolve, 0));
	}

	it('registers, runs use() without throwing, and dispose() clears metadata', async () => {
		const mockPlayer = makePlayer('ms-1').setup({});
		expect(() => mockPlayer.addPlugin(MediaSessionPlugin)).not.toThrow();
		await mockPlayer.ready();

		const inst = mockPlayer.getPluginById('media-session');
		expect(inst).toBeDefined();

		// Push the current item so metadata gets set.
		mockPlayer.emit('item', { item: { id: 1, title: 'Track A', artist: 'Band', album: 'LP' }, index: 0 });
		await flushMicrotasks();
		expect((navigator.mediaSession as any).metadata).toBeTruthy();
		expect(((navigator.mediaSession as any).metadata as { title: string }).title).toBe('Track A');

		// Action handlers were installed for at least the playback set.
		const handlers = (navigator.mediaSession as unknown as { _handlers: Map<string, unknown> })._handlers;
		expect(handlers.get('play')).toBeTypeOf('function');
		expect(handlers.get('pause')).toBeTypeOf('function');
		expect(handlers.get('nexttrack')).toBeTypeOf('function');
		expect(handlers.get('seekforward')).toBeTypeOf('function');

		mockPlayer.removePlugin(MediaSessionPlugin);
		expect((navigator.mediaSession as any).metadata).toBeNull();
		// Action handlers were torn down (set to null).
		expect(handlers.get('play')).toBeNull();
		expect(handlers.get('pause')).toBeNull();
	});

	it('populates artwork from item.image field (VideoPlaylistItem shape)', async () => {
		const mockPlayer = makePlayer('ms-artwork-image').setup({});
		mockPlayer.addPlugin(MediaSessionPlugin);
		await mockPlayer.ready();

		mockPlayer.emit('item', {
			item: { id: 2, title: 'Movie', image: 'https://cdn.example.com/poster.jpg' },
			index: 0,
		});
		await flushMicrotasks();

		const meta = (navigator.mediaSession as any).metadata;
		expect(meta).toBeTruthy();
		expect(meta.artwork).toHaveLength(1);
		expect(meta.artwork[0].src).toBe('https://cdn.example.com/poster.jpg');
		expect(meta.artwork[0].sizes).toBe('512x512');
		expect(meta.artwork[0].type).toBe('image/jpeg');
	});

	it('populates artwork from item.cover field (MusicPlaylistItem shape)', async () => {
		const mockPlayer = makePlayer('ms-artwork-cover').setup({});
		mockPlayer.addPlugin(MediaSessionPlugin);
		await mockPlayer.ready();

		mockPlayer.emit('item', {
			item: { id: 3, title: 'Song', cover: 'https://cdn.example.com/album.png' },
			index: 0,
		});
		await flushMicrotasks();

		const meta = (navigator.mediaSession as any).metadata;
		expect(meta).toBeTruthy();
		expect(meta.artwork).toHaveLength(1);
		expect(meta.artwork[0].src).toBe('https://cdn.example.com/album.png');
		expect(meta.artwork[0].type).toBe('image/png');
	});

	it('prefers item.image over item.poster over item.thumbnail over item.cover', async () => {
		const mockPlayer = makePlayer('ms-artwork-priority').setup({});
		mockPlayer.addPlugin(MediaSessionPlugin);
		await mockPlayer.ready();

		mockPlayer.emit('item', {
			item: {
				id: 4,
				title: 'Episode',
				image: 'https://cdn.example.com/image.webp',
				poster: 'https://cdn.example.com/poster.jpg',
				thumbnail: 'https://cdn.example.com/thumb.jpg',
				cover: 'https://cdn.example.com/cover.jpg',
			},
			index: 0,
		});
		await flushMicrotasks();

		const meta = (navigator.mediaSession as any).metadata;
		expect(meta.artwork[0].src).toBe('https://cdn.example.com/image.webp');
		expect(meta.artwork[0].type).toBe('image/webp');
	});

	it('leaves artwork absent when item has no image field', async () => {
		const mockPlayer = makePlayer('ms-artwork-none').setup({});
		mockPlayer.addPlugin(MediaSessionPlugin);
		await mockPlayer.ready();

		mockPlayer.emit('item', {
			item: { id: 5, title: 'Track', artist: 'Artist' },
			index: 0,
		});
		await flushMicrotasks();

		const meta = (navigator.mediaSession as any).metadata;
		expect(meta).toBeTruthy();
		expect(meta.title).toBe('Track');
		// No artwork supplied — the key should be absent or undefined.
		expect(meta.artwork == null || meta.artwork === undefined).toBe(true);
	});
});

describe('KeyHandlerPlugin', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	const dispatch = (key: string, target?: EventTarget): void => {
		const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
		(target ?? document).dispatchEvent(ev);
	};

	it('bind() registers a key; firing keydown calls the handler', async () => {
		const mockPlayer = makePlayer('kh-1').setup({});
		mockPlayer.addPlugin(KeyHandlerPlugin);
		await mockPlayer.ready();
		const inst = mockPlayer.getPluginById('key-handler');
		expect(inst).toBeDefined();

		const fn = vi.fn();
		inst.bind('p', fn);
		dispatch('p');
		expect(fn).toHaveBeenCalledOnce();
	});

	it('unbind() removes a key; subsequent keydown does not call the handler', async () => {
		const mockPlayer = makePlayer('kh-2').setup({});
		mockPlayer.addPlugin(KeyHandlerPlugin);
		await mockPlayer.ready();
		const inst = mockPlayer.getPluginById('key-handler');

		const fn = vi.fn();
		inst.bind('p', fn);
		inst.unbind('p');
		dispatch('p');
		expect(fn).not.toHaveBeenCalled();
	});

	it('ignores keydown when the target is an <input>', async () => {
		const mockPlayer = makePlayer('kh-3').setup({});
		mockPlayer.addPlugin(KeyHandlerPlugin);
		await mockPlayer.ready();
		const inst = mockPlayer.getPluginById('key-handler');

		const fn = vi.fn();
		inst.bind('p', fn);

		const input = document.createElement('input');
		document.body.appendChild(input);
		input.focus();
		dispatch('p', input);

		expect(fn).not.toHaveBeenCalled();
	});

	it('default bindings include space / arrows / m', async () => {
		const mockPlayer = makePlayer('kh-4').setup({});
		mockPlayer.addPlugin(KeyHandlerPlugin);
		await mockPlayer.ready();
		const inst = mockPlayer.getPluginById('key-handler');

		const map = inst.bindings();
		expect(map.has(' ')).toBe(true);
		expect(map.has('ArrowLeft')).toBe(true);
		expect(map.has('ArrowRight')).toBe(true);
		expect(map.has('ArrowUp')).toBe(true);
		expect(map.has('ArrowDown')).toBe(true);
		expect(map.has('m')).toBe(true);
	});

	it('default bindings include W3C hardware media keys', async () => {
		const mockPlayer = makePlayer('kh-5').setup({});
		mockPlayer.addPlugin(KeyHandlerPlugin);
		await mockPlayer.ready();
		const inst = mockPlayer.getPluginById('key-handler');

		const map = inst.bindings();
		expect(map.has('MediaPlay')).toBe(true);
		expect(map.has('MediaPause')).toBe(true);
		expect(map.has('MediaPlayPause')).toBe(true);
		expect(map.has('MediaStop')).toBe(true);
		expect(map.has('MediaRewind')).toBe(true);
		expect(map.has('MediaFastForward')).toBe(true);
		expect(map.has('MediaTrackNext')).toBe(true);
		expect(map.has('MediaTrackPrevious')).toBe(true);
	});

	it('disableMediaControls suppresses hardware media keys', async () => {
		const toggleFn = vi.fn();
		const mockPlayer = makePlayer('kh-6').setup({});
		mockPlayer.addPlugin(KeyHandlerPlugin, { disableMediaControls: true });
		await mockPlayer.ready();

		mockPlayer.togglePlayback = toggleFn;

		const ev = new KeyboardEvent('keydown', { key: 'MediaPlayPause', bubbles: true, cancelable: true });
		document.dispatchEvent(ev);

		expect(toggleFn).not.toHaveBeenCalled();
	});
});
