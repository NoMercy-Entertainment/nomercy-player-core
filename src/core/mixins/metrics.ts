import type { PlaybackMetrics } from '../../types';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: metrics / clock / accessibility — grouped because they share the
// same "instrumentation surface" semantics across both libraries.
// ──────────────────────────────────────────────────────────────────────────

export const metricsMethods = {
	/**
	 * Snapshot of current playback metrics. Spreads the running counters tracked
	 * by the backend (`ttfb`, `avgBitrate`, `droppedFrames`, ...) and appends a
	 * live `sessionDurationMs` derived from when the current item started. The
	 * same shape is emitted periodically as `playback:metrics`.
	 */
	metrics(this: Internals): PlaybackMetrics {
		return {
			...this._metrics,
			sessionDurationMs: this._metricsStartedAt ? Date.now() - this._metricsStartedAt : 0,
		};
	},
	/** Write a single named counter into the live metrics store. Backends call this to update their instrumented values; consumers may also use it for custom counters. */
	recordMetric(this: Internals, name: string, value: number): void {
		this._metrics[name] = value;
	},
	/**
	 * Distributed-clock timestamp source. Returns `options.clockSource()` if
	 * configured, else `Date.now()`. Used by the kit's auth / event timestamps
	 * + plugins coordinating across machines.
	 */
	now(this: Internals): number {
		const cs = this.options?.clockSource;
		return typeof cs === 'function' ? cs() : Date.now();
	},
	/**
	 * ARIA-live announcement. Inserts a transient element under the player
	 * container with `aria-live="polite"` (or `"assertive"` per the level arg)
	 * and removes it on the next animation frame so the DOM doesn't grow.
	 */
	announce(this: Internals, text: string, level?: 'polite' | 'assertive'): void {
		if (typeof document === 'undefined' || !this.container)
			return;
		const node = document.createElement('div');
		node.setAttribute('role', 'status');
		node.setAttribute('aria-live', level === 'assertive' ? 'assertive' : 'polite');
		node.style.position = 'absolute';
		node.style.left = '-9999px';
		node.style.width = '1px';
		node.style.height = '1px';
		node.style.overflow = 'hidden';
		node.textContent = text;
		this.container.appendChild(node);
		// Remove after a tick so screen readers have time to pick it up.
		setTimeout(() => {
			if (node.parentNode === this.container) {
				this.container.removeChild(node);
			}
		}, 1500);
	},
} as const;
