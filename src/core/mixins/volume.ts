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
// Mixin: volume
// ──────────────────────────────────────────────────────────────────────────

export const volumeMethods = {
	/**
	 * Read or write the playback volume.
	 *
	 * `volume()` — returns the effective level (0..100). Returns `0` when muted
	 * regardless of the stored pre-mute value.
	 *
	 * `volume(level)` — clamps `level` to [0, 100], persists it, and routes the
	 * new value to the active backend (divided by 100 to meet the HTML5 0-1
	 * spec). Fires `beforeMutation` (cancellable) then `volume`. No-op when the
	 * mutation is cancelled.
	 */
	volume(this: Internals, v?: number): number | void {
		if (v === undefined) {
			return this._volumeState === VolumeState.MUTED ? 0 : this._internalVolume;
		}

		if (!this._emitBeforeMutation('volume', [v]))
			return;

		this._internalVolume = Math.max(0, Math.min(100, v));

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
	 * Silence output without discarding the volume level. Persists the current
	 * level so `unmute()` can restore it. Emits `mute` with `{ muted: true }`.
	 * No-op when already muted.
	 */
	mute(this: Internals): void {
		if (this._volumeState === VolumeState.MUTED)
			return;

		this._volumeBeforeMute = this._internalVolume;
		this._volumeState = VolumeState.MUTED;
		this.emit('mute', { muted: true });

		this._resolveBackend()?.mute?.();
	},
	/**
	 * Restore output after a mute. Reinstates the level saved by the last
	 * `mute()` call and emits `mute` with `{ muted: false }`. No-op when
	 * already unmuted.
	 */
	unmute(this: Internals): void {
		if (this._volumeState === VolumeState.UNMUTED)
			return;

		this._volumeState = VolumeState.UNMUTED;
		this._internalVolume = this._volumeBeforeMute;
		this.emit('mute', { muted: false });

		this._resolveBackend()?.unmute?.();
	},
	/** Toggle between muted and unmuted. Delegates to `mute()` or `unmute()`. */
	toggleMute(this: Internals): void {
		if (this._volumeState === VolumeState.MUTED)
			this.unmute();
		else this.mute();
	},
	/** Raise volume by `step` percentage points (default 5). Delegates to `volume()`. */
	volumeUp(this: Internals, step = 5): void {
		this.volume(this._internalVolume + step);
	},
	/** Lower volume by `step` percentage points (default 5). Delegates to `volume()`. */
	volumeDown(this: Internals, step = 5): void {
		this.volume(this._internalVolume - step);
	},
} as const;
