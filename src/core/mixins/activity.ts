// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { Internals } from '../state';
import { PlayState } from '../../types';

// ──────────────────────────────────────────────────────────────────────────
// Mixin: activity — the player-level viewer-activity tracker.
//
// Activity is a player concern, not a plugin concern: the player watches its
// own container for pointer / touch / key input, emits `activity` on the
// event bus, and `containerClassEmitMethods` translates that into the
// `.active` / `.inactive` classes on `.nomercyplayer`. Any UI (a hand-built
// plugin, plain CSS on the page) inherits show / hide behavior from those
// classes without wiring anything.
//
// A UI plugin that owns a richer activity state machine (open menus pinning
// the controls, hover rules, scrub state — e.g. the video DesktopUiPlugin)
// calls `activityTracking(false)` to take over as the sole `activity`
// emitter; the built-in listeners and countdown stand down.
// ──────────────────────────────────────────────────────────────────────────

/** The activity mixin's slice of player state — composed into `PlayerCoreState`. */
export interface ActivityState {
	/** Whether the last emitted `activity` state was active. Flip-guard so repeat bumps don't spam the bus. */
	_activityActive: boolean;

	/** Inactivity countdown handle. Cleared on every bump; undefined while idle-hidden or disabled. */
	_activityToken: ReturnType<typeof setTimeout> | undefined;

	/** Whether the built-in tracker owns the `activity` event. `false` once a UI plugin takes over. */
	_activityTrackingEnabled: boolean;
}

const DEFAULT_INACTIVITY_MS = 4000;

function _inactivityMs(self: Internals): number {
	return self.options?.inactivityMs ?? DEFAULT_INACTIVITY_MS;
}

/**
 * Emit `activity` only when the active state actually flips.
 *
 * Desync guard: when showing (`active: true`) the flag may agree but the
 * container class may have been stripped by a direct
 * `player.emit('activity', { active: false })` from a consumer. In that case
 * force-emit so the container-class rule re-adds `.active`. The guard is kept
 * for `active: false` so countdown expiries while already hidden stay silent.
 */
function _setActivity(self: Internals, active: boolean): void {
	if (active) {
		const domIsActive = self.container?.classList.contains('active') ?? false;
		if (self._activityActive && domIsActive)
			return;

		self._activityActive = true;
		self.emit('activity', { active: true });
	}
	else {
		if (!self._activityActive)
			return;

		self._activityActive = false;
		self.emit('activity', { active: false });
	}
}

/** Hide only while playback runs. Paused, stopped, buffering, ended: the controls stay up, and the countdown is NOT re-armed — the next bump re-arms it. */
function _maybeHide(self: Internals): void {
	self._activityToken = undefined;
	if (self._playState !== PlayState.PLAYING)
		return;

	_setActivity(self, false);
}

/** Show now and (re-)arm the inactivity countdown. */
function _bump(self: Internals): void {
	_setActivity(self, true);

	if (self._activityToken !== undefined) {
		clearTimeout(self._activityToken);
		self._activityToken = undefined;
	}

	const ms = _inactivityMs(self);
	if (ms > 0 && self._activityTrackingEnabled) {
		self._activityToken = setTimeout(_maybeHide, ms, self);
	}
}

/**
 * Wire the built-in activity tracker onto the container. Called by `setup()`
 * alongside the other policy `_wire*` helpers; all listeners, the `play`
 * subscription, and any armed countdown are released through
 * `_policyCleanup` on dispose.
 *
 * `inactivityMs: 0` disables the tracker entirely (no listeners, no initial
 * bump) — `activity` then only ever fires from a UI plugin or a manual
 * `bumpActivity()` call.
 */
export function wireActivityTracking(self: Internals): void {
	if (typeof document === 'undefined' || !self.container)
		return;

	if (_inactivityMs(self) === 0) {
		self._activityTrackingEnabled = false;
		return;
	}

	const bump = (): void => {
		if (!self._activityTrackingEnabled)
			return;

		_bump(self);
	};

	// Leaving the container hides the controls immediately (while playing) —
	// the same `mouseleave -> maybeHide` rule the desktop UI runs, so a bare
	// player behaves like the web app: pointer off the video, controls away.
	const leave = (): void => {
		if (!self._activityTrackingEnabled)
			return;

		if (self._activityToken !== undefined) {
			clearTimeout(self._activityToken);
			self._activityToken = undefined;
		}
		_maybeHide(self);
	};

	const listenerOptions: AddEventListenerOptions = { passive: true };
	const events = ['mousemove', 'pointerdown', 'touchstart', 'keydown'] as const;
	for (const event of events) {
		self.container.addEventListener(event, bump, listenerOptions);
	}
	self.container.addEventListener('mouseleave', leave, listenerOptions);
	self._policyCleanup.push(() => {
		for (const event of events) {
			self.container.removeEventListener(event, bump);
		}
		self.container.removeEventListener('mouseleave', leave);
		if (self._activityToken !== undefined) {
			clearTimeout(self._activityToken);
			self._activityToken = undefined;
		}
	});

	// Resuming playback re-arms the countdown even when the resume came from
	// somewhere the DOM can't see (MediaSession, a remote-control command) —
	// otherwise controls shown during a pause would stay up forever after.
	const onPlay = (): void => bump();
	self.on('play', onPlay);
	self._policyCleanup.push(() => self.off('play', onPlay));

	// Controls start visible: the viewer just initiated a player, that IS
	// activity. The countdown armed here fades them once playback runs.
	bump();
}

export const activityMethods = {
	/**
	 * Mark the viewer as active now: emits `activity { active: true }` (the
	 * container gains `.active`) and re-arms the inactivity countdown that
	 * fades controls while playing. The player calls this itself for pointer,
	 * touch, and key input on the container; call it manually after
	 * interactions the DOM can't see.
	 */
	bumpActivity(this: Internals): void {
		_bump(this);
	},

	/**
	 * Read (no argument) or set whether the built-in activity tracker owns the
	 * `activity` event. A UI plugin with its own richer state machine passes
	 * `false` to take over as sole emitter; disabling clears any armed
	 * countdown and the built-in listeners stand down.
	 */
	activityTracking(this: Internals, enabled?: boolean): boolean {
		if (enabled === undefined)
			return this._activityTrackingEnabled;

		this._activityTrackingEnabled = enabled;
		if (!enabled && this._activityToken !== undefined) {
			clearTimeout(this._activityToken);
			this._activityToken = undefined;
		}
		return this._activityTrackingEnabled;
	},
} as const;
