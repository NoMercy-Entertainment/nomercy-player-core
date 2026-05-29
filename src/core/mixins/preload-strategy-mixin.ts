import type { PreloadStrategy, TransitionStrategy } from '../../adapters/preload/default';

import type { Internals } from '../state';

// ──────────────────────────────────────────────────────────────────────────
// Mixin: preload + transition strategy swappers
// ──────────────────────────────────────────────────────────────────────────

export const preloadStrategyMethods = {
	/**
	 * Replace the active preload strategy at runtime. The new strategy takes
	 * effect on the next `time` tick. Cancels any in-flight prefetch first.
	 */
	setPreloadStrategy(this: Internals, strategy: PreloadStrategy): void {
		this._preloadStrategy.cancel();
		this._preloadFired = false;
		this._preloadStrategy = strategy;
	},

	/**
	 * Replace the active transition strategy at runtime. Cancels any in-progress
	 * transition first (emitting `transitionCancelled`).
	 */
	setTransitionStrategy(this: Internals, strategy: TransitionStrategy): void {
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
	preloadStrategy(this: Internals): PreloadStrategy {
		return this._preloadStrategy;
	},

	/** Return the active transition strategy instance. */
	transitionStrategy(this: Internals): TransitionStrategy {
		return this._transitionStrategy;
	},
} as const;
