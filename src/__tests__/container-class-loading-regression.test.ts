// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Regression: once a player has reached `ready` and is sitting idle (paused,
 * never played), a subsequent `phase=loading` transition — produced by an
 * autoPlay cold-load or any new-item load on an already-primed player — must
 * NOT change the container class at all. The resting class (`paused`) stays.
 *
 * `loading` class: "initial bootstrap — player not yet playable."
 * `buffering` class: "mid-playback stall." Comes from `waiting`/`stalled` DOM
 *   events, NOT from phase transitions. A player at time=0, playState=idle has
 *   nothing to stall; showing `buffering` would be wrong.
 * `paused` stays: the player is idle and ready. That IS the correct class.
 *
 * Live trace that triggered this fix (video, cold load, autoPlay, no user
 * gesture):
 *   phase:ready  → cls=paused, playState=IDLE, time=0
 *   phase:loading → cls=paused (unchanged)  ← correct; was wrong before
 *   phase:ready  → cls=paused, playState=IDLE, time=0
 */

import { afterEach, describe, expect, it } from 'vitest';

import { EventEmitter } from '../adapters/event-bus/default';
import { containerClassEmitMethods } from '../core/mixins/container-class-emit';

// ── Minimal test emitter ─────────────────────────────────────────────────────

class ContainerEmitter extends EventEmitter<Record<string, unknown>> {
	constructor(public readonly container: HTMLElement) {
		super();
	}

	override emit = containerClassEmitMethods.emit as unknown as (event: string, data?: unknown) => void;
}

const PLAY_STATE_CLASSES = ['playing', 'paused', 'stopped', 'ended', 'loading', 'buffering'];

function presentClasses(container: HTMLElement): string[] {
	return PLAY_STATE_CLASSES.filter(c => container.classList.contains(c));
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('container-class phase rule — loading after ready', () => {
	it('adds `loading` class on phase=loading BEFORE the player has ever reached ready (initial bootstrap)', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		player.emit('phase', { from: 'idle', to: 'loading' });

		expect(container.classList.contains('loading')).toBe(true);
		expect(container.classList.contains('buffering')).toBe(false);
		expect(container.classList.contains('paused')).toBe(false);
	});

	it('sets `paused` class on phase=ready and marks the container as ready', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		player.emit('phase', { from: 'loading', to: 'ready' });

		expect(container.classList.contains('paused')).toBe(true);
		expect(container.classList.contains('loading')).toBe(false);
	});

	it('leaves container class UNCHANGED (stays paused) when phase=loading fires after ready with idle player', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		// Normal startup: idle → loading → ready
		player.emit('phase', { from: 'idle', to: 'loading' });
		player.emit('phase', { from: 'loading', to: 'ready' });

		expect(container.classList.contains('paused')).toBe(true);

		// autoPlay cold-load (or any new-item load while idle): phase=loading fires again
		player.emit('phase', { from: 'paused', to: 'loading' });

		// Container must stay `paused` — not `loading`, not `buffering`
		expect(container.classList.contains('paused')).toBe(true);
		expect(container.classList.contains('loading')).toBe(false);
		expect(container.classList.contains('buffering')).toBe(false);
	});

	it('exactly one play-state class present after phase=loading post-ready', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		player.emit('phase', { from: 'idle', to: 'loading' });
		player.emit('phase', { from: 'loading', to: 'ready' });
		player.emit('phase', { from: 'paused', to: 'loading' });

		const present = presentClasses(container);
		expect(present).toHaveLength(1);
		expect(present[0]).toBe('paused');
	});

	it('full autoPlay cold-load cycle: paused stays through both loading transitions', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		// setup pipeline ends
		player.emit('phase', { from: 'idle', to: 'loading' });
		player.emit('phase', { from: 'loading', to: 'ready' });
		expect(container.classList.contains('paused')).toBe(true);

		// autoPlay triggers item load
		player.emit('phase', { from: 'paused', to: 'loading' });
		expect(container.classList.contains('paused')).toBe(true);

		// backend load resolves, player re-enters ready
		player.emit('phase', { from: 'loading', to: 'ready' });
		expect(container.classList.contains('paused')).toBe(true);

		// No `loading` or `buffering` at any point in the cycle
		expect(container.classList.contains('loading')).toBe(false);
		expect(container.classList.contains('buffering')).toBe(false);
	});

	it('waiting/stalled events DO produce buffering during active playback', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		// Player reaches ready, then plays
		player.emit('phase', { from: 'idle', to: 'loading' });
		player.emit('phase', { from: 'loading', to: 'ready' });
		player.emit('play');

		expect(container.classList.contains('playing')).toBe(true);

		// Mid-playback stall arrives via DOM event, not phase
		player.emit('waiting');

		expect(container.classList.contains('buffering')).toBe(true);
		expect(container.classList.contains('playing')).toBe(false);

		// Recovery
		player.emit('canplay');
		expect(container.classList.contains('buffering')).toBe(false);
	});

	it('two independent containers do not share ready-state tracking', () => {
		const container1 = document.createElement('div');
		const container2 = document.createElement('div');
		document.body.appendChild(container1);
		document.body.appendChild(container2);

		const player1 = new ContainerEmitter(container1);
		const player2 = new ContainerEmitter(container2);

		// player1 has reached ready; player2 has not
		player1.emit('phase', { from: 'idle', to: 'loading' });
		player1.emit('phase', { from: 'loading', to: 'ready' });

		// player1: phase=loading post-ready → stays paused
		player1.emit('phase', { from: 'paused', to: 'loading' });
		expect(container1.classList.contains('paused')).toBe(true);
		expect(container1.classList.contains('loading')).toBe(false);

		// player2: phase=loading pre-ready → shows loading (initial bootstrap)
		player2.emit('phase', { from: 'idle', to: 'loading' });
		expect(container2.classList.contains('loading')).toBe(true);
		expect(container2.classList.contains('paused')).toBe(false);
	});
});
