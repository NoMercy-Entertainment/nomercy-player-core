// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slice 02 — deep behavioral unit tests for core transport/time/volume/state/phase.
 *
 * Each test pins a CONSEQUENCE: a state change, an emitted event, a thrown error,
 * or a side effect on the backend. No test merely asserts "no throw" or "returned
 * something".
 *
 * GREEN fixes applied in this slice (see Findings below):
 *   - `time(t)` now calls `_assertReady()` before the seek (was missing, HIGH).
 *   - `playbackRate(r)` now clamps to [0.25, 2] (v1 oracle contract, MEDIUM).
 *
 * RED / deferred:
 *   - Test 6: `unmute()` emits `'mute'` with `{ muted: false }`, not a separate
 *     `'unmute'` event. The event map has no `'unmute'` key — this is the
 *     intentional design. The spec description was misleading. Test asserts the
 *     real contract.
 */

import type { BackendShape } from '../core/mixins/player-state';
import type {
	Plugin,
} from '../index';
import type { BaseEventMap, PluginCtorWithId } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	RepeatState,
	resolvePlayerConstructor,
	StateError,
} from '../index';

// ── Local MockPlayer (same shape as base-player.test.ts) ──────────────────────

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

	backend?: () => unknown;

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
	div.id = 'mock-depth';
	document.body.appendChild(div);
	return new MockPlayer('mock-depth').setup({});
}

describe('transport-depth (slice 02)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	// ── Test 1: stop() drives playState to 'stopped' AND calls backend.stop ──

	it('stop() sets playState to "stopped" and calls backend.stop()', async () => {
		const player = setupPlayer();

		let stopCallCount = 0;
		const mockBackend: BackendShape = {
			play: async (): Promise<void> => {},
			stop: (): void => {
				stopCallCount += 1;
			},
		};
		(player as unknown as { backend: () => BackendShape }).backend = (): BackendShape => mockBackend;

		await player.play();
		expect(player.playState()).toBe('playing');

		await player.stop();

		expect(player.playState()).toBe('stopped');
		expect(stopCallCount).toBe(1);
	});

	// ── Test 2: time(t) before setup throws core:player/not-ready ────────────
	// GREEN fix: _assertReady() added to time() setter path in time.ts.

	it('time(t) before setup throws StateError with code core:player/not-ready', async () => {
		const div = document.createElement('div');
		div.id = 'time-presetup';
		document.body.appendChild(div);
		const player = new MockPlayer('time-presetup');

		let thrown: unknown;
		try {
			await player.time(10);
		}
		catch (e) {
			thrown = e;
		}

		expect(thrown).toBeInstanceOf(StateError);
		expect((thrown as { code: string }).code).toBe('core:player/not-ready');
	});

	// ── Test 3: phase() during dispose listener sees 'disposing' then 'disposed' ──

	it('phase() inside dispose listener is "disposing"; after dispose() returns it is "disposed"', () => {
		const player = setupPlayer();
		let phaseInsideListener = '';

		player.on('dispose' as any, () => {
			phaseInsideListener = player.phase();
		});

		player.dispose();

		expect(phaseInsideListener).toBe('disposing');
		expect(player.phase()).toBe('disposed');
	});

	// ── Test 4: next() on empty queue resolves without throwing and emits no 'item' ──

	it('next() on an empty queue resolves without throwing and fires no "item" event', async () => {
		const player = setupPlayer();
		let itemFired = false;

		player.on('item' as any, () => {
			itemFired = true;
		});

		await player.next();

		expect(itemFired).toBe(false);
	});

	// ── Test 5: volume(v) emits 'volume' event with { level: newValue } ──────

	it('volume(v) emits "volume" event with the new level and volume() returns it', () => {
		const player = setupPlayer();
		let emittedLevel: number | undefined;

		player.on('volume' as any, (data: { level: number }) => {
			emittedLevel = data.level;
		});

		player.volume(42);

		expect(emittedLevel).toBe(42);
		expect(player.volume()).toBe(42);
	});

	// ── Test 6: mute() emits 'mute' with { muted: true }; unmute() emits 'mute' with { muted: false } ──
	//
	// NOTE: The spec description named a separate 'unmute' event. The event map has no
	// 'unmute' key — the design uses a single 'mute' event with { muted: boolean }.
	// This test pins the REAL contract. See Findings: MEDIUM — spec description was
	// misleading but the implementation is intentional (matches the event map).

	it('mute() emits "mute" with { muted: true }; unmute() emits "mute" with { muted: false }', () => {
		const player = setupPlayer();
		const mutePayloads: Array<{ muted: boolean }> = [];

		player.on('mute' as any, (data: { muted: boolean }) => {
			mutePayloads.push({ muted: data.muted });
		});

		player.mute();
		player.unmute();

		expect(mutePayloads).toHaveLength(2);
		expect(mutePayloads[0]).toEqual({ muted: true });
		expect(mutePayloads[1]).toEqual({ muted: false });
	});

	// ── Test 7: playbackRate(0) is clamped to 0.25 (v1 oracle: clamp [0.25, 2]) ──
	// GREEN fix: clamp applied in time.ts playbackRate setter.

	it('playbackRate(0) is clamped to 0.25 and backend:ratechange carries the clamped value', () => {
		const player = setupPlayer();
		let emittedRate: number | undefined;

		player.on('backend:ratechange' as any, (data: { rate: number }) => {
			emittedRate = data.rate;
		});

		player.playbackRate(0);

		expect(player.playbackRate()).toBeGreaterThan(0);
		expect(player.playbackRate()).toBe(0.25);
		expect(emittedRate).toBe(0.25);
	});

	it('playbackRate(3) is clamped to 2', () => {
		const player = setupPlayer();
		player.playbackRate(3);
		expect(player.playbackRate()).toBe(2);
	});

	// ── Test 8: 'repeat' event carries the new state in its payload ───────────

	it('"repeat" event payload contains the new repeatState value', () => {
		const player = setupPlayer();
		let repeatPayload: { state: string } | undefined;

		player.on('repeat' as any, (data: { state: string }) => {
			repeatPayload = data;
		});

		player.repeatState(RepeatState.ALL);

		expect(repeatPayload).toBeDefined();
		expect(repeatPayload?.state).toBe(RepeatState.ALL);
	});
});
