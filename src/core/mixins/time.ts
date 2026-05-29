import type { ActionOptions, TimeState } from '../../types';

import type { Internals } from '../state';

/**
 * The time mixin's slice of player state — composed into `PlayerCoreState`.
 * Named `TimeInternalState` to avoid clashing with the public `TimeState` shape
 * exported from `../../types`. Declared here, beside the methods that write it.
 */
export interface TimeInternalState {
	/**
	 * Last-known current-time position in seconds. Written by `timeMethods`
	 * on each `time` event from the backend, and by seek operations before the
	 * backend confirms. Read by `currentTime()`.
	 */
	_internalCurrentTime: number;

	/**
	 * Current playback rate multiplier (1 = normal). Written by
	 * `timeMethods.playbackRate()`; forwarded to the backend at write
	 * time. Read by `playbackRate()`.
	 */
	_playbackRate: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Private helpers — only used by timeMethods
// ──────────────────────────────────────────────────────────────────────────

function _emptyTimeRanges(): TimeRanges {
	return {
		length: 0,
		start: (): number => 0,
		end: (): number => 0,
	} as unknown as TimeRanges;
}

// ──────────────────────────────────────────────────────────────────────────
// Mixin: time / position
// ──────────────────────────────────────────────────────────────────────────

export const timeMethods = {
	/**
	 * Get or seek to a playback position in seconds.
	 *
	 * - Called with no argument: returns the current position as a number.
	 * - Called with a time: dispatches `beforeSeek`; a listener may
	 *   `preventDefault()` to cancel, in which case `seekPrevented` fires and
	 *   the position is unchanged. Otherwise runs a `seeking` phase round-trip,
	 *   updates `_internalCurrentTime`, emits `seek` then `seeked`, and
	 *   forwards the position to the backend. The setter returns a
	 *   `Promise<void>` so callers can `await` the full seek cycle.
	 *
	 * Negative values are clamped to 0. `opts.source` flows through to the
	 * `seek` / `seeked` payloads so listeners can attribute the seek origin.
	 */
	currentTime(this: Internals, t?: number, opts: ActionOptions = {}): number | Promise<void> {
		if (t === undefined)
			return this._internalCurrentTime;
		const target = Math.max(0, t);

		return (async () => {
			const result = await this._dispatchBefore<{ time: number; source?: string }>('beforeSeek', {
				time: target,
				source: opts.source,
			});
			if (result.prevented) {
				this.emit('seekPrevented', {
					reason: result.reason ?? 'listener-prevented',
					cause: result.cause,
				});
				return;
			}
			this._seekingTransition(() => {
				this._internalCurrentTime = Math.max(0, result.data.time);
				this.emit('seek', {
					time: this._internalCurrentTime,
					source: result.data.source,
				});
			});

			this._resolveBackend()?.currentTime?.(this._internalCurrentTime);

			this.emit('seeked', { time: this._internalCurrentTime });
		})();
	},

	/** Total track/clip duration in seconds. Returns 0 when metadata has not yet loaded. */
	duration(this: Internals): number {
		return this._internalDuration;
	},

	/**
	 * How many seconds of media are buffered ahead of the current position.
	 * Delegates to the backend; returns 0 when no backend is registered.
	 */
	buffered(this: Internals): number {
		return this._resolveBackend()?.buffered?.() ?? 0;
	},

	/**
	 * Full buffered `TimeRanges` from the backend, mirroring the
	 * `HTMLMediaElement.buffered` shape. Returns an empty range set when no
	 * backend is registered or the backend does not expose `bufferedRanges`.
	 */
	bufferedRanges(this: Internals): TimeRanges {
		return this._resolveBackend()?.bufferedRanges?.() ?? _emptyTimeRanges();
	},

	/**
	 * Seekable `TimeRanges` for the current source. Delegates to the backend's
	 * `seekable()` when the backend exposes it (e.g. an `HTMLVideoElement`
	 * backend). Returns an empty range set when no backend is mounted or the
	 * backend does not implement `seekable()`.
	 */
	seekable(this: Internals): TimeRanges {
		return this._resolveBackend()?.seekable?.() ?? _emptyTimeRanges();
	},

	/**
	 * Snapshot of all time-related state in one call. Useful for consumers
	 * that need to render a progress bar without individually calling
	 * `currentTime()`, `duration()`, `buffered()`, and computing the rest.
	 * All derived values (remaining, percentage) are computed from live
	 * getters so the snapshot is consistent at the moment of the call.
	 */
	timeData(this: Internals): TimeState {
		const position = this._internalCurrentTime;
		const duration = this.duration();
		const buffered = this.buffered();
		return {
			position,
			duration,
			buffered,
			remaining: Math.max(0, duration - position),
			percentage: duration > 0 ? (position / duration) * 100 : 0,
		};
	},

	/**
	 * Seek to a position expressed as a percentage (0–100) of the total duration.
	 *
	 * `pct` is clamped to [0, 100]. No-op when duration is zero or
	 * non-finite (metadata not yet loaded). Delegates to
	 * `currentTime(duration * pct / 100)`, so `beforeSeek` fires and
	 * the full seek cycle applies.
	 */
	seekByPercentage(this: Internals, pct: number, opts?: ActionOptions): void {
		const clamped = Math.max(0, Math.min(100, pct));
		const duration = this.duration();
		if (!Number.isFinite(duration) || duration <= 0)
			return;
		const ret = this.currentTime(duration * clamped / 100, opts);
		if (ret instanceof Promise)
			void ret;
	},

	/**
	 * Get or set the playback rate multiplier.
	 *
	 * - Called with no argument: returns the current rate.
	 * - Called with a value: stores the rate, emits `backend:ratechange`,
	 *   and forwards to the backend's `playbackRate()`.
	 */
	playbackRate(this: Internals, rate?: number): number | void {
		if (rate === undefined)
			return this._playbackRate;
		this._playbackRate = rate;
		this.emit('backend:ratechange', { rate });

		this._resolveBackend()?.playbackRate?.(rate);
	},

	/**
	 * Supported playback rate values for UI speed-selector controls. The
	 * list is intentionally fixed — backends clamp out-of-range values on
	 * their own.
	 */
	playbackRates(this: Internals): number[] {
		return [0.5, 0.75, 1, 1.25, 1.5, 2];
	},
} as const;
