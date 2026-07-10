// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { Internals } from '../state';
import { VolumeState } from '../state';

/**
 * The volume mixin's slice of player state — composed into `PlayerCoreState`.
 */
export interface VolumeMixinState {
	_volumeState: VolumeState;

	/** Stored on the 0-100 scale to match the public volume() API. */
	_internalVolume: number;

	/** Stored on the 0-100 scale to match the public volume() API. */
	_volumeBeforeMute: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Private helpers — only used by volumeMethods
// ──────────────────────────────────────────────────────────────────────────

/**
 * Dispatch `beforeMute` and apply the resulting mute/unmute transition.
 * Shared by `mute()` and `unmute()` so the cancellable dispatch + state
 * transition logic lives in one place. No-ops (no dispatch, no event) when
 * the player is already in the requested `muted` state — same idempotency
 * guarantee the pre-hook version carried.
 */
async function _dispatchMute(self: Internals, muted: boolean): Promise<void> {
	const alreadyInState = muted
		? self._volumeState === VolumeState.MUTED
		: self._volumeState === VolumeState.UNMUTED;
	if (alreadyInState)
		return;

	const result = await self._dispatchBefore<{ muted: boolean }>('beforeMute', { muted });
	if (result.prevented) {
		self.emit('mutePrevented', {
			reason: result.reason ?? 'listener-prevented',
			cause: result.cause,
		});
		return;
	}

	if (result.data.muted) {
		self._volumeBeforeMute = self._internalVolume;
		self._volumeState = VolumeState.MUTED;
		self.emit('mute', { muted: true });
		self._resolveBackend()?.mute?.();
	}
	else {
		self._volumeState = VolumeState.UNMUTED;
		self._internalVolume = self._volumeBeforeMute;
		self.emit('mute', { muted: false });
		self._resolveBackend()?.unmute?.();
		self._resolveBackend()?.volume?.(self._internalVolume / 100);
	}
}

// ──────────────────────────────────────────────────────────────────────────
// Mixin: volume
// ──────────────────────────────────────────────────────────────────────────

export const volumeMethods = {
	/**
	 * Read or write the playback volume.
	 *
	 * `volume()` — returns the effective level (0..100). Returns `0` when muted
	 * regardless of the stored pre-mute value.
	 *
	 * `volume(level)` — dispatches `beforeVolume` with the requested level.
	 * Fires unconditionally, independent of `setup({ mutationGuards })` — see
	 * `HOT_MUTATIONS`. A listener may `preventDefault()` to cancel, in which
	 * case `volumePrevented` fires and the level is unchanged. Otherwise
	 * clamps `level` to [0, 100], persists it, and routes the new value to the
	 * active backend (divided by 100 to meet the HTML5 0-1 spec). Returns a
	 * `Promise<void>` so callers can await the full cancellable cycle.
	 */
	volume(this: Internals, level?: number): number | Promise<void> {
		if (level === undefined) {
			return this._volumeState === VolumeState.MUTED ? 0 : this._internalVolume;
		}

		return (async () => {
			const result = await this._dispatchBefore<{ level: number }>('beforeVolume', { level });
			if (result.prevented) {
				this.emit('volumePrevented', {
					reason: result.reason ?? 'listener-prevented',
					cause: result.cause,
				});
				return;
			}
			this._applyVolume(result.data.level);
		})();
	},

	/**
	 * Apply a volume level without dispatching `beforeVolume`. Internal-only —
	 * used by the public `volume()` setter (after the cancellable gate) AND by
	 * the `load({ fadeIn })` ramp in `loadingMethods`, which steps through
	 * dozens of intermediate levels per second and must not spam listeners
	 * with a `beforeVolume` dispatch (and possible cancellation) on every
	 * frame of an animation the user already committed to by requesting the
	 * fade.
	 */
	_applyVolume(this: Internals, level: number): void {
		this._internalVolume = Math.max(0, Math.min(100, level));

		// User-driven volume change while muted = unmute. Standard player UX
		// (every consumer-facing slider, hardware media key, gesture). Without
		// this, dragging the slider while muted silently writes _internalVolume
		// but `volume()` keeps returning 0, so the user sees the slider snap
		// back to 0 and hears nothing.
		if (this._volumeState === VolumeState.MUTED && this._internalVolume > 0) {
			this._volumeState = VolumeState.UNMUTED;
			this._volumeBeforeMute = this._internalVolume;
			this.emit('mute', { muted: false });
			this._resolveBackend()?.unmute?.();
		}
		else if (this._volumeState !== VolumeState.MUTED) {
			this._volumeBeforeMute = this._internalVolume;
		}

		this.emit('volume', { level: this._internalVolume });

		this._resolveBackend()?.volume?.(this._internalVolume / 100);
	},
	/**
	 * Silence output without discarding the volume level. Dispatches
	 * `beforeMute` with `{ muted: true }`; a listener may `preventDefault()`
	 * to cancel, in which case `mutePrevented` fires. Otherwise persists the
	 * current level so `unmute()` can restore it and emits `mute` with
	 * `{ muted: true }`. No-op (no dispatch) when already muted.
	 */
	mute(this: Internals): Promise<void> {
		return _dispatchMute(this, true);
	},
	/**
	 * Restore output after a mute. Dispatches `beforeMute` with
	 * `{ muted: false }`; a listener may `preventDefault()` to cancel, in
	 * which case `mutePrevented` fires. Otherwise reinstates the level saved
	 * by the last `mute()` call and emits `mute` with `{ muted: false }`.
	 * No-op (no dispatch) when already unmuted.
	 */
	unmute(this: Internals): Promise<void> {
		return _dispatchMute(this, false);
	},
	/**
	 * Toggle between muted and unmuted. Delegates to `mute()` or `unmute()` —
	 * still dispatches `beforeMute`. Fire-and-forget: this method stays
	 * synchronous so key-handler / UI toggle callers don't need to `await` a
	 * simple button press; the underlying promise is intentionally not
	 * propagated (matches `seekByPercentage`'s fire-and-forget convention).
	 */
	toggleMute(this: Internals): void {
		if (this._volumeState === VolumeState.MUTED)
			void this.unmute();
		else void this.mute();
	},
	/**
	 * Raise volume by `step` percentage points (default 5). Delegates to
	 * `volume()` — still dispatches `beforeVolume`. Fire-and-forget for the
	 * same reason as `toggleMute()`.
	 */
	volumeUp(this: Internals, step = 5): void {
		void this.volume(this._internalVolume + step);
	},
	/**
	 * Lower volume by `step` percentage points (default 5). Delegates to
	 * `volume()` — still dispatches `beforeVolume`. Fire-and-forget for the
	 * same reason as `toggleMute()`.
	 */
	volumeDown(this: Internals, step = 5): void {
		void this.volume(this._internalVolume - step);
	},
} as const;
