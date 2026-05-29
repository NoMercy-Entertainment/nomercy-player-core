/**
 * Tests for the generic preload + transition strategy machinery wired into
 * the player core. Uses the same MockPlayer pattern as base-player.test.ts.
 *
 * Coverage:
 *  - DefaultPreloadStrategy.shouldPreload timing
 *  - `preloadStart` / `preloadProgress` / `preloadComplete` event sequence
 *  - Transition gate fires `transitionStart` / `transitionProgress` / `transitionComplete`
 *  - Cursor change resets preload + transition flags
 *  - setPreloadStrategy / setTransitionStrategy swap at runtime
 *  - GaplessTransitionStrategy never fires transition events
 *  - CrossfadeTransitionStrategy fires transition events when crossfadeEnabled
 */

import type { IPreloadStrategy, ITransitionStrategy } from '../adapters/preload/default';
import type { Plugin } from '../core/plugin';
import type { BaseEventMap, BasePlaylistItem } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	CrossfadeTransitionStrategy,
	DefaultPreloadStrategy,
	EventEmitter,
	GaplessTransitionStrategy,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';

// ── MockPlayer (same shape as base-player.test.ts) ───────────────────────────

const _instances = new Map<string, PreloadTestPlayer>();

class PreloadTestPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = <HTMLElement>{};

	get id(): string {
		return this.playerId;
	}

	declare options: any;
	declare setup: (config: any) => this;
	declare dispose: () => void;
	declare phase: () => string;
	declare current: { (): any; (target: any, opts?: any): void };
	declare queue: { (): ReadonlyArray<any>; (items: any[], opts?: any): void };
	declare queueAppend: (item: any, opts?: any) => void;
	declare queueLength: () => number;
	declare peekNext: () => any;
	declare currentTime: { (): number; (t: number, opts?: any): Promise<void> };
	declare duration: () => number;
	declare play: (opts?: any) => Promise<void>;
	declare pause: (opts?: any) => Promise<void>;
	declare stop: (opts?: any) => Promise<void>;
	declare next: (opts?: any) => Promise<void>;
	declare previous: (opts?: any) => Promise<void>;
	declare volume: { (): number; (v: number): void };
	declare addPlugin: <P extends Plugin>(PluginClass: new () => P, opts?: P['opts']) => this;
	declare getPlugin: (PluginClass: any) => any;
	declare removePlugin: (PluginClass: any) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<any>;
	declare enabledPlugins: () => ReadonlyArray<any>;
	declare setPreloadStrategy: (strategy: IPreloadStrategy) => void;
	declare setTransitionStrategy: (strategy: ITransitionStrategy) => void;
	declare preloadStrategy: () => IPreloadStrategy;
	declare transitionStrategy: () => ITransitionStrategy;

	// stub remaining required mixin surfaces
	declare ready: () => Promise<void>;
	declare dispatching: () => ReadonlyArray<string>;
	declare baseUrl: { (): string | undefined; (url: string): void };
	declare audioContext: () => AudioContext | undefined;
	declare experimental: any;
	declare t: (key: string, vars?: Record<string, string>) => string;
	declare language: { (): string; (lang: string): Promise<void> };
	declare addTranslations: (bundle: any) => void;
	declare translation: (lang: string, key: string, value: string) => void;
	declare removeTranslations: (prefix: string, lang?: string) => void;
	declare registerCueParser: (parser: any, prepend?: boolean) => void;
	declare unregisterCueParser: (id: string) => void;
	declare rewind: (seconds?: number, opts?: any) => Promise<void>;
	declare forward: (seconds?: number, opts?: any) => Promise<void>;
	declare restart: (opts?: any) => Promise<void>;
	declare togglePlayback: (opts?: any) => Promise<void>;
	declare buffered: () => number;
	declare bufferedRanges: () => TimeRanges;
	declare seekable: () => TimeRanges;
	declare timeData: () => any;
	declare seekByPercentage: (pct: number, opts?: any) => void;
	declare playbackRate: { (): number; (rate: number): void };
	declare playbackRates: () => number[];
	declare mute: () => void;
	declare unmute: () => void;
	declare toggleMute: () => void;
	declare volumeUp: (step?: number) => void;
	declare volumeDown: (step?: number) => void;
	declare playState: () => string;
	declare volumeState: () => string;
	declare repeatState: { (): string; (state: any): void };
	declare shuffleState: { (): string; (state: any): void };
	declare queuePrepend: (item: any, opts?: any) => void;
	declare queueInsert: (item: any, index: number, opts?: any) => void;
	declare queueRemove: (id: any, opts?: any) => void;
	declare queueRemoveAt: (index: number, opts?: any) => void;
	declare queueMove: (from: number, to: number, opts?: any) => void;
	declare queueClear: (opts?: any) => void;
	declare queueShuffle: (opts?: any) => void;
	declare queueSort: (compare: any, opts?: any) => void;
	declare peekPrevious: () => any;
	declare currentIndex: () => number;
	declare queueIndexOf: (id: any) => number;
	declare backlog: { (): ReadonlyArray<any>; (items: any[]): void };
	declare backlogAppend: (item: any) => void;
	declare backlogRemove: (id: any) => void;
	declare backlogClear: () => void;
	declare getPluginById: (id: string) => any;
	declare setupState: () => any;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'PreloadTestPlayer' });

		const resolved = resolvePlayerConstructor(id, _instances, 'PreloadTestPlayer');
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

composeMixins(PreloadTestPlayer.prototype, ...playerCoreMethods);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDiv(id: string): HTMLDivElement {
	const div = document.createElement('div');
	div.id = id;
	document.body.appendChild(div);
	return div;
}

function makeItem(id: string): BasePlaylistItem {
	return { id };
}

let divCounter = 0;

function setupPlayer(config: Record<string, unknown> = {}): PreloadTestPlayer {
	const divId = `preload-test-${++divCounter}`;
	makeDiv(divId);
	return new PreloadTestPlayer(divId).setup(config);
}

// ── DefaultPreloadStrategy ────────────────────────────────────────────────────

describe('DefaultPreloadStrategy', () => {
	it('returns false when duration is 0', () => {
		const strategy = new DefaultPreloadStrategy(10);
		expect(strategy.shouldPreload({ currentTime: 5, duration: 0, nextItem: makeItem('x') })).toBe(false);
	});

	it('returns false when nextItem is null', () => {
		const strategy = new DefaultPreloadStrategy(10);
		expect(strategy.shouldPreload({ currentTime: 55, duration: 60, nextItem: null })).toBe(false);
	});

	it('returns false before the lead window', () => {
		const strategy = new DefaultPreloadStrategy(10);
		expect(strategy.shouldPreload({ currentTime: 45, duration: 60, nextItem: makeItem('x') })).toBe(false);
	});

	it('returns true exactly at duration - leadSeconds', () => {
		const strategy = new DefaultPreloadStrategy(10);
		expect(strategy.shouldPreload({ currentTime: 50, duration: 60, nextItem: makeItem('x') })).toBe(true);
	});

	it('returns true after the lead window', () => {
		const strategy = new DefaultPreloadStrategy(10);
		expect(strategy.shouldPreload({ currentTime: 58, duration: 60, nextItem: makeItem('x') })).toBe(true);
	});

	it('assetsToPreload returns empty array by default', () => {
		const strategy = new DefaultPreloadStrategy(10);
		expect(strategy.assetsToPreload(makeItem('x'))).toEqual([]);
	});

	it('cancel() is a no-op when nothing is in flight', () => {
		const strategy = new DefaultPreloadStrategy(10);
		expect(() => strategy.cancel()).not.toThrow();
	});
});

// ── GaplessTransitionStrategy ─────────────────────────────────────────────────

describe('GaplessTransitionStrategy', () => {
	it('shouldTransition always returns false', () => {
		const strategy = new GaplessTransitionStrategy();
		expect(strategy.shouldTransition({ currentTime: 57, duration: 60, nextItem: makeItem('x') })).toBe(false);
	});
});

// ── CrossfadeTransitionStrategy ───────────────────────────────────────────────

describe('CrossfadeTransitionStrategy', () => {
	it('returns false before the lead window', () => {
		const strategy = new CrossfadeTransitionStrategy({ leadSeconds: 3 });
		expect(strategy.shouldTransition({ currentTime: 50, duration: 60, nextItem: makeItem('x') })).toBe(false);
	});

	it('returns true at duration - leadSeconds', () => {
		const strategy = new CrossfadeTransitionStrategy({ leadSeconds: 3 });
		expect(strategy.shouldTransition({ currentTime: 57, duration: 60, nextItem: makeItem('x') })).toBe(true);
	});

	it('returns false when nextItem is null', () => {
		const strategy = new CrossfadeTransitionStrategy({ leadSeconds: 3 });
		expect(strategy.shouldTransition({ currentTime: 59, duration: 60, nextItem: null })).toBe(false);
	});
});

// ── Orchestration: preload events ─────────────────────────────────────────────

describe('preload orchestration', () => {
	beforeEach(() => { PreloadTestPlayer._resetRegistry(); });
	afterEach(() => {
		PreloadTestPlayer._resetRegistry();
		document.body.innerHTML = '';
		divCounter = 0;
	});

	it('emits preloadStart + preloadComplete when strategy fires and no assets returned', async () => {
		const player = setupPlayer({ preloadLeadSeconds: 10 });
		const nextItem = makeItem('next-1');
		player.queue([makeItem('a'), nextItem]);
		player.current('a');

		const events: string[] = [];
		player.on('preloadStart', () => events.push('preloadStart'));
		player.on('preloadComplete', () => events.push('preloadComplete'));

		// Simulate _internalDuration + time tick that triggers the gate
		const internals = player as any;
		internals._internalDuration = 60;
		internals._queueList.move(0, 0);

		// Emit a time event at duration - leadSeconds
		player.emit('time', { time: 50 });

		// Wait a tick for async preload to complete
		await new Promise(resolve => setTimeout(resolve, 10));

		expect(events).toContain('preloadStart');
		expect(events).toContain('preloadComplete');
	});

	it('preloadStart fires only once per item', async () => {
		const player = setupPlayer({ preloadLeadSeconds: 10 });
		const nextItem = makeItem('next-2');
		player.queue([makeItem('b'), nextItem]);
		player.current('b');

		let startCount = 0;
		player.on('preloadStart', () => { startCount++; });

		const internals = player as any;
		internals._internalDuration = 60;

		player.emit('time', { time: 50 });
		player.emit('time', { time: 51 });
		player.emit('time', { time: 52 });

		await new Promise(resolve => setTimeout(resolve, 10));

		expect(startCount).toBe(1);
	});

	it('cursor change resets the preload flag', async () => {
		const player = setupPlayer({ preloadLeadSeconds: 10 });
		const itemA = makeItem('cursor-a');
		const itemB = makeItem('cursor-b');
		const itemC = makeItem('cursor-c');
		player.queue([itemA, itemB, itemC]);
		player.current('cursor-a');

		let startCount = 0;
		player.on('preloadStart', () => { startCount++; });

		const internals = player as any;
		internals._internalDuration = 60;

		// First preload fires
		player.emit('time', { time: 50 });
		await new Promise(resolve => setTimeout(resolve, 10));
		expect(startCount).toBe(1);

		// Cursor change resets flag — next preload should fire again
		player.current('cursor-b');
		internals._internalDuration = 60;

		player.emit('time', { time: 50 });
		await new Promise(resolve => setTimeout(resolve, 10));
		expect(startCount).toBe(2);
	});
});

// ── Orchestration: transition events ─────────────────────────────────────────

describe('transition orchestration', () => {
	beforeEach(() => { PreloadTestPlayer._resetRegistry(); });
	afterEach(() => {
		PreloadTestPlayer._resetRegistry();
		document.body.innerHTML = '';
		divCounter = 0;
		vi.restoreAllMocks();
	});

	it('does NOT emit transitionStart when crossfadeEnabled is false (default)', () => {
		const player = setupPlayer({ crossfadeEnabled: false, crossfadeLeadSeconds: 3 });
		const nextItem = makeItem('trans-next-1');
		player.queue([makeItem('trans-a'), nextItem]);
		player.current('trans-a');

		let transitionStartFired = false;
		player.on('transitionStart', () => { transitionStartFired = true; });

		const internals = player as any;
		internals._internalDuration = 60;

		player.emit('time', { time: 57 });

		expect(transitionStartFired).toBe(false);
	});

	it('emits transitionStart when crossfadeEnabled is true and lead window reached', () => {
		vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0);

		const player = setupPlayer({
			crossfadeEnabled: true,
			crossfadeLeadSeconds: 3,
			transitionStrategy: new CrossfadeTransitionStrategy({ leadSeconds: 3 }),
		});
		const nextItem = makeItem('trans-next-2');
		player.queue([makeItem('trans-b'), nextItem]);
		player.current('trans-b');

		let transitionStartPayload: unknown = null;
		player.on('transitionStart', (data) => { transitionStartPayload = data; });

		const internals = player as any;
		internals._internalDuration = 60;

		player.emit('time', { time: 57 });

		expect(transitionStartPayload).not.toBeNull();
		expect(transitionStartPayload).toMatchObject({
			incoming: nextItem,
		});
	});

	it('transitionStart fires only once per item even with repeated time ticks', () => {
		vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0);

		const player = setupPlayer({
			crossfadeEnabled: true,
			crossfadeLeadSeconds: 3,
			transitionStrategy: new CrossfadeTransitionStrategy({ leadSeconds: 3 }),
		});
		player.queue([makeItem('trans-c'), makeItem('trans-c-next')]);
		player.current('trans-c');

		let startCount = 0;
		player.on('transitionStart', () => { startCount++; });

		const internals = player as any;
		internals._internalDuration = 60;

		player.emit('time', { time: 57 });
		player.emit('time', { time: 58 });
		player.emit('time', { time: 59 });

		expect(startCount).toBe(1);
	});
});

// ── setPreloadStrategy / setTransitionStrategy swappers ──────────────────────

describe('strategy swappers', () => {
	beforeEach(() => { PreloadTestPlayer._resetRegistry(); });
	afterEach(() => {
		PreloadTestPlayer._resetRegistry();
		document.body.innerHTML = '';
		divCounter = 0;
	});

	it('setPreloadStrategy replaces the active strategy', () => {
		const player = setupPlayer({ preloadLeadSeconds: 10 });
		const customStrategy: IPreloadStrategy = {
			shouldPreload: () => false,
			assetsToPreload: () => [],
			cancel: () => {},
		};
		player.setPreloadStrategy(customStrategy);
		expect(player.preloadStrategy()).toBe(customStrategy);
	});

	it('setTransitionStrategy replaces the active strategy', () => {
		vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
		const player = setupPlayer({});
		const customStrategy: ITransitionStrategy = {
			shouldTransition: () => false,
			tick: () => {},
			start: () => {},
			complete: () => {},
			cancel: () => {},
		};
		player.setTransitionStrategy(customStrategy);
		expect(player.transitionStrategy()).toBe(customStrategy);
	});

	it('custom preloadStrategy from config is respected', async () => {
		const customShouldPreload = vi.fn().mockReturnValue(false);
		const customStrategy: IPreloadStrategy = {
			shouldPreload: customShouldPreload,
			assetsToPreload: () => [],
			cancel: () => {},
		};
		const player = setupPlayer({ preloadStrategy: customStrategy });

		const internals = player as any;
		internals._internalDuration = 60;

		player.emit('time', { time: 50 });
		player.emit('time', { time: 55 });

		expect(customShouldPreload).toHaveBeenCalled();
	});
});
