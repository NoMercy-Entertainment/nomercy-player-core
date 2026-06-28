// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Regression: once a player has reached `ready` and rested in `paused`, a
 * subsequent `loading` phase transition (e.g. new-item load while paused) must
 * NOT regress the container class back to `loading`.
 *
 * `loading` class means "not yet playable — initial load in progress".
 * `buffering` class means "temporarily stalled on an already-ready player".
 *
 * Before the fix, the `phase` rule handler swapped ALL play-state classes to
 * `loading` unconditionally, causing a visual regression for every new-item
 * load on an already-primed player.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { EventEmitter } from '../adapters/event-bus/default';
import { containerClassEmitMethods } from '../core/mixins/container-class-emit';

// ── Minimal test emitter ─────────────────────────────────────────────────────
//
// Extends the real EventEmitter so `EventEmitter.prototype.emit.call(this,...)`
// inside `containerClassEmitMethods.emit` has the correct prototype chain.
// Adds only the `container` field that the rule handler reads.

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
	it('adds `loading` class when phase=loading BEFORE the player has ever reached ready', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		player.emit('phase', { from: 'idle', to: 'loading' });

		expect(container.classList.contains('loading')).toBe(true);
		expect(container.classList.contains('buffering')).toBe(false);
	});

	it('adds `paused` class when phase=ready and marks the container as having been ready', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		player.emit('phase', { from: 'loading', to: 'ready' });

		expect(container.classList.contains('paused')).toBe(true);
		expect(container.classList.contains('loading')).toBe(false);
	});

	it('maps phase=loading to `buffering` (NOT `loading`) once the player has already reached ready', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		// Simulate the normal startup path: idle → loading → ready
		player.emit('phase', { from: 'idle', to: 'loading' });
		player.emit('phase', { from: 'loading', to: 'ready' });

		// `play` + `pause` to settle into paused state
		player.emit('play');
		player.emit('pause');

		expect(container.classList.contains('paused')).toBe(true);

		// New-item load while the player is already-ready
		player.emit('phase', { from: 'paused', to: 'loading' });

		// MUST be `buffering`, never `loading` — the player has already been ready
		expect(container.classList.contains('loading')).toBe(false);
		expect(container.classList.contains('buffering')).toBe(true);
		expect(container.classList.contains('paused')).toBe(false);
	});

	it('only one play-state class is present after the phase=loading transition post-ready', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		player.emit('phase', { from: 'idle', to: 'loading' });
		player.emit('phase', { from: 'loading', to: 'ready' });
		player.emit('phase', { from: 'paused', to: 'loading' });

		const present = presentClasses(container);
		expect(present).toHaveLength(1);
		expect(present[0]).toBe('buffering');
	});

	it('keeps mapping phase=loading to `buffering` on repeated new-item loads after ready', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		player.emit('phase', { from: 'idle', to: 'loading' });
		player.emit('phase', { from: 'loading', to: 'ready' });

		// Second item load
		player.emit('phase', { from: 'paused', to: 'loading' });
		expect(container.classList.contains('buffering')).toBe(true);

		// Recovery
		player.emit('phase', { from: 'loading', to: 'ready' });
		expect(container.classList.contains('paused')).toBe(true);

		// Third item load
		player.emit('phase', { from: 'paused', to: 'loading' });
		expect(container.classList.contains('buffering')).toBe(true);
		expect(container.classList.contains('loading')).toBe(false);
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

		// player1: loading after ready → buffering
		player1.emit('phase', { from: 'paused', to: 'loading' });
		expect(container1.classList.contains('buffering')).toBe(true);
		expect(container1.classList.contains('loading')).toBe(false);

		// player2: loading before ready → loading (not buffering)
		player2.emit('phase', { from: 'idle', to: 'loading' });
		expect(container2.classList.contains('loading')).toBe(true);
		expect(container2.classList.contains('buffering')).toBe(false);
	});
});
