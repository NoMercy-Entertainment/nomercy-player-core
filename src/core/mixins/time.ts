import type { ActionOptions, TimeState } from '../../types';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Private helpers — only used by timeMethods
// ──────────────────────────────────────────────────────────────────────────

function _emptyTimeRanges(): TimeRanges {
	return { length: 0, start: (): number => 0, end: (): number => 0 } as unknown as TimeRanges;
}


// ──────────────────────────────────────────────────────────────────────────
// Mixin: time / position
// ──────────────────────────────────────────────────────────────────────────

export const timeMethods = {
	currentTime(this: Internals, t?: number, opts: ActionOptions = {}): number | Promise<void> {
		if (t === undefined) return this._internalCurrentTime;
		const target = Math.max(0, t);
		// Async setter — returns Promise<void> so callers can await delay() resolution.
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

	duration(this: Internals): number {
		return this._internalDuration;
	},
	buffered(this: Internals): number {
		return this._resolveBackend()?.buffered?.() ?? 0;
	},
	bufferedRanges(this: Internals): TimeRanges {
		return this._resolveBackend()?.bufferedRanges?.() ?? _emptyTimeRanges();
	},
	seekable(this: Internals): TimeRanges {
		return _emptyTimeRanges();
	},
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
	 * `pct` is clamped to [0, 100]. No-op when duration is zero or non-finite
	 * (metadata not yet loaded). Delegates to `currentTime(duration * pct / 100)`.
	 * V1 parity — mirrors `seekByPercentage(pct)` on the v1 player surface.
	 */
	seekByPercentage(this: Internals, pct: number, opts?: ActionOptions): void {
		const clamped = Math.max(0, Math.min(100, pct));
		const d = this.duration();
		if (!Number.isFinite(d) || d <= 0) return;
		const ret = this.currentTime(d * clamped / 100, opts);
		if (ret instanceof Promise)
			void ret;
	},

	playbackRate(this: Internals, rate?: number): number | void {
		if (rate === undefined)
			return this._playbackRate;
		this._playbackRate = rate;
		this.emit('backend:ratechange', { rate });

		this._resolveBackend()?.playbackRate?.(rate);
	},
	playbackRates(this: Internals): number[] {
		return [0.5, 0.75, 1, 1.25, 1.5, 2];
	},
} as const;
