// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * M1 (Connect-plugin effort): every actionable/command event gets a dedicated
 * cancellable `before*` hook. This file locks the cancellation contract for
 * the ten hooks added to `BaseEventMap` — `beforeVolume`, `beforeMute`,
 * `beforeRepeat`, `beforeShuffle`, `beforePlaybackRate`, `beforeLanguage`,
 * `beforeSubtitle`, `beforeAudioTrack`, `beforeDispose`, `beforeTransfer`.
 *
 * Each block proves three things, not just "an event fired":
 *  1. A baseline call with NO listener proceeds (the action's normal path
 *     still works — the hook doesn't silently swallow anything).
 *  2. `preventDefault()` in a listener stops the actual state mutation dead —
 *     asserted by reading back the STATE, not just observing the prevented
 *     event.
 *  3. The paired `<hook>Prevented` event fires with `reason: 'listener-prevented'`.
 *
 * `beforeVolume` / `beforePlaybackRate` additionally prove they fire with NO
 * `mutationGuards` config set at all — the whole point of carving them out of
 * `HOT_MUTATIONS` (see `state-mutators.ts`) is that a Connect plugin must be
 * able to intercept them without opting the player into the generic guard
 * surface.
 */

import type { BaseEventMap, BeforeEvent, CastTarget } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	RepeatState,
	resolvePlayerConstructor,
	ShuffleState,
} from '../index';

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
	declare dispose: () => Promise<void>;
	declare phase: () => string;

	declare volume: { (): number; (level: number): Promise<void> };
	declare mute: () => Promise<void>;
	declare unmute: () => Promise<void>;

	declare repeatState: { (): RepeatState; (state: RepeatState): Promise<void> };
	declare shuffleState: { (): ShuffleState; (state: ShuffleState | boolean): Promise<void> };
	declare playbackRate: { (): number; (rate: number): Promise<void> };

	declare language: { (): string; (lang: string): Promise<void> };

	declare subtitle: { (): unknown; (idx: number | null): Promise<void> };
	declare audioTrack: { (): unknown; (idx: number): Promise<void> };

	declare castState: () => string;
	declare transferTo: (target: CastTarget) => Promise<void>;

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

function setupPlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId).setup({});
}

/** Generic `{ reason, cause? }` shape shared by every `*Prevented` event. */
interface PreventedPayload {
	reason: string;
	cause?: unknown;
}

describe('Connect before* hooks — cancellation contract', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	// ── beforeVolume / volumePrevented ────────────────────────────────────────

	describe('beforeVolume', () => {
		it('fires with NO mutationGuards config set — proceeds when not prevented (baseline)', async () => {
			const player = setupPlayer('bh-volume-baseline');
			expect(player.volume()).toBe(100);

			await player.volume(42);

			expect(player.volume()).toBe(42);
		});

		it('preventDefault() blocks the level change and fires volumePrevented', async () => {
			const player = setupPlayer('bh-volume-cancel');
			const before = player.volume();

			let prevented: PreventedPayload | undefined;
			player.on('beforeVolume' as never, (event: BeforeEvent<{ level: number }>) => {
				event.preventDefault();
			});
			player.on('volumePrevented' as never, (data: PreventedPayload) => { prevented = data; });

			await player.volume(75);

			expect(player.volume()).toBe(before);
			expect(prevented).toEqual({ reason: 'listener-prevented' });
		});
	});

	// ── beforeMute / mutePrevented (covers both mute() and unmute()) ──────────

	describe('beforeMute', () => {
		it('mute() with no listener proceeds (baseline)', async () => {
			const player = setupPlayer('bh-mute-baseline');
			await player.mute();
			expect(player.volume()).toBe(0);
		});

		it('preventDefault() blocks mute() and fires mutePrevented', async () => {
			const player = setupPlayer('bh-mute-cancel');
			await player.volume(60);

			let prevented: PreventedPayload | undefined;
			player.on('beforeMute' as never, (event: BeforeEvent<{ muted: boolean }>) => {
				event.preventDefault();
			});
			player.on('mutePrevented' as never, (data: PreventedPayload) => { prevented = data; });

			await player.mute();

			expect(player.volume()).toBe(60);
			expect(prevented).toEqual({ reason: 'listener-prevented' });
		});

		it('preventDefault() blocks unmute() and fires mutePrevented', async () => {
			const player = setupPlayer('bh-unmute-cancel');
			await player.volume(60);
			await player.mute();
			expect(player.volume()).toBe(0);

			let prevented: PreventedPayload | undefined;
			player.on('beforeMute' as never, (event: BeforeEvent<{ muted: boolean }>) => {
				event.preventDefault();
			});
			player.on('mutePrevented' as never, (data: PreventedPayload) => { prevented = data; });

			await player.unmute();

			expect(player.volume()).toBe(0);
			expect(prevented).toEqual({ reason: 'listener-prevented' });
		});
	});

	// ── beforeRepeat / repeatPrevented ────────────────────────────────────────

	describe('beforeRepeat', () => {
		it('repeatState(state) with no listener proceeds (baseline)', async () => {
			const player = setupPlayer('bh-repeat-baseline');
			await player.repeatState(RepeatState.ALL);
			expect(player.repeatState()).toBe(RepeatState.ALL);
		});

		it('preventDefault() blocks the repeat-mode change and fires repeatPrevented', async () => {
			const player = setupPlayer('bh-repeat-cancel');
			expect(player.repeatState()).toBe(RepeatState.OFF);

			let prevented: PreventedPayload | undefined;
			player.on('beforeRepeat' as never, (event: BeforeEvent<{ state: RepeatState }>) => {
				event.preventDefault();
			});
			player.on('repeatPrevented' as never, (data: PreventedPayload) => { prevented = data; });

			await player.repeatState(RepeatState.ALL);

			expect(player.repeatState()).toBe(RepeatState.OFF);
			expect(prevented).toEqual({ reason: 'listener-prevented' });
		});
	});

	// ── beforeShuffle / shufflePrevented ──────────────────────────────────────

	describe('beforeShuffle', () => {
		it('shuffleState(state) with no listener proceeds (baseline)', async () => {
			const player = setupPlayer('bh-shuffle-baseline');
			await player.shuffleState(ShuffleState.ON);
			expect(player.shuffleState()).toBe(ShuffleState.ON);
		});

		it('preventDefault() blocks the shuffle-mode change and fires shufflePrevented', async () => {
			const player = setupPlayer('bh-shuffle-cancel');
			expect(player.shuffleState()).toBe(ShuffleState.OFF);

			let prevented: PreventedPayload | undefined;
			player.on('beforeShuffle' as never, (event: BeforeEvent<{ state: ShuffleState }>) => {
				event.preventDefault();
			});
			player.on('shufflePrevented' as never, (data: PreventedPayload) => { prevented = data; });

			await player.shuffleState(ShuffleState.ON);

			expect(player.shuffleState()).toBe(ShuffleState.OFF);
			expect(prevented).toEqual({ reason: 'listener-prevented' });
		});

		it('preventDefault() also works when called via the boolean shorthand', async () => {
			const player = setupPlayer('bh-shuffle-cancel-bool');

			let prevented: PreventedPayload | undefined;
			player.on('beforeShuffle' as never, (event: BeforeEvent<{ state: ShuffleState }>) => {
				event.preventDefault();
			});
			player.on('shufflePrevented' as never, (data: PreventedPayload) => { prevented = data; });

			await player.shuffleState(true);

			expect(player.shuffleState()).toBe(ShuffleState.OFF);
			expect(prevented).toEqual({ reason: 'listener-prevented' });
		});
	});

	// ── beforePlaybackRate / playbackRatePrevented ────────────────────────────

	describe('beforePlaybackRate', () => {
		it('fires with NO mutationGuards config set — proceeds when not prevented (baseline)', async () => {
			const player = setupPlayer('bh-rate-baseline');
			expect(player.playbackRate()).toBe(1);

			await player.playbackRate(1.5);

			expect(player.playbackRate()).toBe(1.5);
		});

		it('preventDefault() blocks the rate change and fires playbackRatePrevented', async () => {
			const player = setupPlayer('bh-rate-cancel');
			const before = player.playbackRate();

			let prevented: PreventedPayload | undefined;
			player.on('beforePlaybackRate' as never, (event: BeforeEvent<{ rate: number }>) => {
				event.preventDefault();
			});
			player.on('playbackRatePrevented' as never, (data: PreventedPayload) => { prevented = data; });

			await player.playbackRate(1.75);

			expect(player.playbackRate()).toBe(before);
			expect(prevented).toEqual({ reason: 'listener-prevented' });
		});
	});

	// ── beforeLanguage / languagePrevented ────────────────────────────────────

	describe('beforeLanguage', () => {
		it('language(tag) with no listener proceeds (baseline)', async () => {
			const player = setupPlayer('bh-language-baseline');
			await player.language('nl');
			expect(player.language()).toBe('nl');
		});

		it('preventDefault() blocks the language switch and fires languagePrevented', async () => {
			const player = setupPlayer('bh-language-cancel');
			const before = player.language();

			let prevented: PreventedPayload | undefined;
			player.on('beforeLanguage' as never, (event: BeforeEvent<{ lang: string }>) => {
				event.preventDefault();
			});
			player.on('languagePrevented' as never, (data: PreventedPayload) => { prevented = data; });

			await player.language('fr');

			expect(player.language()).toBe(before);
			expect(prevented).toEqual({ reason: 'listener-prevented' });
		});
	});

	// ── beforeSubtitle / subtitlePrevented ────────────────────────────────────

	describe('beforeSubtitle', () => {
		it('subtitle(idx) with no listener proceeds (baseline)', async () => {
			const player = setupPlayer('bh-subtitle-baseline');
			await player.subtitle(0);
			expect((player as unknown as { _currentSubtitleIdx: number | null })._currentSubtitleIdx).toBe(0);
		});

		it('preventDefault() blocks the subtitle-track change and fires subtitlePrevented', async () => {
			const player = setupPlayer('bh-subtitle-cancel');
			const internals = player as unknown as { _currentSubtitleIdx: number | null };
			expect(internals._currentSubtitleIdx).toBeNull();

			let prevented: PreventedPayload | undefined;
			player.on('beforeSubtitle' as never, (event: BeforeEvent<{ track: number | null }>) => {
				event.preventDefault();
			});
			player.on('subtitlePrevented' as never, (data: PreventedPayload) => { prevented = data; });

			await player.subtitle(0);

			expect(internals._currentSubtitleIdx).toBeNull();
			expect(prevented).toEqual({ reason: 'listener-prevented' });
		});
	});

	// ── beforeAudioTrack / audioTrackPrevented ────────────────────────────────

	describe('beforeAudioTrack', () => {
		it('audioTrack(idx) with no listener proceeds (baseline)', async () => {
			const player = setupPlayer('bh-audiotrack-baseline');
			await player.audioTrack(0);
			expect((player as unknown as { _currentAudioTrackIdx: number | null })._currentAudioTrackIdx).toBe(0);
		});

		it('preventDefault() blocks the audio-track change and fires audioTrackPrevented', async () => {
			const player = setupPlayer('bh-audiotrack-cancel');
			const internals = player as unknown as { _currentAudioTrackIdx: number | null };
			expect(internals._currentAudioTrackIdx).toBeNull();

			let prevented: PreventedPayload | undefined;
			player.on('beforeAudioTrack' as never, (event: BeforeEvent<{ id: number }>) => {
				event.preventDefault();
			});
			player.on('audioTrackPrevented' as never, (data: PreventedPayload) => { prevented = data; });

			await player.audioTrack(0);

			expect(internals._currentAudioTrackIdx).toBeNull();
			expect(prevented).toEqual({ reason: 'listener-prevented' });
		});
	});

	// ── beforeDispose / disposePrevented ──────────────────────────────────────

	describe('beforeDispose', () => {
		it('dispose() with no listener proceeds (baseline)', async () => {
			const player = setupPlayer('bh-dispose-baseline');
			await player.dispose();
			expect(player.phase()).toBe('disposed');
		});

		it('preventDefault() blocks teardown entirely and fires disposePrevented', async () => {
			const player = setupPlayer('bh-dispose-cancel');
			await player.ready();
			expect(player.phase()).toBe('ready');

			let prevented: PreventedPayload | undefined;
			player.on('beforeDispose' as never, (event: BeforeEvent<void>) => {
				event.preventDefault();
			});
			player.on('disposePrevented' as never, (data: PreventedPayload) => { prevented = data; });

			await player.dispose();

			expect(player.phase()).toBe('ready');
			expect(prevented).toEqual({ reason: 'listener-prevented' });

			// The player is still fully alive — a real dispose() (no listener)
			// still works after the prevented attempt.
			player.off('beforeDispose' as never);
			await player.dispose();
			expect(player.phase()).toBe('disposed');
		});
	});

	// ── beforeTransfer / transferPrevented ────────────────────────────────────

	describe('beforeTransfer', () => {
		it('transferTo(\'local\') with no listener proceeds (baseline)', async () => {
			const player = setupPlayer('bh-transfer-baseline');
			await player.transferTo('local');
			// 'local' resolves to DISCONNECTED — proves the switch body ran.
			expect(player.castState()).toBe('disconnected');
		});

		it('preventDefault() blocks the handoff entirely and fires transferPrevented', async () => {
			const player = setupPlayer('bh-transfer-cancel');
			const before = player.castState();

			let prevented: PreventedPayload | undefined;
			player.on('beforeTransfer' as never, (event: BeforeEvent<{ target: CastTarget }>) => {
				event.preventDefault();
			});
			player.on('transferPrevented' as never, (data: PreventedPayload) => { prevented = data; });

			await player.transferTo('local');

			expect(player.castState()).toBe(before);
			expect(prevented).toEqual({ reason: 'listener-prevented' });
		});
	});
});
