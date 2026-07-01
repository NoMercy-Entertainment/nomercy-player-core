// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Direct tests for the shared player-core mixins. Builds a minimal class that
 * composes `playerCoreMethods` + calls `initPlayerCoreState` and exercises
 * every shared behavior. Music + video integration tests cover library-specific
 * surface; this file locks the spine so a mixin regression surfaces before it
 * reaches a downstream library.
 */

import type { BaseEventMap, BasePlaylistItem, PluginCtorWithId } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	Logger,
	playerCoreMethods,
	PlayerError,
	Plugin,
	pluginError,
	resolvePlayerConstructor,
	ResourceError,
	StateError,
	stateError,
} from '../index';

/**
 * Minimal player class that mirrors the shape both NMMusicPlayer and
 * NMVideoPlayer take: extends EventEmitter, owns a registry, calls
 * `initPlayerCoreState`, composes `playerCoreMethods` onto its prototype.
 */
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
	declare dispatching: () => ReadonlyArray<string>;
	declare baseUrl: { (): string | undefined; (url: string): void };
	declare audioContext: () => AudioContext | undefined;
	declare experimental: any;
	declare t: {
		(key: string, vars?: Record<string, string>): string;
		(PluginClass: PluginCtorWithId, key: string, vars?: Record<string, string>): string;
	};

	declare language: { (): string; (lang: string): Promise<void> };
	declare addTranslations: (bundle: any) => void;
	declare translation: (lang: string, key: string, value: string) => void;
	declare removeTranslations: (prefix: string, lang?: string) => void;
	declare registerCueParser: (parser: any, prepend?: boolean) => void;
	declare unregisterCueParser: (id: string) => void;
	declare play: (opts?: any) => Promise<void>;
	declare pause: (opts?: any) => Promise<void>;
	declare stop: (opts?: any) => Promise<void>;
	declare togglePlayback: (opts?: any) => Promise<void>;
	declare next: (opts?: any) => Promise<void>;
	declare previous: (opts?: any) => Promise<void>;
	declare rewind: (seconds?: number, opts?: any) => Promise<void>;
	declare forward: (seconds?: number, opts?: any) => Promise<void>;
	declare restart: (opts?: any) => Promise<void>;
	declare time: { (): number; (t: number, opts?: any): Promise<void> };
	declare duration: () => number;
	declare buffered: () => number;
	declare timeData: () => any;
	declare playbackRate: { (): number; (rate: number): void };
	declare playbackRates: () => number[];
	declare volume: { (): number; (v: number): void };
	declare mute: () => void;
	declare unmute: () => void;
	declare toggleMute: () => void;
	declare volumeUp: (step?: number) => void;
	declare volumeDown: (step?: number) => void;
	declare playState: () => string;
	declare volumeState: () => string;
	declare repeatState: { (): string; (state: any): void };
	declare shuffleState: { (): string; (state: any): void };
	declare queue: { (): ReadonlyArray<any>; (items: any[], opts?: any): void };
	declare queueAppend: (item: any, opts?: any) => void;
	declare queuePrepend: (item: any, opts?: any) => void;
	declare queueInsert: (item: any, index: number, opts?: any) => void;
	declare queueRemove: (id: any, opts?: any) => void;
	declare queueRemoveAt: (index: number, opts?: any) => void;
	declare queueMove: (from: number, to: number, opts?: any) => void;
	declare queueClear: (opts?: any) => void;
	declare queueShuffle: (opts?: any) => void;
	declare queueSort: (compare: any, opts?: any) => void;
	declare peekNext: () => any;
	declare peekPrevious: () => any;
	declare queueLength: () => number;
	declare queueIndexOf: (id: any) => number;
	declare item: { (): any; (target: any, opts?: any): void };
	declare index: () => number;
	declare backlog: { (): ReadonlyArray<any>; (items: any[]): void };
	declare backlogAppend: (item: any) => void;
	declare backlogRemove: (id: any) => void;
	declare backlogClear: () => void;
	declare addPlugin: <P extends Plugin>(PluginClass: new () => P, opts?: P['opts']) => this;
	declare getPlugin: (PluginClass: any) => any;
	declare getPluginById: (id: string) => any;
	declare removePlugin: (PluginClass: any) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<any>;
	declare enabledPlugins: () => ReadonlyArray<any>;

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

function setupPlayer(): MockPlayer {
	const div = document.createElement('div');
	div.id = 'mock';
	document.body.appendChild(div);
	return new MockPlayer('mock').setup({});
}

describe('player-core mixins (kit)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	// ── Constructor resolution ──

	describe('resolvePlayerConstructor', () => {
		it('throws StateError with code core:player/no-element when registry empty + no id', () => {
			let err: unknown;
			try {
				const _instance = new MockPlayer();
				void _instance;
			}
			catch (error) {
				err = error;
			}
			expect(err).toBeInstanceOf(PlayerError);
			expect(err).toBeInstanceOf(StateError);
			expect((err as PlayerError).code).toBe('core:player/no-element');
		});

		it('throws ResourceError with code core:player/element-missing when div absent', () => {
			let err: unknown;
			try {
				const _instance = new MockPlayer('absent');
				void _instance;
			}
			catch (error) {
				err = error;
			}
			expect(err).toBeInstanceOf(ResourceError);
			expect((err as PlayerError).code).toBe('core:player/element-missing');
		});

		it('throws StateError with code core:player/element-not-div when target is non-div', () => {
			const span = document.createElement('span');
			span.id = 'span-mock';
			document.body.appendChild(span);
			let err: unknown;
			try {
				const _instance = new MockPlayer('span-mock');
				void _instance;
			}
			catch (error) {
				err = error;
			}
			expect(err).toBeInstanceOf(StateError);
			expect((err as PlayerError).code).toBe('core:player/element-not-div');
		});

		it('throws StateError with code core:player/invalid-id-type for non-string-non-number', () => {
			let err: unknown;
			try {
				const _instance = new MockPlayer({} as any);
				void _instance;
			}
			catch (error) {
				err = error;
			}
			expect(err).toBeInstanceOf(StateError);
			expect((err as PlayerError).code).toBe('core:player/invalid-id-type');
		});

		it('throws StateError with code core:player/not-found for unknown numeric index', () => {
			const div = document.createElement('div');
			div.id = 'first';
			document.body.appendChild(div);
			const _first = new MockPlayer('first');
			void _first;
			let err: unknown;
			try {
				const _instance = new MockPlayer(99);
				void _instance;
			}
			catch (error) {
				err = error;
			}
			expect(err).toBeInstanceOf(StateError);
			expect((err as PlayerError).code).toBe('core:player/not-found');
		});

		it('returns existing instance on idempotent string lookup', () => {
			const div = document.createElement('div');
			div.id = 'idem';
			document.body.appendChild(div);
			const a = new MockPlayer('idem');
			const b = new MockPlayer('idem');
			expect(a).toBe(b);
		});
	});

	describe('pluginError', () => {
		it('returns a PluginError carrying the spec fields', () => {
			const err = pluginError('core:plugin/missing-dep', 'foo requires bar', { context: { id: 'foo' } });
			expect(err.code).toBe('core:plugin/missing-dep');
			expect(err.severity).toBe('error');
			expect(err.scope).toEqual({ kind: 'core' });
			expect(err.context).toEqual({ id: 'foo' });
		});
	});

	// ── Lifecycle mixin ──

	describe('lifecycle', () => {
		it('phase() returns "idle" before setup', () => {
			const div = document.createElement('div');
			div.id = 'p1';
			document.body.appendChild(div);
			expect(new MockPlayer('p1').phase()).toBe('idle');
		});

		it('setup() drives phase: idle → setup → ready', async () => {
			const div = document.createElement('div');
			div.id = 'p2';
			document.body.appendChild(div);
			const mockPlayer = new MockPlayer('p2');
			const transitions: string[] = [mockPlayer.phase()];
			mockPlayer.on('phase' as any, ({ to }: any) => transitions.push(to));
			mockPlayer.setup({});
			await mockPlayer.ready();
			expect(transitions).toEqual(['idle', 'setup', 'ready']);
		});

		it('setup() emits the full lifecycle event chain in order', async () => {
			const div = document.createElement('div');
			div.id = 'p3';
			document.body.appendChild(div);
			const mockPlayer = new MockPlayer('p3');
			const events: string[] = [];
			const sequence = [
				'beforeSetup',
				'setupStart',
				'configResolved',
				'pluginsRegistering',
				'pluginsRegistered',
				'streamsReady',
				'authReady',
				'playlistReady',
				'mediaReady',
				'ready',
			] as const;
			for (const name of sequence) {
				mockPlayer.on(name as any, () => events.push(name));
			}
			mockPlayer.setup({});
			await mockPlayer.ready();
			expect(events).toEqual([...sequence]);
		});

		it('setup() throws when called twice (spec §14: re-setup requires dispose)', async () => {
			const div = document.createElement('div');
			div.id = 'p4';
			document.body.appendChild(div);
			const mockPlayer = new MockPlayer('p4').setup({});
			await mockPlayer.ready();
			expect(() => mockPlayer.setup({})).toThrow(/already-setup/);
		});

		it('ready() resolves once setup completes', async () => {
			const div = document.createElement('div');
			div.id = 'p5';
			document.body.appendChild(div);
			const mockPlayer = new MockPlayer('p5').setup({});
			await expect(mockPlayer.ready()).resolves.toBeUndefined();
		});

		it('ready() rejects with spec-compliant StateError when dispose runs first', async () => {
			const div = document.createElement('div');
			div.id = 'p6';
			document.body.appendChild(div);
			const mockPlayer = new MockPlayer('p6');
			const promise = mockPlayer.ready();
			mockPlayer.dispose();
			let err: unknown;
			try {
				await promise;
			}
			catch (error) {
				err = error;
			}
			expect(err).toBeInstanceOf(StateError);
			expect((err as PlayerError).code).toBe('core:player/disposed');
		});

		it('dispose() emits "dispose" and transitions to disposed', () => {
			const div = document.createElement('div');
			div.id = 'p7';
			document.body.appendChild(div);
			const mockPlayer = new MockPlayer('p7');
			let disposed = false;
			mockPlayer.on('dispose' as any, () => {
				disposed = true;
			});
			mockPlayer.dispose();
			expect(disposed).toBe(true);
			expect(mockPlayer.phase()).toBe('disposed');
		});

		it('dispose() is idempotent', () => {
			const div = document.createElement('div');
			div.id = 'p8';
			document.body.appendChild(div);
			const mockPlayer = new MockPlayer('p8');
			mockPlayer.dispose();
			expect(() => mockPlayer.dispose()).not.toThrow();
		});
	});

	// ── BeforeEvent contract via transport ──

	describe('BeforeEvent contract (sync dispatch)', () => {
		it('beforePlay receives mutable data; mutation flows to play event', async () => {
			const mockPlayer = setupPlayer();
			let received: { source?: string } | undefined;
			mockPlayer.on('beforePlay' as any, (e: any) => {
				e.data.source = 'remote';
			});
			mockPlayer.on('play' as any, (data: any) => {
				received = data;
			});
			await mockPlayer.play({ source: 'user' });
			expect(received?.source).toBe('remote');
		});

		it('preventDefault on beforePlay → playPrevented, no play', async () => {
			const mockPlayer = setupPlayer();
			let played = false;
			let reason: string | undefined;
			mockPlayer.on('beforePlay' as any, (e: any) => {
				e.preventDefault();
			});
			mockPlayer.on('play' as any, () => {
				played = true;
			});
			mockPlayer.on('playPrevented' as any, (data: any) => {
				reason = data.reason;
			});
			await mockPlayer.play();
			expect(played).toBe(false);
			expect(reason).toBe('listener-prevented');
		});

		it('stopImmediatePropagation skips later listeners', async () => {
			const mockPlayer = setupPlayer();
			const calls: string[] = [];
			mockPlayer.on('beforePlay' as any, (e: any) => {
				calls.push('a');
				e.stopImmediatePropagation();
			});
			mockPlayer.on('beforePlay' as any, () => {
				calls.push('b');
			});
			await mockPlayer.play();
			expect(calls).toEqual(['a']);
		});

		it('stamps before-event onto dispatching() while listeners run', async () => {
			const mockPlayer = setupPlayer();
			let observed: ReadonlyArray<string> | undefined;
			mockPlayer.on('beforePlay' as any, () => {
				observed = mockPlayer.dispatching();
			});
			await mockPlayer.play();
			expect(observed).toEqual(['beforePlay']);
			expect(mockPlayer.dispatching()).toEqual([]);
		});
	});

	// ── Transport ──

	describe('transport', () => {
		it('play before setup throws core:player/not-ready', async () => {
			const div = document.createElement('div');
			div.id = 'before';
			document.body.appendChild(div);
			const mockPlayer = new MockPlayer('before');
			let err: unknown;
			try {
				await mockPlayer.play();
			}
			catch (error) {
				err = error;
			}
			expect(err).toBeInstanceOf(StateError);
			expect((err as PlayerError).code).toBe('core:player/not-ready');
		});

		it('pause emits beforePause + pause', async () => {
			const mockPlayer = setupPlayer();
			const order: string[] = [];
			mockPlayer.on('beforePause' as any, () => {
				order.push('beforePause');
			});
			mockPlayer.on('pause' as any, () => {
				order.push('pause');
			});
			await mockPlayer.pause();
			expect(order).toEqual(['beforePause', 'pause']);
		});

		it('stop emits beforeStop + stop (cancellable transport pre-event)', async () => {
			const mockPlayer = setupPlayer();
			const order: string[] = [];
			mockPlayer.on('beforeStop' as any, () => {
				order.push('beforeStop');
			});
			mockPlayer.on('stop' as any, () => {
				order.push('stop');
			});
			await mockPlayer.stop();
			expect(order).toEqual(['beforeStop', 'stop']);
		});

		it('stop respects preventDefault and emits stopPrevented', async () => {
			const mockPlayer = setupPlayer();
			let stopped = false;
			let prevented: { reason?: string } | undefined;
			mockPlayer.on('beforeStop' as any, (e: any) => {
				e.preventDefault();
			});
			mockPlayer.on('stop' as any, () => {
				stopped = true;
			});
			mockPlayer.on('stopPrevented' as any, (data: any) => {
				prevented = data;
			});
			await mockPlayer.stop();
			expect(stopped).toBe(false);
			expect(prevented?.reason).toBe('listener-prevented');
		});

		it('togglePlayback toggles between play and pause', async () => {
			const mockPlayer = setupPlayer();
			let played = 0;
			let paused = 0;
			mockPlayer.on('play' as any, () => {
				played += 1;
			});
			mockPlayer.on('pause' as any, () => {
				paused += 1;
			});
			await mockPlayer.togglePlayback();
			await mockPlayer.togglePlayback();
			expect(played).toBe(1);
			expect(paused).toBe(1);
		});

		it('rewind emits beforeSeek with negative delta', () => {
			const mockPlayer = setupPlayer();
			let beforeSeekTime: number | undefined;
			mockPlayer.on('beforeSeek' as any, (e: any) => {
				beforeSeekTime = e.data.time;
			});
			mockPlayer.rewind(5);
			expect(beforeSeekTime).toBe(-5);
		});

		it('forward emits beforeSeek with positive delta', () => {
			const mockPlayer = setupPlayer();
			let beforeSeekTime: number | undefined;
			mockPlayer.on('beforeSeek' as any, (e: any) => {
				beforeSeekTime = e.data.time;
			});
			mockPlayer.forward(10);
			expect(beforeSeekTime).toBe(10);
		});

		it('restart seeks to 0 then plays', async () => {
			const mockPlayer = setupPlayer();
			const order: string[] = [];
			mockPlayer.on('seek' as any, (data: any) => {
				order.push(`seek:${data.time}`);
			});
			mockPlayer.on('play' as any, () => {
				order.push('play');
			});
			await mockPlayer.restart();
			expect(order).toContain('seek:0');
			expect(order[order.length - 1]).toBe('play');
		});
	});

	// ── State enums ──

	describe('state enums', () => {
		it('playState transitions through play/pause/stop', async () => {
			const mockPlayer = setupPlayer();
			expect(mockPlayer.playState()).toBe('idle');
			await mockPlayer.play();
			expect(mockPlayer.playState()).toBe('playing');
			await mockPlayer.pause();
			expect(mockPlayer.playState()).toBe('paused');
			await mockPlayer.stop();
			expect(mockPlayer.playState()).toBe('stopped');
		});

		it('repeatState round-trips and emits "repeat"', () => {
			const mockPlayer = setupPlayer();
			expect(mockPlayer.repeatState()).toBe('off');
			let emitted: { state: string } | undefined;
			mockPlayer.on('repeat' as any, (data: any) => {
				emitted = data;
			});
			mockPlayer.repeatState('all');
			expect(mockPlayer.repeatState()).toBe('all');
			expect(emitted?.state).toBe('all');
		});

		it('shuffleState accepts a boolean shorthand', () => {
			const mockPlayer = setupPlayer();
			mockPlayer.shuffleState(true as any);
			expect(mockPlayer.shuffleState()).toBe('on');
			mockPlayer.shuffleState(false as any);
			expect(mockPlayer.shuffleState()).toBe('off');
		});
	});

	// ── Volume ──

	describe('volume', () => {
		it('default volume is 100', () => {
			expect(setupPlayer().volume()).toBe(100);
		});

		it('honours config.defaultVolume', () => {
			const div = document.createElement('div');
			div.id = 'vp';
			document.body.appendChild(div);
			const mockPlayer = new MockPlayer('vp').setup({ defaultVolume: 40 } as any);
			expect(mockPlayer.volume()).toBe(40);
		});

		it('clamps writes to [0, 100]', () => {
			const mockPlayer = setupPlayer();
			mockPlayer.volume(200);
			expect(mockPlayer.volume()).toBe(100);
			mockPlayer.volume(-1);
			expect(mockPlayer.volume()).toBe(0);
		});

		it('mute() returns 0; unmute() restores prior level', () => {
			const mockPlayer = setupPlayer();
			mockPlayer.volume(60);
			mockPlayer.mute();
			expect(mockPlayer.volume()).toBe(0);
			mockPlayer.unmute();
			expect(mockPlayer.volume()).toBe(60);
		});

		it('volumeUp / volumeDown clamp at the bounds', () => {
			const mockPlayer = setupPlayer();
			mockPlayer.volume(95);
			mockPlayer.volumeUp(20);
			expect(mockPlayer.volume()).toBe(100);
			mockPlayer.volume(5);
			mockPlayer.volumeDown(20);
			expect(mockPlayer.volume()).toBe(0);
		});
	});

	// ── Time ──

	describe('time', () => {
		it('time() read defaults to 0', () => {
			expect(setupPlayer().time()).toBe(0);
		});

		it('time(t) round-trips and emits seek', async () => {
			const mockPlayer = setupPlayer();
			let seekTime: number | undefined;
			mockPlayer.on('seek' as any, (data: any) => {
				seekTime = data.time;
			});
			await mockPlayer.time(15);
			expect(mockPlayer.time()).toBe(15);
			expect(seekTime).toBe(15);
		});

		it('time(t) preventDefault leaves the value unchanged', async () => {
			const mockPlayer = setupPlayer();
			await mockPlayer.time(7);
			mockPlayer.on('beforeSeek' as any, (e: any) => {
				e.preventDefault();
			});
			await mockPlayer.time(99);
			expect(mockPlayer.time()).toBe(7);
		});

		it('playbackRate round-trips and emits backend:ratechange', () => {
			const mockPlayer = setupPlayer();
			let rate: number | undefined;
			mockPlayer.on('backend:ratechange' as any, (data: any) => {
				rate = data.rate;
			});
			mockPlayer.playbackRate(1.5);
			expect(mockPlayer.playbackRate()).toBe(1.5);
			expect(rate).toBe(1.5);
		});

		it('timeData returns aggregated TimeState shape', async () => {
			const mockPlayer = setupPlayer();
			await mockPlayer.time(3);
			const data = mockPlayer.timeData();
			expect(data.position).toBe(3);
			expect(data).toHaveProperty('duration');
			expect(data).toHaveProperty('buffered');
			expect(data).toHaveProperty('remaining');
			expect(data).toHaveProperty('percentage');
		});
	});

	// ── i18n ──

	describe('i18n', () => {
		it('t(key) falls through to the key when missing', () => {
			expect(setupPlayer().t('missing.key')).toBe('missing.key');
		});

		it('addTranslations + t round-trips', () => {
			const mockPlayer = setupPlayer();
			mockPlayer.addTranslations({ en: { hello: 'world' } });
			expect(mockPlayer.t('hello')).toBe('world');
		});

		it('t(key, vars) interpolates {var}', () => {
			const mockPlayer = setupPlayer();
			mockPlayer.addTranslations({ en: { greet: 'Hi {name}' } });
			expect(mockPlayer.t('greet', { name: 'Arc' })).toBe('Hi Arc');
		});

		it('removeTranslations strips by prefix', () => {
			const mockPlayer = setupPlayer();
			mockPlayer.addTranslations({ en: { 'foo.a': 'A', 'foo.b': 'B' } });
			mockPlayer.removeTranslations('foo.');
			expect(mockPlayer.t('foo.a')).toBe('foo.a');
		});
	});

	// ── Cue parser ──

	describe('cue parser', () => {
		it('register + unregister round-trip without throwing', () => {
			const mockPlayer = setupPlayer();
			const parser = { id: 'p1', canParse: (): boolean => false, parse: (): any => ({ cues: [], duration: 0 }) };
			expect(() => mockPlayer.registerCueParser(parser as any)).not.toThrow();
			expect(() => mockPlayer.unregisterCueParser('p1')).not.toThrow();
		});

		it('unregistering an absent id is a no-op', () => {
			expect(() => setupPlayer().unregisterCueParser('absent')).not.toThrow();
		});
	});

	// ── Base URL + audio context ──

	describe('baseUrl + audioContext', () => {
		it('baseUrl read/write round-trips', () => {
			const mockPlayer = setupPlayer();
			expect(mockPlayer.baseUrl()).toBeUndefined();
			mockPlayer.baseUrl('https://example.test/api');
			expect(mockPlayer.baseUrl()).toBe('https://example.test/api');
		});

		it('config.baseUrl seeds the value at setup', () => {
			const div = document.createElement('div');
			div.id = 'cb';
			document.body.appendChild(div);
			const mockPlayer = new MockPlayer('cb').setup({ baseUrl: 'https://seeded.test' } as any);
			expect(mockPlayer.baseUrl()).toBe('https://seeded.test');
		});

		it('audioContext is undefined initially', () => {
			expect(setupPlayer().audioContext()).toBeUndefined();
		});
	});

	// ── Experimental override surface ──

	describe('experimental', () => {
		it('override + restore + overrides round-trip', () => {
			const mockPlayer = setupPlayer();
			const unbind = mockPlayer.experimental.override('foo', () => 1);
			expect(mockPlayer.experimental.overrides().some((o: any) => o.method === 'foo')).toBe(true);
			unbind();
			expect(mockPlayer.experimental.overrides().some((o: any) => o.method === 'foo')).toBe(false);
		});

		it('restore(name) clears a named method', () => {
			const mockPlayer = setupPlayer();
			mockPlayer.experimental.override('bar', () => 2);
			mockPlayer.experimental.restore('bar');
			expect(mockPlayer.experimental.overrides().some((o: any) => o.method === 'bar')).toBe(false);
		});
	});

	// ── Queue + cursor + backlog ──

	describe('queue + cursor + backlog', () => {
		const t = (id: string): BasePlaylistItem => ({ id });

		it('queue() empty initially; queue([items]) replaces and emits "queue"', () => {
			const mockPlayer = setupPlayer();
			expect(mockPlayer.queue()).toEqual([]);
			let emitted: ReadonlyArray<unknown> | undefined;
			mockPlayer.on('queue' as any, (items: any) => {
				emitted = items;
			});
			mockPlayer.queue([t('a'), t('b')]);
			expect(mockPlayer.queue().length).toBe(2);
			expect(emitted?.length).toBe(2);
		});

		it('queueAppend emits queue:append with from index', () => {
			const mockPlayer = setupPlayer();
			let from: number | undefined;
			mockPlayer.on('queue:append' as any, (data: any) => {
				from = data.from;
			});
			mockPlayer.queue([t('a')]);
			mockPlayer.queueAppend(t('b'));
			expect(from).toBe(1);
		});

		it('queueRemove emits queue:remove with id', () => {
			const mockPlayer = setupPlayer();
			let removedId: string | undefined;
			mockPlayer.on('queue:remove' as any, (data: any) => {
				removedId = data.id;
			});
			mockPlayer.queue([t('a'), t('b')]);
			mockPlayer.queueRemove('a');
			expect(removedId).toBe('a');
		});

		it('queueClear emits queue:clear with previousLength', () => {
			const mockPlayer = setupPlayer();
			let cleared: { previousLength: number } | undefined;
			mockPlayer.on('queue:clear' as any, (data: any) => {
				cleared = data;
			});
			mockPlayer.queue([t('a'), t('b'), t('c')]);
			mockPlayer.queueClear();
			expect(cleared?.previousLength).toBe(3);
			expect(mockPlayer.queue()).toEqual([]);
		});

		it('item() moves the cursor and emits "item"', () => {
			const mockPlayer = setupPlayer();
			mockPlayer.queue([t('a'), t('b'), t('c')]);
			let payload: { index: number } | undefined;
			mockPlayer.on('item' as any, (data: any) => {
				payload = data;
			});
			mockPlayer.item('c');
			expect(mockPlayer.item()?.id).toBe('c');
			expect(payload?.index).toBe(2);
		});

		it('peekNext / peekPrevious work off the cursor', () => {
			const mockPlayer = setupPlayer();
			mockPlayer.queue([t('a'), t('b')]);
			expect(mockPlayer.peekNext()?.id).toBe('b');
			expect(mockPlayer.peekPrevious()).toBeUndefined();
		});

		it('queueIndexOf returns -1 for unknown ids', () => {
			expect(setupPlayer().queueIndexOf('zzz')).toBe(-1);
		});

		it('backlog([items]) replaces + emits "backlog"', () => {
			const mockPlayer = setupPlayer();
			let emitted: ReadonlyArray<unknown> | undefined;
			mockPlayer.on('backlog' as any, (items: any) => {
				emitted = items;
			});
			mockPlayer.backlog([t('a'), t('b')]);
			expect(emitted?.length).toBe(2);
		});

		it('backlogClear emits backlog:clear', () => {
			const mockPlayer = setupPlayer();
			let cleared: { previousLength: number } | undefined;
			mockPlayer.on('backlog:clear' as any, (data: any) => {
				cleared = data;
			});
			mockPlayer.backlog([t('a')]);
			mockPlayer.backlogClear();
			expect(cleared?.previousLength).toBe(1);
		});
	});

	// ── Plugin registration ──

	describe('plugin registration', () => {
		class HelloPlugin extends Plugin {
			static override readonly id = 'hello';
			static override readonly version = '1.0.0';
			static override readonly translations = { en: { 'plugin.hello.greet': 'hi' } };
			used = false;
			disposed = false;
			override use(): void { this.used = true; }
			override dispose(): void { this.disposed = true; }
		}

		class NeedsHelloPlugin extends Plugin {
			static override readonly id = 'needs-hello';
			static override readonly requires = [HelloPlugin];
		}

		it('addPlugin instantiates + uses + emits plugin:installed', async () => {
			const mockPlayer = setupPlayer();
			let payload: { id: string; version: string } | undefined;
			mockPlayer.on('plugin:installed' as any, (data: any) => {
				payload = data;
			});
			mockPlayer.addPlugin(HelloPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(HelloPlugin);
			expect(inst?.used).toBe(true);
			expect(payload).toEqual({ id: 'hello', version: '1.0.0' });
		});

		it('addPlugin merges static translations', async () => {
			const mockPlayer = setupPlayer();
			mockPlayer.addPlugin(HelloPlugin);
			await mockPlayer.ready();
			expect(mockPlayer.t('plugin.hello.greet')).toBe('hi');
		});

		it('addPlugin throws core:plugin/duplicate-id on second add', () => {
			const mockPlayer = setupPlayer();
			mockPlayer.addPlugin(HelloPlugin);
			expect(() => mockPlayer.addPlugin(HelloPlugin)).toThrow(/core:plugin\/duplicate-id/);
		});

		it('addPlugin throws core:plugin/missing-dep when a required plugin is absent', () => {
			const mockPlayer = setupPlayer();
			expect(() => mockPlayer.addPlugin(NeedsHelloPlugin)).toThrow(/core:plugin\/missing-dep/);
		});

		it('addPlugin\'s `opts` parameter is typed to the plugin\'s O generic — no `satisfies` needed for autocomplete', async () => {
			interface TypedOpts {
				answer: number;
				flag?: boolean;
			}

			class TypedPlugin extends Plugin<any, TypedOpts> {
				static override readonly id = 'typed-opts';
				static override readonly version = '1.0.0';
				static override readonly description = 'verifies opts inference';
			}

			const mockPlayer = setupPlayer();

			// Compile-time assertion: passing matching opts compiles without `satisfies`
			// AND without `as`. If P['opts'] inference broke, this line would fail
			// type-checking with "Object literal may only specify known properties..."
			// (extra prop) or "missing property" (required field absent).
			mockPlayer.addPlugin(TypedPlugin, { answer: 42 });

			// @ts-expect-error — wrong type for `answer` (not assignable to number)
			void (() => mockPlayer.addPlugin(TypedPlugin, { answer: 'no' }));
			// @ts-expect-error — extra property not on TypedOpts
			void (() => mockPlayer.addPlugin(TypedPlugin, { answer: 1, bogus: true }));

			await mockPlayer.ready();

			// At runtime, the plugin received the typed opts.
			const inst = mockPlayer.getPlugin(TypedPlugin) as (TypedPlugin & { opts: TypedOpts }) | undefined;
			expect(inst?.opts?.answer).toBe(42);
		});

		it('removePlugin disposes + emits plugin:disposed + strips translations', async () => {
			const mockPlayer = setupPlayer();
			mockPlayer.addPlugin(HelloPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(HelloPlugin);
			let disposedId: string | undefined;
			mockPlayer.on('plugin:disposed' as any, (data: any) => {
				disposedId = data.id;
			});
			mockPlayer.removePlugin(HelloPlugin);
			expect(inst?.disposed).toBe(true);
			expect(disposedId).toBe('hello');
			expect(mockPlayer.t('plugin.hello.greet')).toBe('plugin.hello.greet');
		});

		it('plugins() lists registered; enabledPlugins() filters disabled', async () => {
			const mockPlayer = setupPlayer();
			mockPlayer.addPlugin(HelloPlugin);
			await mockPlayer.ready();
			expect(mockPlayer.plugins().length).toBe(1);
			mockPlayer.getPlugin(HelloPlugin)?.disable();
			expect(mockPlayer.enabledPlugins().length).toBe(0);
		});
	});

	// ── Plugin.initialize() wires storage + logger ──

	describe('Plugin.initialize() provides storage and logger', () => {
		it('this.storage is a namespaced IStorage after initialize()', async () => {
			class StorageProbePlugin extends Plugin {
				static override readonly id = 'storage-probe';
				static override readonly description = 'storage probe';
				storedValue: string | null = null;

				override use(): void {
					this.storage.set('key', 'hello');
					this.storedValue = this.storage.get('key') as string | null;
				}
			}

			const player = setupPlayer();
			player.addPlugin(StorageProbePlugin as any);
			await player.ready();

			const inst = player.getPlugin(StorageProbePlugin as any) as StorageProbePlugin | undefined;
			expect(inst).toBeDefined();
			expect(inst?.storedValue).toBe('hello');
		});

		it('this.logger is scoped to the plugin id after initialize()', async () => {
			const loggedMessages: string[] = [];

			class LoggerProbePlugin extends Plugin {
				static override readonly id = 'logger-probe';
				static override readonly description = 'logger probe';

				override use(): void {
					this.logger.info('probe message');
				}
			}

			const mockLogger = new Logger({ prefix: 'nmplayer' });
			mockLogger.addSink((_level, prefix, args) => {
				loggedMessages.push(`${prefix} ${args.join(' ')}`);
			});

			const div = document.createElement('div');
			div.id = 'logger-probe-player';
			document.body.appendChild(div);
			const player = new MockPlayer('logger-probe-player').setup({ logger: mockLogger } as any);
			player.addPlugin(LoggerProbePlugin as any);
			await player.ready();

			expect(loggedMessages.some(msg => msg.includes('logger-probe') && msg.includes('probe message'))).toBe(true);
		});
	});

	// ── Plugin use() failures are never silent ──

	describe('plugin use() failure is never silent', () => {
		it('emits plugin:failed when use() throws', async () => {
			class ThrowingPlugin extends Plugin {
				static override readonly id = 'thrower';
				static override readonly description = 'throws on use';

				override use(): void {
					throw new Error('intentional use() failure');
				}
			}

			const player = setupPlayer();
			const failedIds: string[] = [];
			player.on('plugin:failed' as any, (data: any) => failedIds.push(data.id));
			player.addPlugin(ThrowingPlugin as any);
			await player.ready();

			expect(failedIds).toContain('thrower');
			expect(player.getPlugin(ThrowingPlugin as any)).toBeUndefined();
		});

		it('logs the failure through the plugin scoped logger regardless of listener timing', async () => {
			class ThrowingPlugin2 extends Plugin {
				static override readonly id = 'thrower2';
				static override readonly description = 'throws on use';

				override use(): void {
					throw new Error('use() blow-up');
				}
			}

			const errorMessages: string[] = [];
			const mockLogger = new Logger({ prefix: 'nmplayer' });
			mockLogger.addSink((_level, prefix, args) => {
				errorMessages.push(`${prefix} ${args.join(' ')}`);
			});

			const div = document.createElement('div');
			div.id = 'thrower2-player';
			document.body.appendChild(div);
			const player = new MockPlayer('thrower2-player').setup({ logger: mockLogger } as any);

			player.addPlugin(ThrowingPlugin2 as any);
			await player.ready();

			expect(errorMessages.some(msg => msg.includes('thrower2') && msg.includes('use() blow-up'))).toBe(true);
		});
	});

	// ── stateError helper sanity ──

	describe('stateError helper', () => {
		it('produces a StateError with proper code, severity, scope', () => {
			const err = stateError('core:player/foo', 'bar');
			expect(err).toBeInstanceOf(StateError);
			expect(err.code).toBe('core:player/foo');
			expect(err.severity).toBe('error');
			expect(err.scope).toEqual({ kind: 'core' });
		});
	});
});
