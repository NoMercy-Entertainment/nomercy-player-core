// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended coverage for `playerStateMethods`.
 *
 * Pinned consequences:
 *  PS-E1. qualityMode(number) switches to MANUAL, emits `qualityState`
 *         with `{ state: QualityState.MANUAL }`, forwards to backend.
 *  PS-E2. qualityMode() getter returns current QualityState without emitting.
 *  PS-E3. audioTrackMode(idx) stores MANUAL, emits `audioTrackState`,
 *         forwards idx to backend.setAudioTrack.
 *  PS-E4. audioTrackMode() getter returns current AudioTrackState.
 *  PS-E5. networkState() returns SLOW when monitor.downlinkMbps() < 1.5.
 *  PS-E6. networkState() returns OFFLINE when monitor.isOnline() is false.
 *  PS-E7. networkState() returns ONLINE when no monitor is attached.
 *  PS-E8. qualityMode('auto') emits `qualityState` with QualityState.AUTO.
 */

import type { IPlatform } from '../adapters/platform/IPlatform';
import type { BackendShape } from '../core/mixins/player-state';
import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AudioTrackState,
	BufferState,
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	NetworkState,
	playerCoreMethods,
	QualityState,
	resolvePlayerConstructor,
	VisibilityState,
} from '../index';

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = {} as HTMLElement;

	get id(): string {
		return this.playerId;
	}

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare qualityMode: { (): QualityState; (target: number | 'auto'): void };
	declare audioTrackMode: { (): AudioTrackState; (idx: number): void };
	declare networkState: () => NetworkState;
	declare bufferState: () => BufferState;

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

function wireBackend(player: MockPlayer, backend: Partial<BackendShape> & { setQuality?: (idx: number | 'auto') => void; setAudioTrack?: (idx: number) => void; state?: () => string }): void {
	(player as unknown as { backend: () => unknown }).backend = (): unknown => backend;
}

function wirePlatform(player: MockPlayer, platform: Partial<IPlatform>): void {
	(player as unknown as { _platform: Partial<IPlatform> })._platform = platform;
}

describe('playerStateMethods — extended (PS-E)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	describe('qualityMode() getter/setter + emission', () => {
		it('PS-E1: qualityMode(number) sets MANUAL, emits qualityState, forwards to backend', () => {
			const player = makePlayer('pse-1');
			const setQualityCalls: Array<number | 'auto'> = [];
			wireBackend(player, { setQuality: (idx): void => { setQualityCalls.push(idx); } });

			const emitted: Array<{ state: QualityState }> = [];
			player.on('qualityState' as keyof BaseEventMap, (data: unknown) => {
				emitted.push(data as { state: QualityState });
			});

			player.qualityMode(2);

			expect(player.qualityMode()).toBe(QualityState.MANUAL);
			expect(emitted).toHaveLength(1);
			expect(emitted[0]!.state).toBe(QualityState.MANUAL);
			expect(setQualityCalls).toEqual([2]);
		});

		it('PS-E2: qualityMode() getter returns current state without emitting', () => {
			const player = makePlayer('pse-2');

			const emitted: unknown[] = [];
			player.on('qualityState' as keyof BaseEventMap, (data: unknown) => {
				emitted.push(data);
			});

			const result = player.qualityMode();

			expect(result).toBe(QualityState.AUTO);
			expect(emitted).toHaveLength(0);
		});

		it('PS-E8: qualityMode("auto") emits qualityState with QualityState.AUTO', () => {
			const player = makePlayer('pse-8');
			const emitted: Array<{ state: QualityState }> = [];
			player.on('qualityState' as keyof BaseEventMap, (data: unknown) => {
				emitted.push(data as { state: QualityState });
			});

			player.qualityMode(1);
			player.qualityMode('auto');

			expect(player.qualityMode()).toBe(QualityState.AUTO);
			expect(emitted).toHaveLength(2);
			expect(emitted[1]!.state).toBe(QualityState.AUTO);
		});
	});

	describe('audioTrackMode() getter/setter', () => {
		it('PS-E3: audioTrackMode(idx) stores MANUAL, emits audioTrackState, forwards to backend', () => {
			const player = makePlayer('pse-3');
			const setAudioTrackCalls: number[] = [];
			wireBackend(player, { setAudioTrack: (idx): void => { setAudioTrackCalls.push(idx); } });

			const emitted: Array<{ state: AudioTrackState }> = [];
			player.on('audioTrackState' as keyof BaseEventMap, (data: unknown) => {
				emitted.push(data as { state: AudioTrackState });
			});

			player.audioTrackMode(1);

			expect(player.audioTrackMode()).toBe(AudioTrackState.MANUAL);
			expect(emitted).toHaveLength(1);
			expect(emitted[0]!.state).toBe(AudioTrackState.MANUAL);
			expect(setAudioTrackCalls).toEqual([1]);
		});

		it('PS-E4: audioTrackMode() getter returns current AudioTrackState without emitting', () => {
			const player = makePlayer('pse-4');

			const emitted: unknown[] = [];
			player.on('audioTrackState' as keyof BaseEventMap, (data: unknown) => {
				emitted.push(data);
			});

			const result = player.audioTrackMode();

			expect(result).toBe(AudioTrackState.DEFAULT);
			expect(emitted).toHaveLength(0);
		});
	});

	describe('_transitionPhase no-op when same phase', () => {
		it('does not emit phase event when transitioning to current phase', () => {
			const player = makePlayer('pse-noop');
			(player as unknown as { _transitionPhase: (phase: string) => void })._transitionPhase('idle');

			const phases: unknown[] = [];
			player.on('phase' as keyof BaseEventMap, (data: unknown) => { phases.push(data); });

			(player as unknown as { _transitionPhase: (phase: string) => void })._transitionPhase('idle');

			expect(phases).toHaveLength(0);
		});
	});

	describe('_peekBackend() error swallowing', () => {
		it('returns undefined when backend() throws', () => {
			const player = makePlayer('pse-peek');
			(player as unknown as { backend: () => unknown }).backend = (): never => {
				throw new Error('backend-threw');
			};

			const result = (player as unknown as { _peekBackend: () => unknown })._peekBackend();

			expect(result).toBeUndefined();
		});
	});

	describe('bufferState() switch branches', () => {
		it('returns LOADING when backend state is "loading"', () => {
			const player = makePlayer('pse-buf-load');
			wireBackend(player, { state: (): string => 'loading' });

			expect(player.bufferState()).toBe(BufferState.LOADING);
		});

		it('returns SEEKING when backend state is "seeking"', () => {
			const player = makePlayer('pse-buf-seek');
			wireBackend(player, { state: (): string => 'seeking' });

			expect(player.bufferState()).toBe(BufferState.SEEKING);
		});

		it('returns STALLED when backend state is "stalled"', () => {
			const player = makePlayer('pse-buf-stall');
			wireBackend(player, { state: (): string => 'stalled' });

			expect(player.bufferState()).toBe(BufferState.STALLED);
		});
	});

	describe('_assertReady() guard branches', () => {
		it('throws core:player/disposed when phase is "disposed"', () => {
			const player = makePlayer('pse-disposed');
			const setup = player.setup as unknown as ((config: Record<string, unknown>) => MockPlayer);
			setup.call(player, {});
			(player as unknown as { _phase: string })._phase = 'disposed';

			const assertReady = (player as unknown as { _assertReady: () => void })._assertReady.bind(player);
			expect(assertReady).toThrow();
		});
	});

	describe('streamState()', () => {
		it('returns "idle" when no backend is wired', () => {
			const player = makePlayer('pse-stream-1');

			const result = (player as unknown as { streamState: () => string }).streamState();

			expect(result).toBe('idle');
		});

		it('returns backend state string when backend is wired', () => {
			const player = makePlayer('pse-stream-2');
			wireBackend(player, { state: (): string => 'playing' });

			const result = (player as unknown as { streamState: () => string }).streamState();

			expect(result).toBe('playing');
		});

		it('returns "idle" when backend has no state() method', () => {
			const player = makePlayer('pse-stream-3');
			wireBackend(player, {});

			const result = (player as unknown as { streamState: () => string }).streamState();

			expect(result).toBe('idle');
		});
	});

	describe('visibilityState()', () => {
		it('returns HIDDEN when platform visibility.isVisible() returns false', () => {
			const player = makePlayer('pse-vis-1');
			wirePlatform(player, {
				visibility: {
					isVisible: (): boolean => false,
					subscribe: vi.fn() as unknown as IPlatform['visibility']['subscribe'],
				},
			} as Partial<IPlatform>);

			const result = (player as unknown as { visibilityState: () => unknown }).visibilityState();
			expect(result).toBe(VisibilityState.HIDDEN);
		});

		it('returns VISIBLE when no platform monitor is attached', () => {
			const player = makePlayer('pse-vis-2');
			(player as unknown as { _platform: undefined })._platform = undefined;

			const result = (player as unknown as { visibilityState: () => unknown }).visibilityState();
			expect(result).toBe(VisibilityState.VISIBLE);
		});
	});

	describe('networkState() — platform monitor mock', () => {
		it('PS-E5: returns SLOW when downlinkMbps() < 1.5 and isOnline() is true', () => {
			const player = makePlayer('pse-5');
			wirePlatform(player, {
				network: {
					isOnline: (): boolean => true,
					downlinkMbps: (): number => 0.8,
					type: vi.fn() as unknown as () => ReturnType<IPlatform['network']['type']>,
					rttMs: vi.fn() as unknown as () => number | undefined,
					subscribe: vi.fn() as unknown as IPlatform['network']['subscribe'],
				},
			} as Partial<IPlatform>);

			expect(player.networkState()).toBe(NetworkState.SLOW);
		});

		it('PS-E6: returns OFFLINE when monitor.isOnline() is false', () => {
			const player = makePlayer('pse-6');
			wirePlatform(player, {
				network: {
					isOnline: (): boolean => false,
					downlinkMbps: (): number | undefined => undefined,
					type: vi.fn() as unknown as () => ReturnType<IPlatform['network']['type']>,
					rttMs: vi.fn() as unknown as () => number | undefined,
					subscribe: vi.fn() as unknown as IPlatform['network']['subscribe'],
				},
			} as Partial<IPlatform>);

			expect(player.networkState()).toBe(NetworkState.OFFLINE);
		});

		it('PS-E7: returns ONLINE when no platform monitor is attached', () => {
			const player = makePlayer('pse-7');

			(player as unknown as { _platform: undefined })._platform = undefined;

			expect(player.networkState()).toBe(NetworkState.ONLINE);
		});

		it('returns ONLINE when downlinkMbps returns exactly 1.5 (boundary — not below threshold)', () => {
			const player = makePlayer('pse-boundary');
			wirePlatform(player, {
				network: {
					isOnline: (): boolean => true,
					downlinkMbps: (): number => 1.5,
					type: vi.fn() as unknown as () => ReturnType<IPlatform['network']['type']>,
					rttMs: vi.fn() as unknown as () => number | undefined,
					subscribe: vi.fn() as unknown as IPlatform['network']['subscribe'],
				},
			} as Partial<IPlatform>);

			expect(player.networkState()).toBe(NetworkState.ONLINE);
		});

		it('returns ONLINE when downlinkMbps returns undefined (API absent)', () => {
			const player = makePlayer('pse-undef');
			wirePlatform(player, {
				network: {
					isOnline: (): boolean => true,
					downlinkMbps: (): undefined => undefined,
					type: vi.fn() as unknown as () => ReturnType<IPlatform['network']['type']>,
					rttMs: vi.fn() as unknown as () => number | undefined,
					subscribe: vi.fn() as unknown as IPlatform['network']['subscribe'],
				},
			} as Partial<IPlatform>);

			expect(player.networkState()).toBe(NetworkState.ONLINE);
		});
	});
});
