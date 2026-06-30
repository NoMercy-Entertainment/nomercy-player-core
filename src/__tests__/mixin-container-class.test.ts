// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slice 03 — consequence-pinning tests for `containerClassEmitMethods`.
 *
 * Reads the CURRENT rules table in container-class-emit.ts before asserting:
 *  - `'play'` event → swap: adds `'playing'`, removes competing play-state classes.
 *  - `'mute'` event → toggle `'muted'` via `{ muted: boolean }` payload.
 *  - `'phase' { to: 'loading' }` BEFORE ready → adds `'loading'`.
 *    After the first `ready`, a subsequent `loading` is a no-op (resting class stays).
 *    These tests pin the PRE-ready path only; the post-ready no-op is covered in
 *    container-class-loading-regression.test.ts.
 *
 * Uses the minimal `ContainerEmitter` pattern from that regression test to avoid
 * coupling to the full player lifecycle.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { EventEmitter } from '../adapters/event-bus/default';
import { containerClassEmitMethods } from '../core/mixins/container-class-emit';

class ContainerEmitter extends EventEmitter<Record<string, unknown>> {
	constructor(public readonly container: HTMLElement) {
		super();
	}

	override emit = containerClassEmitMethods.emit as unknown as (event: string, data?: unknown) => void;

	get _playState(): string {
		return 'idle';
	}
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('containerClassEmitMethods (slice 03)', () => {
	it('emitting "play" adds "playing" class and removes "paused"', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		container.classList.add('paused');

		player.emit('play');

		expect(container.classList.contains('playing')).toBe(true);
		expect(container.classList.contains('paused')).toBe(false);
	});

	it('emitting "mute" with { muted: true } adds "muted" class; { muted: false } removes it', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		player.emit('mute', { muted: true });
		expect(container.classList.contains('muted')).toBe(true);

		player.emit('mute', { muted: false });
		expect(container.classList.contains('muted')).toBe(false);
	});

	it('phase transition to "loading" before ready adds "loading" class to container', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const player = new ContainerEmitter(container);

		player.emit('phase', { from: 'idle', to: 'loading' });

		expect(container.classList.contains('loading')).toBe(true);
	});
});
