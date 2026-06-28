// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slice 05 — Core: every declared event emits with its payload shape.
 *
 * Scope: events in BaseEventMap whose payloads were not already asserted by
 * the existing transport / lifecycle / plugin tests.
 *
 * Findings recorded inline:
 *  - F1 ('seek' vs 'seeked'): BaseEventMap declares BOTH 'seek' (fires during
 *    the seeking phase, time payload) and 'seeked' (fires after settle, time
 *    payload). Not dual-emission pollution — two distinct declared events with
 *    different semantics (see JSDoc on 'seeked'). No bug.
 *  - F2 ('seeking' event): The spec listed test 3 as "'seeking' event payload".
 *    'seeking' is a PHASE NAME, not an event. BaseEventMap has no 'seeking' key.
 *    The correct test asserts 'seek' (emitted inside _seekingTransition when
 *    time(t) dispatches) with payload { time, source? }.
 *  - F3 ('buffering' event): Not declared in BaseEventMap, not emitted anywhere
 *    in core. 'buffering' is a container CSS class token. Test 6 is marked todo.
 *  - F4 ('playing', 'ended'): Backend-bridge-only — emitted by per-library
 *    _wireBackend, not by core mixins. Cannot test in the core package without
 *    a cross-package import. Tests 1 and 2 are marked todo. Coverage exists in
 *    packages/nomercy-music-player/src/__tests__/wire-backend-regression.test.ts.
 *  - F5 (cast:* namespace): Plugin.emit() ALWAYS namespaces as
 *    'plugin:<id>:<event>'. CastSenderPlugin.emit('cast:connected', ...) fires
 *    'plugin:cast-sender:cast:connected' on the player bus — never bare
 *    'cast:connected'. Confirmed in core/plugin/base.ts line 496. Test 8 (below)
 *    proves this structurally.
 */

import type { SubtitleCueChange } from '../types';
import type { NetworkType } from '../adapters/platform/IPlatform';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
	ShuffleState,
} from '../index';
import type { BaseEventMap, PluginCtorWithId } from '../types';
import { createCueList } from '../core/cues/cue';
import { CueTracker } from '../core/cues/tracker';
import { StubPlayer } from '../testing/stub-player';
import { CastSenderPlugin } from '../plugins/cast-sender';
import { makeFakePlatform } from './helpers/fake-platform';

// ─────────────────────────────────────────────────────────────────────────────
// Shared MockPlayer — mirrors the pattern used in base-player.test.ts
// ─────────────────────────────────────────────────────────────────────────────

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = {} as HTMLElement;

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
	declare subtitle: { (): any; (idx: number | null): void };
	declare queue: { (): ReadonlyArray<any>; (items: any[], opts?: any): void };
	declare item: { (): any; (target: any, opts?: any): void };
	declare index: () => number;
	declare addPlugin: <P extends any>(PluginClass: new () => P, opts?: any) => this;
	declare getPlugin: (PluginClass: any) => any;
	declare plugins: () => ReadonlyArray<any>;

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

function setupPlayer(id: string, config: Record<string, unknown> = {}): MockPlayer {
	const div = document.createElement('div');
	div.id = id;
	document.body.appendChild(div);
	return new MockPlayer(id).setup(config);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('core-events — declared BaseEventMap events emit with payload shape', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	// ── Test 1: 'playing' ─────────────────────────────────────────────────────
	// Finding F4: 'playing' is emitted only by the per-library _wireBackend bridge
	// (nomercy-music-player/src/index.ts line 459). Cannot test in the core
	// package without importing nomercy-music-player. Covered by
	// packages/nomercy-music-player/src/__tests__/wire-backend-regression.test.ts.

	it.todo("'playing' emits after backend fires 'playing' (F4: backend-bridge-only; covered by music-player wire-backend-regression.test.ts)");

	// ── Test 2: 'ended' ───────────────────────────────────────────────────────
	// Finding F4: same as 'playing'. Covered by wire-backend-regression.test.ts.

	it.todo("'ended' emits when backend fires 'ended' + phase → 'ended' (F4: backend-bridge-only; covered by music-player wire-backend-regression.test.ts)");

	// ── Test 3: 'seek' event payload ──────────────────────────────────────────
	// Finding F2: spec named this test "'seeking' event payload" but 'seeking' is
	// a PHASE, not an event. BaseEventMap declares 'seek': { time, source? }
	// (fires during the seeking phase) and 'seeked': { time } (fires after the
	// backend repositions). This test pins the 'seek' payload.

	describe("'seek' event emits with { time } payload when time(t) is called", () => {
		it('emits exactly once with the correct time field', async () => {
			const player = setupPlayer('ce-seek');
			await player.ready();
			await player.play();
			await player.pause();

			const payloads: Array<{ time: number; source?: string }> = [];
			player.on('seek', (data) => {
				payloads.push(data);
			});

			await player.time(45);

			expect(payloads).toHaveLength(1);
			expect(payloads[0]!.time).toBe(45);
		});

		it("also emits 'seeked' with { time } after the seek settles", async () => {
			const player = setupPlayer('ce-seeked');
			await player.ready();
			await player.play();
			await player.pause();

			const seekedPayloads: Array<{ time: number }> = [];
			player.on('seeked', (data) => {
				seekedPayloads.push(data);
			});

			await player.time(30);

			expect(seekedPayloads).toHaveLength(1);
			expect(seekedPayloads[0]!.time).toBe(30);
		});
	});

	// ── Test 4: 'subtitleCue' event ───────────────────────────────────────────
	// Two paths through the code emit 'subtitleCue':
	//   A) subtitle(null) — directly emits { cues: [], language: undefined }
	//   B) sidecar VTT tracker enter/exit — emits { cues: [...], language }
	//
	// Path A is fully synchronous and exercises real mediaTracksMethods.subtitle.
	// Path B requires a CueTracker attached to a player — tested via StubPlayer
	// because CueTracker only needs on/off/emit, not the full MockPlayer.

	describe("'subtitleCue' emits with SubtitleCueChange payload shape", () => {
		it('subtitle(null) emits { cues: [], language: undefined } (off path)', async () => {
			const player = setupPlayer('ce-subtitle-off');
			await player.ready();

			const events: SubtitleCueChange[] = [];
			player.on('subtitleCue', (data) => {
				events.push(data);
			});

			player.subtitle(null);

			expect(events).toHaveLength(1);

			const evt = events[0]!;
			expect(Array.isArray(evt.cues)).toBe(true);
			expect(evt.cues).toHaveLength(0);
			expect(evt).toHaveProperty('language');
		});

		it('CueTracker enter drives subtitleCue payload with cue text and language', () => {
			const stubPlayer = new StubPlayer({ id: 'ce-tracker-stub' });

			const cueList = createCueList<{ text: string; markup?: string }>([
				{ start: 1, end: 5, payload: { text: 'Hello world' } },
			]);

			const tracker = new CueTracker(cueList, { trackerId: 'subtitle-sidecar' });
			const active = new Set<{ payload: { text: string; markup?: string }; start: number; end: number }>();
			const language = 'en';

			const emitChange = (): void => {
				const cues = [...active].map(cue => ({
					text: cue.payload.markup ?? cue.payload.text,
					plainText: cue.payload.text,
					align: 'center' as const,
					size: 100,
				}));
				stubPlayer.emit('subtitleCue', { cues, language });
			};

			tracker.on('enter', (cue) => {
				active.add(cue);
				emitChange();
			});
			tracker.on('exit', (cue) => {
				active.delete(cue);
				emitChange();
			});

			tracker.attach(stubPlayer);

			const events: SubtitleCueChange[] = [];
			stubPlayer.on('subtitleCue', (data) => {
				events.push(data);
			});

			stubPlayer.emit('time', { time: 2 });

			expect(events).toHaveLength(1);

			const evt = events[0]!;
			expect(Array.isArray(evt.cues)).toBe(true);
			expect(evt.cues).toHaveLength(1);
			expect(evt.cues[0]!.text).toBe('Hello world');
			expect(evt.cues[0]!.plainText).toBe('Hello world');
			expect(evt.cues[0]!.align).toBe('center');
			expect(typeof evt.cues[0]!.size).toBe('number');
			expect(evt.language).toBe('en');

			tracker.dispose();
			stubPlayer.reset();
		});
	});

	// ── Test 5: 'shuffle' event ───────────────────────────────────────────────

	describe("'shuffle' emits with { state } payload", () => {
		it('shuffleState(ON) emits shuffle with state ShuffleState.ON', async () => {
			const player = setupPlayer('ce-shuffle');
			await player.ready();

			const events: Array<{ state: ShuffleState }> = [];
			player.on('shuffle', (data) => {
				events.push(data as { state: ShuffleState });
			});

			player.shuffleState(ShuffleState.ON);

			expect(events).toHaveLength(1);
			expect(events[0]!.state).toBe(ShuffleState.ON);
		});

		it('shuffleState(OFF) emits shuffle with state ShuffleState.OFF', async () => {
			const player = setupPlayer('ce-shuffle-off');
			await player.ready();
			player.shuffleState(ShuffleState.ON);

			const events: Array<{ state: ShuffleState }> = [];
			player.on('shuffle', (data) => {
				events.push(data as { state: ShuffleState });
			});

			player.shuffleState(ShuffleState.OFF);

			expect(events).toHaveLength(1);
			expect(events[0]!.state).toBe(ShuffleState.OFF);
		});
	});

	// ── Test 6: 'buffering' ───────────────────────────────────────────────────
	// Finding F3: 'buffering' is NOT declared in BaseEventMap. It is a container
	// CSS class token in container-class-emit, not an event. The spec was wrong.
	// There is no core unit test to write for a non-existent event.

	it.todo("'buffering' event (F3: not declared in BaseEventMap; 'buffering' is a CSS class token, not a player event — no test to write)");

	// ── Test 7: 'network:slow' event ─────────────────────────────────────────
	// _wireNetworkPolicy in lifecycle.ts emits 'network:slow' when the platform's
	// network.subscribe callback fires with { online: true } AND
	// platform.network.downlinkMbps() returns a value < 1.5 AND the prior state
	// was not already slow.

	describe("'network:slow' emits when platform reports slow connection", () => {
		it('emits with { rttMs } payload when downlink < 1.5 Mbps on online transition', async () => {
			let networkCallback: ((state: { online: boolean; type: NetworkType }) => void) | null = null;

			const fakePlatform = makeFakePlatform();

			const slowPlatform = {
				...fakePlatform,
				network: {
					isOnline(): boolean { return true; },
					type(): NetworkType { return 'wifi'; },
					downlinkMbps(): number | undefined { return 0.5; },
					rttMs(): number | undefined { return 150; },
					subscribe(fn: (state: { online: boolean; type: NetworkType }) => void): () => void {
						networkCallback = fn;
						return (): void => { networkCallback = null; };
					},
				},
			};

			const player = setupPlayer('ce-network-slow', {
				platform: slowPlatform,
				onOffline: 'pause',
			});
			await player.ready();

			const events: Array<{ rttMs: number | undefined }> = [];
			player.on('network:slow', (data) => {
				events.push(data);
			});

			expect(networkCallback).not.toBeNull();
			networkCallback!({ online: true, type: 'wifi' });

			expect(events).toHaveLength(1);
			expect(events[0]!.rttMs).toBe(150);
		});

		it('does not emit when downlink is fast (> 1.5 Mbps)', async () => {
			let networkCallback: ((state: { online: boolean; type: NetworkType }) => void) | null = null;

			const fakePlatform = makeFakePlatform();

			const fastPlatform = {
				...fakePlatform,
				network: {
					isOnline(): boolean { return true; },
					type(): NetworkType { return 'wifi'; },
					downlinkMbps(): number | undefined { return 10; },
					rttMs(): number | undefined { return 20; },
					subscribe(fn: (state: { online: boolean; type: NetworkType }) => void): () => void {
						networkCallback = fn;
						return (): void => { networkCallback = null; };
					},
				},
			};

			const player = setupPlayer('ce-network-fast', {
				platform: fastPlatform,
				onOffline: 'continue-buffered',
			});
			await player.ready();

			const events: Array<{ rttMs: number | undefined }> = [];
			player.on('network:slow', (data) => {
				events.push(data);
			});

			networkCallback!({ online: true, type: 'wifi' });

			expect(events).toHaveLength(0);
		});
	});

	// ── Test 8: cast:* namespace check ────────────────────────────────────────
	// Finding F5: Plugin.emit() in core/plugin/base.ts line 496 ALWAYS namespaces
	// the event as 'plugin:<id>:<event>'. CastSenderPlugin.emit('cast:connected')
	// fires 'plugin:cast-sender:cast:connected' on the player bus — not bare
	// 'cast:connected'. This is a structural guarantee of the Plugin base class,
	// not a CastSenderPlugin-specific behaviour.

	describe('cast:* events use plugin namespace, not bare player bus', () => {
		it('CastSenderPlugin.emit fires plugin:cast-sender:cast:connected, not bare cast:connected', () => {
			const player = new StubPlayer({ id: 'ce-cast-ns' });

			const bareEvents: string[] = [];
			const namespacedEvents: string[] = [];

			player.on('all', (eventName: string) => {
				if (eventName === 'cast:connected') {
					bareEvents.push(eventName);
				}
				if (eventName === 'plugin:cast-sender:cast:connected') {
					namespacedEvents.push(eventName);
				}
			});

			const plugin = new CastSenderPlugin();
			const lifecycle = {
				addCleanup: (): void => {},
				listen: (): void => {},
				timeout: (): number => 0,
				interval: (): number => 0,
				frame: (): number => 0,
				abortable: () => new AbortController(),
				isDisposed: (): boolean => false,
				dispose: (): void => {},
			} as any;
			plugin.initialize(player as any, {} as any, lifecycle);
			plugin.use();

			(plugin as unknown as { emit: (event: string, data: unknown) => void }).emit('cast:connected', { deviceName: 'Test TV' });

			expect(bareEvents).toHaveLength(0);
			expect(namespacedEvents).toHaveLength(1);

			player.reset();
		});
	});
});
