// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slice 04 — Adapter-injection DI proof.
 *
 * Every setup() option that accepts an injected adapter is proven here to route
 * through the INJECTED object, not the default. Tests assert call counts / spy
 * results — not just that setup ran without throwing.
 *
 * Each test MUST fail if the injection is silently bypassed (i.e. if the `??`
 * fallback fires instead of using the provided adapter).
 */

import type { IPreloadStrategy, ITransitionStrategy } from '../adapters/preload/default';
import type { BaseEventMap, BasePlaylistItem, PluginCtorWithId } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';
import { makeFakeLogger } from './helpers/fake-logger';
import { makeFakePlatform } from './helpers/fake-platform';
import { makeFakePreloadStrategy } from './helpers/fake-preload-strategy';
import { makeFakeShuffleStrategy } from './helpers/fake-shuffle-strategy';
import { makeFakeTransitionStrategy } from './helpers/fake-transition-strategy';
import { makeFakeTranslator } from './helpers/fake-translator';
import { makeFakeUrlResolver } from './helpers/fake-url-resolver';

// ── MockPlayer (same minimal shape used in base-player.test.ts) ───────────────

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = <HTMLElement>{};

	get id(): string { return this.playerId; }

	declare options: any;
	declare setup: (config: any) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare phase: () => string;
	declare dispatching: () => ReadonlyArray<string>;
	declare setupState: () => any;
	declare baseUrl: { (): string | undefined; (url: string): void };
	declare audioContext: () => AudioContext | undefined;
	declare experimental: any;
	declare t: {
		(key: string, vars?: Record<string, string>): string;
		(PluginClass: PluginCtorWithId, key: string, vars?: Record<string, string>): string;
	};

	declare language: { (): string; (lang: string): Promise<void> };
	declare addTranslations: (bundle: any) => void;
	declare translation: { (lang: string, key: string): string | undefined; (lang: string, key: string, value: string): void };
	declare removeTranslations: (prefix: string, lang?: string) => void;
	declare registerCueParser: (parser: any, prepend?: boolean) => void;
	declare unregisterCueParser: (id: string) => void;
	declare resolveUrl: (url: string, category?: string) => Promise<any>;
	declare urlResolver: { (): any; (fn: any): void };
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
	declare bufferedRanges: () => TimeRanges;
	declare seekable: () => TimeRanges;
	declare timeData: () => any;
	declare seekByPercentage: (pct: number, opts?: any) => void;
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
	declare addPlugin: (PluginClass: any, opts?: any) => this;
	declare getPlugin: (PluginClass: any) => any;
	declare getPluginById: (id: string) => any;
	declare removePlugin: (PluginClass: any) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<any>;
	declare enabledPlugins: () => ReadonlyArray<any>;
	declare setPreloadStrategy: (strategy: IPreloadStrategy) => void;
	declare setTransitionStrategy: (strategy: ITransitionStrategy) => void;
	declare preloadStrategy: () => IPreloadStrategy;
	declare transitionStrategy: () => ITransitionStrategy;
	declare platform: () => any;
	declare auth: any;
	declare hasAuth: () => boolean;
	declare refreshAuth: () => Promise<void>;
	declare baseImageUrl: { (): string | undefined; (url: string): void };
	declare cueParsers: () => any[];
	declare load: (url: string, opts?: any) => Promise<void>;
	declare pushDispatch: (name: string) => void;
	declare popDispatch: () => string | undefined;

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

// ── Helpers ───────────────────────────────────────────────────────────────────

let divCounter = 0;

function makeDiv(id: string): HTMLDivElement {
	const div = document.createElement('div');
	div.id = id;
	document.body.appendChild(div);
	return div;
}

function makeItem(id: string): BasePlaylistItem {
	return { id };
}

function buildPlayer(config: Record<string, unknown> = {}): MockPlayer {
	const divId = `di-test-${++divCounter}`;
	makeDiv(divId);
	return new MockPlayer(divId).setup(config);
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('adapter-injection', () => {
	beforeEach(() => { MockPlayer._resetRegistry(); });
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
		divCounter = 0;
	});

	it('logger injection — setup routes log calls through the injected logger', async () => {
		const fakeLogger = makeFakeLogger();
		const player = buildPlayer({ logger: fakeLogger, logLevel: 'debug' });

		await player.ready();

		expect(fakeLogger.calls.length).toBeGreaterThan(0);
	});

	it('platform injection — visibility.subscribe called on the injected platform when pauseWhenHidden is true', async () => {
		const fakePlatform = makeFakePlatform();
		const player = buildPlayer({ platform: fakePlatform, pauseWhenHidden: true });

		await player.ready();

		expect(fakePlatform.visibilitySubscribeCalls).toBe(1);
	});

	it('translator injection — t() routes through the injected translator', async () => {
		const fakeTranslator = makeFakeTranslator();
		const player = buildPlayer({ translator: fakeTranslator });

		await player.ready();

		const result = player.t('hello');

		expect(result).toBe('FAKE:hello');
		expect(fakeTranslator.translateCalls).toContain('hello');
	});

	it('urlResolver injection — resolveUrl() calls the injected resolver', async () => {
		const fakeResolver = makeFakeUrlResolver();
		const player = buildPlayer({ urlResolver: fakeResolver });

		await player.ready();

		const resolved = await player.resolveUrl('/asset.mp4', 'media');

		expect(resolved.href).toBe('RESOLVED');
		expect(fakeResolver.resolveCalls).toContain('/asset.mp4');
	});

	it('shuffleStrategy injection — queueShuffle() calls the injected strategy', async () => {
		const fakeStrategy = makeFakeShuffleStrategy();
		const player = buildPlayer({ shuffleStrategy: fakeStrategy });

		await player.ready();

		const a = makeItem('a');
		const b = makeItem('b');
		const c = makeItem('c');
		player.queue([a, b, c]);

		player.queueShuffle();

		expect(fakeStrategy.shuffleCalled).toBe(true);

		const ids = (player.queue() as ReadonlyArray<BasePlaylistItem>).map(i => i.id);
		expect(ids).toEqual(['c', 'b', 'a']);
	});

	it('preloadStrategy injection — injected shouldPreload is called on a time tick', async () => {
		const fakeStrategy = makeFakePreloadStrategy();
		const player = buildPlayer({ preloadStrategy: fakeStrategy });

		await player.ready();

		player.queue([makeItem('current'), makeItem('next')]);
		player.item('current');

		const internals = player as any;
		internals._internalDuration = 60;

		player.emit('time', { time: 55 });

		expect(fakeStrategy.shouldPreloadCalls).toBeGreaterThanOrEqual(1);
	});

	it('transitionStrategy injection — injected shouldTransition is called on a time tick', async () => {
		const fakeStrategy = makeFakeTransitionStrategy();
		const player = buildPlayer({
			transitionStrategy: fakeStrategy,
			crossfadeEnabled: true,
		});

		await player.ready();

		player.queue([makeItem('current'), makeItem('next')]);
		player.item('current');

		const internals = player as any;
		internals._internalDuration = 60;

		player.emit('time', { time: 55 });

		expect(fakeStrategy.shouldTransitionCalls).toBeGreaterThanOrEqual(1);
	});
});
