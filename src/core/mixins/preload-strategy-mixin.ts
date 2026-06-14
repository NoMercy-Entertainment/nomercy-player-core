// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { IPreloadStrategy, ITransitionStrategy } from '../../adapters/preload/default';

import type { Internals } from '../state';

/**
 * The preload/transition mixin's slice of player state — composed into
 * `PlayerCoreState`. The `setPreloadStrategy()` / `setTransitionStrategy()`
 * swappers here write these; the setup-stage config-application and the preload
 * orchestrator in `lifecycle.ts` write them too.
 */
export interface PreloadStrategyState {
	/** Active preload strategy. Set from config or `setPreloadStrategy()`. */
	_preloadStrategy: IPreloadStrategy;

	/** Active transition strategy. Set from config or `setTransitionStrategy()`. */
	_transitionStrategy: ITransitionStrategy;

	/** `true` after `shouldPreload` returns `true` for the current cursor position. Reset on `current` change. */
	_preloadFired: boolean;

	/** `true` after `shouldTransition` returns `true` for the current cursor. Reset on `current` change. */
	_transitionFired: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// Mixin: preload + transition strategy swappers
// ──────────────────────────────────────────────────────────────────────────

export const preloadStrategyMethods = {
	/**
	 * Replace the active preload strategy at runtime. The new strategy takes
	 * effect on the next `time` tick. Cancels any in-flight prefetch first.
	 */
	setPreloadStrategy(this: Internals, strategy: IPreloadStrategy): void {
		this._preloadStrategy.cancel();
		this._preloadFired = false;
		this._preloadStrategy = strategy;
	},

	/**
	 * Replace the active transition strategy at runtime. Cancels any in-progress
	 * transition first (emitting `transitionCancelled`).
	 */
	setTransitionStrategy(this: Internals, strategy: ITransitionStrategy): void {
		if (this._transitionRafHandle !== undefined) {
			cancelAnimationFrame(this._transitionRafHandle);
			this._transitionRafHandle = undefined;
		}
		this._transitionStrategy.cancel('strategy-replaced');
		this.emit('transitionCancelled', { reason: 'strategy-replaced' });
		this._transitionFired = false;
		this._transitionStrategy = strategy;
	},

	/** Return the active preload strategy instance. */
	preloadStrategy(this: Internals): IPreloadStrategy {
		return this._preloadStrategy;
	},

	/** Return the active transition strategy instance. */
	transitionStrategy(this: Internals): ITransitionStrategy {
		return this._transitionStrategy;
	},
} as const;
