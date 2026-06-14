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
			catch (e) {
				err = e;
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
			catch (e) {
				err = e;
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
			catch (e) {
				err = e;
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
			catch (e) {
				err = e;
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
			catch (e) {
				err = e;
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
			const p = new MockPlayer('p2');
			const transitions: string[] = [p.phase()];
			p.on('phase' as any, ({ to }: any) => transitions.push(to));
			p.setup({});
			await p.ready();
			expect(transitions).toEqual(['idle', 'setup', 'ready']);
		});

		it('setup() emits the full lifecycle event chain in order', async () => {
			const div = document.createElement('div');
			div.id = 'p3';
			document.body.appendChild(div);
			const p = new MockPlayer('p3');
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
				p.on(name as any, () => events.push(name));
			}
			p.setup({});
			await p.ready();
			expect(events).toEqual([...sequence]);
		});

		it('setup() throws when called twice (spec §14: re-setup requires dispose)', async () => {
			const div = document.createElement('div');
			div.id = 'p4';
			document.body.appendChild(div);
			const p = new MockPlayer('p4').setup({});
			await p.ready();
			expect(() => p.setup({})).toThrow(/already-setup/);
		});

		it('ready() resolves once setup completes', async () => {
			const div = document.createElement('div');
			div.id = 'p5';
			document.body.appendChild(div);
			const p = new MockPlayer('p5').setup({});
			await expect(p.ready()).resolves.toBeUndefined();
		});

		it('ready() rejects with spec-compliant StateError when dispose runs first', async () => {
			const div = document.createElement('div');
			div.id = 'p6';
			document.body.appendChild(div);
			const p = new MockPlayer('p6');
			const promise = p.ready();
			p.dispose();
			let err: unknown;
			try {
				await promise;
			}
			catch (e) {
				err = e;
			}
			expect(err).toBeInstanceOf(StateError);
			expect((err as PlayerError).code).toBe('core:player/disposed');
		});

		it('dispose() emits "dispose" and transitions to disposed', () => {
			const div = document.createElement('div');
			div.id = 'p7';
			document.body.appendChild(div);
			const p = new MockPlayer('p7');
			let disposed = false;
			p.on('dispose' as any, () => {
				disposed = true;
			});
			p.dispose();
			expect(disposed).toBe(true);
			expect(p.phase()).toBe('disposed');
		});

		it('dispose() is idempotent', () => {
			const div = document.createElement('div');
			div.id = 'p8';
			document.body.appendChild(div);
			const p = new MockPlayer('p8');
			p.dispose();
			expect(() => p.dispose()).not.toThrow();
		});
	});

	// ── BeforeEvent contract via transport ──

	describe('BeforeEvent contract (sync dispatch)', () => {
		it('beforePlay receives mutable data; mutation flows to play event', async () => {
			const p = setupPlayer();
			let received: { source?: string } | undefined;
			p.on('beforePlay' as any, (e: any) => {
				e.data.source = 'remote';
			});
			p.on('play' as any, (data: any) => {
				received = data;
			});
			await p.play({ source: 'user' });
			expect(received?.source).toBe('remote');
		});

		it('preventDefault on beforePlay → playPrevented, no play', async () => {
			const p = setupPlayer();
			let played = false;
			let reason: string | undefined;
			p.on('beforePlay' as any, (e: any) => {
				e.preventDefault();
			});
			p.on('play' as any, () => {
				played = true;
			});
			p.on('playPrevented' as any, (data: any) => {
				reason = data.reason;
			});
			await p.play();
			expect(played).toBe(false);
			expect(reason).toBe('listener-prevented');
		});

		it('stopImmediatePropagation skips later listeners', async () => {
			const p = setupPlayer();
			const calls: string[] = [];
			p.on('beforePlay' as any, (e: any) => {
				calls.push('a');
				e.stopImmediatePropagation();
			});
			p.on('beforePlay' as any, () => {
				calls.push('b');
			});
			await p.play();
			expect(calls).toEqual(['a']);
		});

		it('stamps before-event onto dispatching() while listeners run', async () => {
			const p = setupPlayer();
			let observed: ReadonlyArray<string> | undefined;
			p.on('beforePlay' as any, () => {
				observed = p.dispatching();
			});
			await p.play();
			expect(observed).toEqual(['beforePlay']);
			expect(p.dispatching()).toEqual([]);
		});
	});

	// ── Transport ──

	describe('transport', () => {
		it('play before setup throws core:player/not-ready', async () => {
			const div = document.createElement('div');
			div.id = 'before';
			document.body.appendChild(div);
			const p = new MockPlayer('before');
			let err: unknown;
			try {
				await p.play();
			}
			catch (e) {
				err = e;
			}
			expect(err).toBeInstanceOf(StateError);
			expect((err as PlayerError).code).toBe('core:player/not-ready');
		});

		it('pause emits beforePause + pause', async () => {
			const p = setupPlayer();
			const order: string[] = [];
			p.on('beforePause' as any, () => {
				order.push('beforePause');
			});
			p.on('pause' as any, () => {
				order.push('pause');
			});
			await p.pause();
			expect(order).toEqual(['beforePause', 'pause']);
		});

		it('stop emits beforeStop + stop (cancellable transport pre-event)', async () => {
			const p = setupPlayer();
			const order: string[] = [];
			p.on('beforeStop' as any, () => {
				order.push('beforeStop');
			});
			p.on('stop' as any, () => {
				order.push('stop');
			});
			await p.stop();
			expect(order).toEqual(['beforeStop', 'stop']);
		});

		it('stop respects preventDefault and emits stopPrevented', async () => {
			const p = setupPlayer();
			let stopped = false;
			let prevented: { reason?: string } | undefined;
			p.on('beforeStop' as any, (e: any) => {
				e.preventDefault();
			});
			p.on('stop' as any, () => {
				stopped = true;
			});
			p.on('stopPrevented' as any, (data: any) => {
				prevented = data;
			});
			await p.stop();
			expect(stopped).toBe(false);
			expect(prevented?.reason).toBe('listener-prevented');
		});

		it('togglePlayback toggles between play and pause', async () => {
			const p = setupPlayer();
			let played = 0;
			let paused = 0;
			p.on('play' as any, () => {
				played += 1;
			});
			p.on('pause' as any, () => {
				paused += 1;
			});
			await p.togglePlayback();
			await p.togglePlayback();
			expect(played).toBe(1);
			expect(paused).toBe(1);
		});

		it('rewind emits beforeSeek with negative delta', () => {
			const p = setupPlayer();
			let beforeSeekTime: number | undefined;
			p.on('beforeSeek' as any, (e: any) => {
				beforeSeekTime = e.data.time;
			});
			p.rewind(5);
			expect(beforeSeekTime).toBe(-5);
		});

		it('forward emits beforeSeek with positive delta', () => {
			const p = setupPlayer();
			let beforeSeekTime: number | undefined;
			p.on('beforeSeek' as any, (e: any) => {
				beforeSeekTime = e.data.time;
			});
			p.forward(10);
			expect(beforeSeekTime).toBe(10);
		});

		it('restart seeks to 0 then plays', async () => {
			const p = setupPlayer();
			const order: string[] = [];
			p.on('seek' as any, (data: any) => {
				order.push(`seek:${data.time}`);
			});
			p.on('play' as any, () => {
				order.push('play');
			});
			await p.restart();
			expect(order).toContain('seek:0');
			expect(order[order.length - 1]).toBe('play');
		});
	});

	// ── State enums ──

	describe('state enums', () => {
		it('playState transitions through play/pause/stop', async () => {
			const p = setupPlayer();
			expect(p.playState()).toBe('idle');
			await p.play();
			expect(p.playState()).toBe('playing');
			await p.pause();
			expect(p.playState()).toBe('paused');
			await p.stop();
			expect(p.playState()).toBe('stopped');
		});

		it('repeatState round-trips and emits "repeat"', () => {
			const p = setupPlayer();
			expect(p.repeatState()).toBe('off');
			let emitted: { state: string } | undefined;
			p.on('repeat' as any, (data: any) => {
				emitted = data;
			});
			p.repeatState('all');
			expect(p.repeatState()).toBe('all');
			expect(emitted?.state).toBe('all');
		});

		it('shuffleState accepts a boolean shorthand', () => {
			const p = setupPlayer();
			p.shuffleState(true as any);
			expect(p.shuffleState()).toBe('on');
			p.shuffleState(false as any);
			expect(p.shuffleState()).toBe('off');
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
			const p = new MockPlayer('vp').setup({ defaultVolume: 40 } as any);
			expect(p.volume()).toBe(40);
		});

		it('clamps writes to [0, 100]', () => {
			const p = setupPlayer();
			p.volume(200);
			expect(p.volume()).toBe(100);
			p.volume(-1);
			expect(p.volume()).toBe(0);
		});

		it('mute() returns 0; unmute() restores prior level', () => {
			const p = setupPlayer();
			p.volume(60);
			p.mute();
			expect(p.volume()).toBe(0);
			p.unmute();
			expect(p.volume()).toBe(60);
		});

		it('volumeUp / volumeDown clamp at the bounds', () => {
			const p = setupPlayer();
			p.volume(95);
			p.volumeUp(20);
			expect(p.volume()).toBe(100);
			p.volume(5);
			p.volumeDown(20);
			expect(p.volume()).toBe(0);
		});
	});

	// ── Time ──

	describe('time', () => {
		it('time() read defaults to 0', () => {
			expect(setupPlayer().time()).toBe(0);
		});

		it('time(t) round-trips and emits seek', async () => {
			const p = setupPlayer();
			let seekTime: number | undefined;
			p.on('seek' as any, (data: any) => {
				seekTime = data.time;
			});
			await p.time(15);
			expect(p.time()).toBe(15);
			expect(seekTime).toBe(15);
		});

		it('time(t) preventDefault leaves the value unchanged', async () => {
			const p = setupPlayer();
			await p.time(7);
			p.on('beforeSeek' as any, (e: any) => {
				e.preventDefault();
			});
			await p.time(99);
			expect(p.time()).toBe(7);
		});

		it('playbackRate round-trips and emits backend:ratechange', () => {
			const p = setupPlayer();
			let rate: number | undefined;
			p.on('backend:ratechange' as any, (data: any) => {
				rate = data.rate;
			});
			p.playbackRate(1.5);
			expect(p.playbackRate()).toBe(1.5);
			expect(rate).toBe(1.5);
		});

		it('timeData returns aggregated TimeState shape', async () => {
			const p = setupPlayer();
			await p.time(3);
			const data = p.timeData();
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
			const p = setupPlayer();
			p.addTranslations({ en: { hello: 'world' } });
			expect(p.t('hello')).toBe('world');
		});

		it('t(key, vars) interpolates {var}', () => {
			const p = setupPlayer();
			p.addTranslations({ en: { greet: 'Hi {name}' } });
			expect(p.t('greet', { name: 'Arc' })).toBe('Hi Arc');
		});

		it('removeTranslations strips by prefix', () => {
			const p = setupPlayer();
			p.addTranslations({ en: { 'foo.a': 'A', 'foo.b': 'B' } });
			p.removeTranslations('foo.');
			expect(p.t('foo.a')).toBe('foo.a');
		});
	});

	// ── Cue parser ──

	describe('cue parser', () => {
		it('register + unregister round-trip without throwing', () => {
			const p = setupPlayer();
			const parser = { id: 'p1', canParse: (): boolean => false, parse: (): any => ({ cues: [], duration: 0 }) };
			expect(() => p.registerCueParser(parser as any)).not.toThrow();
			expect(() => p.unregisterCueParser('p1')).not.toThrow();
		});

		it('unregistering an absent id is a no-op', () => {
			expect(() => setupPlayer().unregisterCueParser('absent')).not.toThrow();
		});
	});

	// ── Base URL + audio context ──

	describe('baseUrl + audioContext', () => {
		it('baseUrl read/write round-trips', () => {
			const p = setupPlayer();
			expect(p.baseUrl()).toBeUndefined();
			p.baseUrl('https://example.test/api');
			expect(p.baseUrl()).toBe('https://example.test/api');
		});

		it('config.baseUrl seeds the value at setup', () => {
			const div = document.createElement('div');
			div.id = 'cb';
			document.body.appendChild(div);
			const p = new MockPlayer('cb').setup({ baseUrl: 'https://seeded.test' } as any);
			expect(p.baseUrl()).toBe('https://seeded.test');
		});

		it('audioContext is undefined initially', () => {
			expect(setupPlayer().audioContext()).toBeUndefined();
		});
	});

	// ── Experimental override surface ──

	describe('experimental', () => {
		it('override + restore + overrides round-trip', () => {
			const p = setupPlayer();
			const unbind = p.experimental.override('foo', () => 1);
			expect(p.experimental.overrides().some((o: any) => o.method === 'foo')).toBe(true);
			unbind();
			expect(p.experimental.overrides().some((o: any) => o.method === 'foo')).toBe(false);
		});

		it('restore(name) clears a named method', () => {
			const p = setupPlayer();
			p.experimental.override('bar', () => 2);
			p.experimental.restore('bar');
			expect(p.experimental.overrides().some((o: any) => o.method === 'bar')).toBe(false);
		});
	});

	// ── Queue + cursor + backlog ──

	describe('queue + cursor + backlog', () => {
		const t = (id: string): BasePlaylistItem => ({ id });

		it('queue() empty initially; queue([items]) replaces and emits "queue"', () => {
			const p = setupPlayer();
			expect(p.queue()).toEqual([]);
			let emitted: ReadonlyArray<unknown> | undefined;
			p.on('queue' as any, (items: any) => {
				emitted = items;
			});
			p.queue([t('a'), t('b')]);
			expect(p.queue().length).toBe(2);
			expect(emitted?.length).toBe(2);
		});

		it('queueAppend emits queue:append with from index', () => {
			const p = setupPlayer();
			let from: number | undefined;
			p.on('queue:append' as any, (data: any) => {
				from = data.from;
			});
			p.queue([t('a')]);
			p.queueAppend(t('b'));
			expect(from).toBe(1);
		});

		it('queueRemove emits queue:remove with id', () => {
			const p = setupPlayer();
			let removedId: string | undefined;
			p.on('queue:remove' as any, (data: any) => {
				removedId = data.id;
			});
			p.queue([t('a'), t('b')]);
			p.queueRemove('a');
			expect(removedId).toBe('a');
		});

		it('queueClear emits queue:clear with previousLength', () => {
			const p = setupPlayer();
			let cleared: { previousLength: number } | undefined;
			p.on('queue:clear' as any, (data: any) => {
				cleared = data;
			});
			p.queue([t('a'), t('b'), t('c')]);
			p.queueClear();
			expect(cleared?.previousLength).toBe(3);
			expect(p.queue()).toEqual([]);
		});

		it('item() moves the cursor and emits "item"', () => {
			const p = setupPlayer();
			p.queue([t('a'), t('b'), t('c')]);
			let payload: { index: number } | undefined;
			p.on('item' as any, (data: any) => {
				payload = data;
			});
			p.item('c');
			expect(p.item()?.id).toBe('c');
			expect(payload?.index).toBe(2);
		});

		it('peekNext / peekPrevious work off the cursor', () => {
			const p = setupPlayer();
			p.queue([t('a'), t('b')]);
			expect(p.peekNext()?.id).toBe('b');
			expect(p.peekPrevious()).toBeUndefined();
		});

		it('queueIndexOf returns -1 for unknown ids', () => {
			expect(setupPlayer().queueIndexOf('zzz')).toBe(-1);
		});

		it('backlog([items]) replaces + emits "backlog"', () => {
			const p = setupPlayer();
			let emitted: ReadonlyArray<unknown> | undefined;
			p.on('backlog' as any, (items: any) => {
				emitted = items;
			});
			p.backlog([t('a'), t('b')]);
			expect(emitted?.length).toBe(2);
		});

		it('backlogClear emits backlog:clear', () => {
			const p = setupPlayer();
			let cleared: { previousLength: number } | undefined;
			p.on('backlog:clear' as any, (data: any) => {
				cleared = data;
			});
			p.backlog([t('a')]);
			p.backlogClear();
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
			const p = setupPlayer();
			let payload: { id: string; version: string } | undefined;
			p.on('plugin:installed' as any, (data: any) => {
				payload = data;
			});
			p.addPlugin(HelloPlugin);
			await p.ready();
			const inst = p.getPlugin(HelloPlugin);
			expect(inst?.used).toBe(true);
			expect(payload).toEqual({ id: 'hello', version: '1.0.0' });
		});

		it('addPlugin merges static translations', async () => {
			const p = setupPlayer();
			p.addPlugin(HelloPlugin);
			await p.ready();
			expect(p.t('plugin.hello.greet')).toBe('hi');
		});

		it('addPlugin throws core:plugin/duplicate-id on second add', () => {
			const p = setupPlayer();
			p.addPlugin(HelloPlugin);
			expect(() => p.addPlugin(HelloPlugin)).toThrow(/core:plugin\/duplicate-id/);
		});

		it('addPlugin throws core:plugin/missing-dep when a required plugin is absent', () => {
			const p = setupPlayer();
			expect(() => p.addPlugin(NeedsHelloPlugin)).toThrow(/core:plugin\/missing-dep/);
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

			const p = setupPlayer();

			// Compile-time assertion: passing matching opts compiles without `satisfies`
			// AND without `as`. If P['opts'] inference broke, this line would fail
			// type-checking with "Object literal may only specify known properties..."
			// (extra prop) or "missing property" (required field absent).
			p.addPlugin(TypedPlugin, { answer: 42 });

			// @ts-expect-error — wrong type for `answer` (not assignable to number)
			void (() => p.addPlugin(TypedPlugin, { answer: 'no' }));
			// @ts-expect-error — extra property not on TypedOpts
			void (() => p.addPlugin(TypedPlugin, { answer: 1, bogus: true }));

			await p.ready();

			// At runtime, the plugin received the typed opts.
			const inst = p.getPlugin(TypedPlugin) as (TypedPlugin & { opts: TypedOpts }) | undefined;
			expect(inst?.opts?.answer).toBe(42);
		});

		it('removePlugin disposes + emits plugin:disposed + strips translations', async () => {
			const p = setupPlayer();
			p.addPlugin(HelloPlugin);
			await p.ready();
			const inst = p.getPlugin(HelloPlugin);
			let disposedId: string | undefined;
			p.on('plugin:disposed' as any, (data: any) => {
				disposedId = data.id;
			});
			p.removePlugin(HelloPlugin);
			expect(inst?.disposed).toBe(true);
			expect(disposedId).toBe('hello');
			expect(p.t('plugin.hello.greet')).toBe('plugin.hello.greet');
		});

		it('plugins() lists registered; enabledPlugins() filters disabled', async () => {
			const p = setupPlayer();
			p.addPlugin(HelloPlugin);
			await p.ready();
			expect(p.plugins().length).toBe(1);
			p.getPlugin(HelloPlugin)?.disable();
			expect(p.enabledPlugins().length).toBe(0);
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
