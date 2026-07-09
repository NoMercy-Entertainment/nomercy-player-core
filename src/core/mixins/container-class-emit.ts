// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { PlayerPhase } from '../../types';
import type { Internals } from '../state';

import { EventEmitter } from '../../adapters/event-bus/default';
import { PlayState } from '../state';

// ──────────────────────────────────────────────────────────────────────────
// Container class rules — data-driven table that maps player event names to
// the CSS class mutations they produce on `.nomercyplayer`. Adding a new
// event-to-class mapping only requires a new entry here; no touch to emit().
// ──────────────────────────────────────────────────────────────────────────

/** Mutually exclusive playback-state classes managed as a group by the rules table. */
const PLAY_STATE_CLASSES: ReadonlyArray<string> = ['playing', 'paused', 'stopped', 'ended', 'loading', 'buffering'] as const;

type ContainerClassRule
	= | { kind: 'swap'; add: string; remove: readonly string[] }
		| { kind: 'drop'; remove: readonly string[] }
		| { kind: 'toggle'; cls: string; payloadKey: string }
		| { kind: 'binary'; whenTrue: string; whenFalse: string; payloadKey: string }
		| { kind: 'phase' };

/**
 * Tracks whether a given container has ever reached the `ready` phase.
 *
 * Once a player has been primed (first `ready`), a subsequent `phase=loading`
 * is a background item-load on an idle player — not a user-visible stall and
 * not the initial bootstrap. The resting class (`paused`, `playing`, etc.)
 * must stay unchanged; only the `waiting`/`stalled` DOM events (already wired
 * in `CONTAINER_CLASS_RULES`) produce a `buffering` class during live playback.
 *
 * Keyed by container element so independent player instances do not share state.
 */
const _containerHasBeenReady = new WeakMap<HTMLElement, boolean>();

const CONTAINER_CLASS_RULES: ReadonlyMap<string, ContainerClassRule> = new Map<string, ContainerClassRule>([
	['play', {
		kind: 'swap',
		add: 'playing',
		remove: PLAY_STATE_CLASSES.filter(cls => cls !== 'playing'),
	}],
	['playing', {
		kind: 'swap',
		add: 'playing',
		remove: PLAY_STATE_CLASSES.filter(cls => cls !== 'playing'),
	}],
	['pause', {
		kind: 'swap',
		add: 'paused',
		remove: PLAY_STATE_CLASSES.filter(cls => cls !== 'paused'),
	}],
	['stop', {
		kind: 'swap',
		add: 'stopped',
		remove: PLAY_STATE_CLASSES.filter(cls => cls !== 'stopped'),
	}],
	['ended', {
		kind: 'swap',
		add: 'ended',
		remove: PLAY_STATE_CLASSES.filter(cls => cls !== 'ended'),
	}],
	['waiting', {
		kind: 'swap',
		add: 'buffering',
		remove: ['playing'],
	}],
	['stalled', {
		kind: 'swap',
		add: 'buffering',
		remove: ['playing'],
	}],
	['canplay', {
		kind: 'drop',
		remove: ['buffering'],
	}],
	['mute', {
		kind: 'toggle',
		cls: 'muted',
		payloadKey: 'muted',
	}],
	['fullscreen', {
		kind: 'toggle',
		cls: 'fullscreen',
		payloadKey: 'active',
	}],
	['pip', {
		kind: 'toggle',
		cls: 'pip',
		payloadKey: 'active',
	}],
	['theater', {
		kind: 'toggle',
		cls: 'theater',
		payloadKey: 'active',
	}],
	['phase', { kind: 'phase' }],
	['activity', {
		kind: 'binary',
		whenTrue: 'active',
		whenFalse: 'inactive',
		payloadKey: 'active',
	}],
]);

/**
 * Apply a single `ContainerClassRule` to `container` given the event `data`.
 * Each rule kind maps cleanly to a class-list mutation:
 * - `swap` — remove competing classes then add the target class.
 * - `drop` — remove a set of classes with no addition.
 * - `toggle` — boolean-toggle one class from a payload key.
 * - `binary` — apply one of two classes depending on a boolean payload key.
 * - `phase` — when entering a recognised play-state phase, swap the class;
 *   entering `ready` resets to `paused` as the resting state UNLESS the player
 *   is currently playing, in which case the container stays `playing`.
 *   A subsequent `loading` phase on an already-ready container is a no-op —
 *   the resting class stays, because real stalls arrive via `waiting`/`stalled`
 *   events, not phase transitions.
 *
 * `currentPlayState` is forwarded from `this._playState` so the `ready` handler
 * can honour a live `playing` state during cold-stream buffering recovery.
 *
 * No-ops silently when `container` is absent (player not mounted yet).
 */
function _applyContainerClassRule(container: HTMLElement | undefined, rule: ContainerClassRule, data: unknown, currentPlayState: string): void {
	if (!container || typeof container.classList === 'undefined')
		return;

	if (rule.kind === 'swap') {
		for (const cls of rule.remove) container.classList.remove(cls);
		container.classList.add(rule.add);
		return;
	}

	if (rule.kind === 'drop') {
		for (const cls of rule.remove) container.classList.remove(cls);
		return;
	}

	if (rule.kind === 'toggle') {
		const payload: Record<string, unknown> = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
		container.classList.toggle(rule.cls, Boolean(payload[rule.payloadKey]));
		return;
	}

	if (rule.kind === 'binary') {
		const payload: Record<string, unknown> = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
		const on = Boolean(payload[rule.payloadKey]);
		container.classList.add(on ? rule.whenTrue : rule.whenFalse);
		container.classList.remove(on ? rule.whenFalse : rule.whenTrue);
		return;
	}

	if (rule.kind === 'phase') {
		const phasePayload = typeof data === 'object' && data !== null && 'to' in data
			? (data as { to: PlayerPhase })
			: undefined;
		if (!phasePayload)
			return;

		if (phasePayload.to === 'ready') {
			_containerHasBeenReady.set(container, true);
			for (const cls of PLAY_STATE_CLASSES) container.classList.remove(cls);
			container.classList.add(currentPlayState === 'playing' ? 'playing' : 'paused');
			return;
		}

		if (PLAY_STATE_CLASSES.includes(phasePayload.to)) {
			const hasBeenReady = _containerHasBeenReady.get(container) === true;

			// After the first `ready`, a `phase=loading` transition is a
			// background item-load on an already-primed, idle player. It must
			// not touch the container class at all — the resting class (`paused`,
			// `playing`, etc.) is the correct presentation. Real mid-playback
			// stalls arrive via `waiting`/`stalled` DOM events (already mapped to
			// `buffering` above), never via a phase transition.
			if (phasePayload.to === 'loading' && hasBeenReady)
				return;

			for (const cls of PLAY_STATE_CLASSES) container.classList.remove(cls);
			container.classList.add(phasePayload.to);
		}
	}
}

// ──────────────────────────────────────────────────────────────────────────
// Mixin: containerClassEmit — wraps `emit` to keep event-driven player state
// in sync with every dispatch without any additional wiring in caller code:
// `.nomercyplayer` CSS state classes, plus the `fatal` → `PlayState.ERROR`
// flip (this is the one chokepoint every `fatal` dispatch passes through).
// The override is transparent: all events still propagate to registered
// listeners through EventEmitter.
// ──────────────────────────────────────────────────────────────────────────

export const containerClassEmitMethods = {
	/**
	 * Override of `EventEmitter.emit` that applies event-driven state sync
	 * before forwarding to the listener chain.
	 *
	 * `fatal` — the kit's unrecoverable-failure channel — flips the play
	 * state to `ERROR` first, so `fatal` listeners already observe the
	 * settled state (exactly like transport sets `_playState` before
	 * emitting `play` / `pause` / `stop`). Every `fatal` dispatch funnels
	 * through this emit regardless of origin (plugin `throw`, consumer
	 * emit), and running before the listener chain keeps the flip immune to
	 * `stopImmediatePropagation()`. Non-fatal `error` / `warning` / `info`
	 * events never touch the play state; a subsequent successful `load()`
	 * clears `ERROR` (see `loadingMethods.load`).
	 *
	 * Container classes: looks up `event` in `CONTAINER_CLASS_RULES`; when a
	 * rule matches, calls `_applyContainerClassRule` on `this.container`.
	 * All events — including those with no rule — then propagate normally.
	 *
	 * The parameter types mirror the base `EventEmitter` implementation
	 * signature so this override compiles without a cast.
	 */
	emit(this: Internals, event: any, data?: any): void {
		if (String(event) === 'fatal') {
			this._playState = PlayState.ERROR;
		}
		const rule = CONTAINER_CLASS_RULES.get(String(event));
		if (rule) {
			_applyContainerClassRule(this.container, rule, data, this._playState);
		}
		EventEmitter.prototype.emit.call(this, event, data);
	},
} as const;
