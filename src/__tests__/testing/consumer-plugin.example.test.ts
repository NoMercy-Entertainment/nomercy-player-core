// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * CONSUMER EXAMPLE — copy-paste starting point for testing your own plugin.
 *
 * This file demonstrates the exact pattern an external consumer follows when
 * testing a custom plugin with the kit's conformance helper. The import path
 * below is the published subpath — use it exactly as written in your project:
 *
 *   import { describePlugin } from '@nomercy-entertainment/nomercy-player-core/testing';
 *
 * What the kit asserts automatically:
 *   - `use()` runs without throwing
 *   - `dispose()` runs without throwing
 *   - No event-bus listener leak (listener count returns to baseline after dispose)
 *
 * Add your own behavior assertions inside the `describePlugin` callback, as
 * shown in the sections below.
 *
 * Running the suite:
 *   npx vitest run
 *
 * The vitest config must have `test.globals: true` for the DSL globals
 * (`describe`, `it`, `expect`, `beforeEach`, `afterEach`) to be available.
 */

import type { BaseEventMap, IPlayer } from '../../types';

import { describe, expect, it, vi } from 'vitest';

import { Plugin } from '../../core/plugin';
// A consumer outside this repo writes:
//   import { describePlugin, StubPlayer }
//     from '@nomercy-entertainment/nomercy-player-core/testing';
//
// Inside this repo tests resolve via relative paths because the package is not
// installed as a node_modules dependency of itself. The relative path below and
// the published subpath export refer to exactly the same module.
import { describePlugin, StubPlayer } from '../../testing';

// ── Example custom plugin ─────────────────────────────────────────────────────
//
// A realistic, minimal plugin a consumer might write: it listens to the
// player's `play` event, applies a "playback started" effect (here, emitting
// its own plugin event and flipping an internal flag), and cleans up on
// dispose.  The pattern below matches every requirement of the Plugin Standard:
//   - static id / version / description
//   - typed options interface
//   - typed event map via the E generic
//   - on() / emit() through the protected helpers (no raw player.on)
//   - no raw setTimeout / localStorage / console.log

/** Options accepted by {@link PlaybackTrackerPlugin}. */
export interface PlaybackTrackerOptions {
	/**
	 * Maximum number of play events to record before the plugin stops tracking.
	 * Defaults to `Infinity` (no cap).
	 */
	maxEvents?: number;
}

/** Events emitted by {@link PlaybackTrackerPlugin}. */
export interface PlaybackTrackerEvents {
	/** Emitted each time a play event is recorded. */
	'tracked': { count: number };
	/** Emitted when the cap set by `maxEvents` is reached. */
	'cap-reached': { cap: number };
}

/**
 * Example consumer plugin. Tracks how many times `play` fires, emits
 * `plugin:playback-tracker:tracked` on each one, and optionally caps at
 * `maxEvents`.
 *
 * This is a self-contained illustration — copy and adapt it for your own plugin.
 */
export class PlaybackTrackerPlugin
	extends Plugin<IPlayer<BaseEventMap>, PlaybackTrackerOptions, PlaybackTrackerEvents> {
	static override readonly id: string = 'playback-tracker';
	static override readonly version: string = '1.0.0';
	static override readonly description: string = 'Example consumer plugin — counts play events';

	private _count: number = 0;
	private _capped: boolean = false;

	/** Current number of recorded play events. */
	playCount(): number {
		return this._count;
	}

	/** Whether the plugin has stopped tracking due to reaching `maxEvents`. */
	isCapped(): boolean {
		return this._capped;
	}

	override use(): void {
		this.on('play', () => {
			if (this._capped)
				return;

			this._count++;
			this.emit('tracked', { count: this._count });

			const cap = this.opts?.maxEvents;
			if (cap !== undefined && this._count >= cap) {
				this._capped = true;
				this.emit('cap-reached', { cap });
			}
		});
	}

	override dispose(): void {
		this._count = 0;
		this._capped = false;
	}

	protected override getRuntimeState(): Record<string, unknown> {
		return {
			count: this._count,
			capped: this._capped,
		};
	}
}

// ── Kit conformance test ──────────────────────────────────────────────────────
//
// `describePlugin` handles the boring parts:
//   - fresh player + plugin per test (no cross-test pollution)
//   - calls initialize() / use() in beforeEach
//   - calls dispose() in afterEach
//   - asserts listener count returns to baseline (zero-leak guarantee)
//
// You add your own behavior assertions inside the callback.

describePlugin(PlaybackTrackerPlugin, (ctx) => {
	// ── Kit guarantees (always checked by describePlugin) ─────────────────────
	//
	// These don't need explicit assertions — describePlugin enforces them for
	// every test. They are shown here as comments so you know what you get free.
	//
	//   - ctx.plugin is an instance of PlaybackTrackerPlugin
	//   - ctx.player is a StubPlayer (IPlayer-compliant, no real media element)
	//   - use() completed without throwing
	//   - After the test: dispose() ran and listener count returned to baseline

	// ── Behavior assertions (your additions) ──────────────────────────────────

	describe('initial state', () => {
		it('starts with zero play events recorded', () => {
			expect(ctx.plugin.playCount()).toBe(0);
		});

		it('starts uncapped', () => {
			expect(ctx.plugin.isCapped()).toBe(false);
		});

		it('state().runtime reports count and capped', () => {
			const runtime = ctx.plugin.state().runtime;
			expect(runtime['count']).toBe(0);
			expect(runtime['capped']).toBe(false);
		});
	});

	describe('tracking play events', () => {
		it('increments count each time play fires', () => {
			ctx.player.emit('play', undefined as any);
			ctx.player.emit('play', undefined as any);
			expect(ctx.plugin.playCount()).toBe(2);
		});

		it('emits plugin:playback-tracker:tracked with the running count', () => {
			const received: Array<{ count: number }> = [];
			const handler = (data: { count: number }): void => { received.push(data); };
			ctx.player.on('plugin:playback-tracker:tracked' as any, handler);

			ctx.player.emit('play', undefined as any);
			ctx.player.emit('play', undefined as any);

			ctx.player.off('plugin:playback-tracker:tracked' as any, handler);

			expect(received).toEqual([{ count: 1 }, { count: 2 }]);
		});
	});

	describe('maxEvents cap', () => {
		it('stops tracking after maxEvents play events', () => {
			ctx.plugin.options({ maxEvents: 2 });
			ctx.player.emit('play', undefined as any);
			ctx.player.emit('play', undefined as any);
			ctx.player.emit('play', undefined as any);

			expect(ctx.plugin.playCount()).toBe(2);
			expect(ctx.plugin.isCapped()).toBe(true);
		});

		it('emits plugin:playback-tracker:cap-reached when the cap is hit', () => {
			const capEvents: Array<{ cap: number }> = [];
			const handler = (data: { cap: number }): void => { capEvents.push(data); };
			ctx.player.on('plugin:playback-tracker:cap-reached' as any, handler);

			ctx.plugin.options({ maxEvents: 1 });
			ctx.player.emit('play', undefined as any);

			ctx.player.off('plugin:playback-tracker:cap-reached' as any, handler);

			expect(capEvents).toHaveLength(1);
			expect(capEvents[0]).toEqual({ cap: 1 });
		});

		it('emits cap-reached exactly once even when more play events arrive', () => {
			const capHandler = vi.fn();
			ctx.player.on('plugin:playback-tracker:cap-reached' as any, capHandler);

			ctx.plugin.options({ maxEvents: 1 });
			ctx.player.emit('play', undefined as any);
			ctx.player.emit('play', undefined as any);
			ctx.player.emit('play', undefined as any);

			ctx.player.off('plugin:playback-tracker:cap-reached' as any, capHandler);

			expect(capHandler).toHaveBeenCalledTimes(1);
		});
	});

	describe('options() hot-reload', () => {
		it('applies a new maxEvents cap mid-session', () => {
			ctx.player.emit('play', undefined as any);
			expect(ctx.plugin.isCapped()).toBe(false);

			ctx.plugin.options({ maxEvents: 1 });
			ctx.player.emit('play', undefined as any);
			expect(ctx.plugin.isCapped()).toBe(true);
		});
	});
});

// ── Using a custom StubPlayer factory ─────────────────────────────────────────
//
// When your plugin needs a pre-configured player (specific phase, seeded
// translations, injected auth) pass `createPlayer` to the options bag.

describePlugin(PlaybackTrackerPlugin, (ctx) => {
	it('works with a custom player factory', () => {
		expect(ctx.player.playerId).toBe('my-app-player');
	});
}, {
	createPlayer: () => new StubPlayer({ id: 'my-app-player' }),
});

// ── Using assertNoListenerLeak directly ───────────────────────────────────────
//
// `describePlugin` runs the leak assertion automatically after every test. You
// can also call the standalone helper for one-off checks outside the DSL, for
// example to assert that a *pair* of plugins cleans up together.

describe('standalone leak harness example', () => {
	it('the plugin registers and disposes cleanly outside describePlugin', async () => {
		const { LifecycleRegistry } = await import('../../adapters/lifecycle-registry/default');
		const player = new StubPlayer();
		const lifecycle = new LifecycleRegistry();
		const plugin = new PlaybackTrackerPlugin();

		const before = (player as unknown as { listenerCount?: () => number }).listenerCount?.() ?? 0;

		plugin.initialize(player as unknown as IPlayer, {}, lifecycle);
		plugin.use();

		plugin.dispose();
		lifecycle.dispose();

		const after = (player as unknown as { listenerCount?: () => number }).listenerCount?.() ?? 0;
		expect(after - before).toBe(0);
	});
});
