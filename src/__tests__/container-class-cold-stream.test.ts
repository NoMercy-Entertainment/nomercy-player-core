// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Regression: cold-stream play sequence.
 *
 * Live trace that exposed two container-class issues:
 *   1. phase:loading  → cls=loading (bootstrap)
 *   2. ev:play        → cls=playing, _playState=playing
 *   3. ev:waiting     → cls=buffering (cold HLS stall)
 *   4. phase:ready    → cls=PAUSED   — phase:ready forced paused while playing
 *   5. ev:canplay     → cls=paused (buffering dropped but no playing restored)
 *   6. ev:playing     → cls=PAUSED   — `playing` event had no rule
 *
 * Both are fixed:
 *   - phase:ready respects _playState — stays `playing` when player is playing.
 *   - `playing` event is now wired as a swap → restores `.playing`, removes buffering.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { EventEmitter } from '../adapters/event-bus/default';
import { containerClassEmitMethods } from '../core/mixins/container-class-emit';

// ── Test harness with stateful _playState ────────────────────────────────────

class StatefulContainerEmitter extends EventEmitter<Record<string, unknown>> {
	public readonly container: HTMLElement;
	public _playState: string;

	constructor(container: HTMLElement, initialPlayState: string = 'idle') {
		super();
		this.container = container;
		this._playState = initialPlayState;
	}

	override emit = containerClassEmitMethods.emit as unknown as (event: string, data?: unknown) => void;
}

const PLAY_STATE_CLASSES = ['playing', 'paused', 'stopped', 'ended', 'loading', 'buffering'];

function presentClasses(container: HTMLElement): string[] {
	return PLAY_STATE_CLASSES.filter(cls => container.classList.contains(cls));
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('container-class cold-stream regression', () => {
	it('cold-stream sequence ends with .playing not .paused', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new StatefulContainerEmitter(container, 'idle');

		// Step 1 — bootstrap
		player.emit('phase', { from: 'idle', to: 'loading' });
		expect(container.classList.contains('loading')).toBe(true);

		// Step 2 — user presses play; _playState transitions to playing
		player._playState = 'playing';
		player.emit('play');
		expect(container.classList.contains('playing')).toBe(true);

		// Step 3 — cold HLS stall
		player.emit('waiting');
		expect(container.classList.contains('buffering')).toBe(true);
		expect(container.classList.contains('playing')).toBe(false);

		// Step 4 — phase:ready fires mid-playback (buffering recovery on cold stream)
		// Regression guard: phase:ready must not force .paused when _playState is 'playing'.
		player.emit('phase', { from: 'loading', to: 'ready' });
		expect(container.classList.contains('playing')).toBe(true);
		expect(container.classList.contains('paused')).toBe(false);

		// Step 5 — canplay removes buffering
		player.emit('canplay');
		expect(container.classList.contains('buffering')).toBe(false);

		// Step 6 — playing event fires when backend actually starts decoding
		// Regression guard: the `playing` event must have a rule to restore the class.
		player.emit('playing');
		expect(container.classList.contains('playing')).toBe(true);
		expect(container.classList.contains('paused')).toBe(false);
		expect(container.classList.contains('buffering')).toBe(false);

		// Invariant: exactly one play-state class
		const present = presentClasses(container);
		expect(present).toHaveLength(1);
		expect(present[0]).toBe('playing');
	});

	it('phase:ready while playState is paused/idle still sets .paused', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new StatefulContainerEmitter(container, 'idle');

		player.emit('phase', { from: 'idle', to: 'loading' });
		player.emit('phase', { from: 'loading', to: 'ready' });

		expect(container.classList.contains('paused')).toBe(true);
		expect(container.classList.contains('playing')).toBe(false);

		const present = presentClasses(container);
		expect(present).toHaveLength(1);
		expect(present[0]).toBe('paused');
	});

	it('phase:ready while playState is paused (not idle) still sets .paused', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new StatefulContainerEmitter(container, 'paused');

		player.emit('phase', { from: 'idle', to: 'loading' });
		player.emit('phase', { from: 'loading', to: 'ready' });

		expect(container.classList.contains('paused')).toBe(true);
		expect(container.classList.contains('playing')).toBe(false);
	});

	it('playing event after buffering removes buffering and restores playing', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new StatefulContainerEmitter(container, 'idle');

		player.emit('phase', { from: 'idle', to: 'loading' });
		player.emit('phase', { from: 'loading', to: 'ready' });

		player._playState = 'playing';
		player.emit('play');
		expect(container.classList.contains('playing')).toBe(true);

		player.emit('waiting');
		expect(container.classList.contains('buffering')).toBe(true);

		player.emit('playing');
		expect(container.classList.contains('playing')).toBe(true);
		expect(container.classList.contains('buffering')).toBe(false);
		expect(container.classList.contains('paused')).toBe(false);

		const present = presentClasses(container);
		expect(present).toHaveLength(1);
		expect(present[0]).toBe('playing');
	});

	it('WeakMap guard: post-ready phase:loading still does not clobber playing class', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new StatefulContainerEmitter(container, 'idle');

		player.emit('phase', { from: 'idle', to: 'loading' });
		player.emit('phase', { from: 'loading', to: 'ready' });

		player._playState = 'playing';
		player.emit('play');
		expect(container.classList.contains('playing')).toBe(true);

		player.emit('phase', { from: 'playing', to: 'loading' });
		expect(container.classList.contains('playing')).toBe(true);
		expect(container.classList.contains('loading')).toBe(false);
	});
});
