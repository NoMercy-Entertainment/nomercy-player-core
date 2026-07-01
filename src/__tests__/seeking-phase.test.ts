// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Locks the `seeking` phase round-trip per spec §D.
 *
 * Every seek action — `time(t)`, `rewind`, `forward`, `restart` — must
 * transition `priorPhase → seeking → priorPhase` when the prior phase is one of
 * `playing` / `paused` / `starting`. Seeks during `ready` (pre-play) skip the
 * round-trip. `beforeSeek.preventDefault()` cancels both the seek AND the phase
 * round-trip.
 */

import type { PlayerTestInternals } from '../testing/player-test-internals';
import type { BaseEventMap, PlayerPhase } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = <HTMLElement>{};

	get id(): string {
		return this.playerId;
	}

	declare options: any;
	declare setup: (config: any) => this;
	declare ready: () => Promise<void>;
	declare phase: () => string;
	declare play: (opts?: any) => Promise<void>;
	declare pause: (opts?: any) => Promise<void>;
	declare time: { (): number; (t: number, opts?: any): Promise<void> };
	declare rewind: (s?: number, opts?: any) => Promise<void>;
	declare forward: (s?: number, opts?: any) => Promise<void>;
	declare restart: (opts?: any) => Promise<void>;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing') {
			return resolved.instance as unknown as this;
		}
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void {
		_instances.clear();
	}
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

function phaseTrace(mockPlayer: MockPlayer): Array<{ from: PlayerPhase; to: PlayerPhase }> {
	const trace: Array<{ from: PlayerPhase; to: PlayerPhase }> = [];
	mockPlayer.on('phase', ({ from, to }) => {
		trace.push({ from, to });
	});
	return trace;
}

describe('seeking phase round-trip (spec §D)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	// ── 1. paused → seeking → paused ──

	it('time(t) from paused: [paused→seeking, seeking→paused]', async () => {
		const mockPlayer = makePlayer('sp-paused').setup({});
		await mockPlayer.ready();
		await mockPlayer.play();
		await mockPlayer.pause();
		expect(mockPlayer.phase()).toBe('paused');

		const trace = phaseTrace(mockPlayer);
		await mockPlayer.time(10);

		expect(trace).toEqual([
			{ from: 'paused', to: 'seeking' },
			{ from: 'seeking', to: 'paused' },
		]);
	});

	// ── 2. playing → seeking → playing ──
	// 'playing' phase requires firstFrame which the kit doesn't emit on its own;
	// directly set the internal field to simulate a backend that has begun
	// rendering. This mirrors what a backend would do via _transitionPhase.

	it('time(t) from playing: [playing→seeking, seeking→playing]', async () => {
		const mockPlayer = makePlayer('sp-playing').setup({});
		await mockPlayer.ready();
		await mockPlayer.play();
		// Force the phase machine into 'playing' as a backend would after firstFrame.
		(mockPlayer as unknown as PlayerTestInternals)._phase = 'playing';

		const trace = phaseTrace(mockPlayer);
		await mockPlayer.time(10);

		expect(trace).toEqual([
			{ from: 'playing', to: 'seeking' },
			{ from: 'seeking', to: 'playing' },
		]);
	});

	// ── 3. starting → seeking → starting ──

	it('time(t) from starting: [starting→seeking, seeking→starting]', async () => {
		const mockPlayer = makePlayer('sp-starting').setup({});
		await mockPlayer.ready();
		await mockPlayer.play();
		expect(mockPlayer.phase()).toBe('starting');

		const trace = phaseTrace(mockPlayer);
		await mockPlayer.time(10);

		expect(trace).toEqual([
			{ from: 'starting', to: 'seeking' },
			{ from: 'seeking', to: 'starting' },
		]);
	});

	// ── 4. ready → no phase event ──

	it('time(t) from ready: NO phase event (skip the round-trip)', async () => {
		const mockPlayer = makePlayer('sp-ready').setup({});
		await mockPlayer.ready();
		expect(mockPlayer.phase()).toBe('ready');

		const trace = phaseTrace(mockPlayer);
		await mockPlayer.time(10);

		expect(trace).toEqual([]);
	});

	// ── 5. rewind / forward / restart all do the same round-trip ──

	it('rewind(5) from paused: [paused→seeking, seeking→paused]', async () => {
		const mockPlayer = makePlayer('sp-rewind').setup({});
		await mockPlayer.ready();
		await mockPlayer.play();
		await mockPlayer.pause();

		const trace = phaseTrace(mockPlayer);
		await mockPlayer.rewind(5);

		expect(trace).toEqual([
			{ from: 'paused', to: 'seeking' },
			{ from: 'seeking', to: 'paused' },
		]);
	});

	it('forward(5) from paused: [paused→seeking, seeking→paused]', async () => {
		const mockPlayer = makePlayer('sp-forward').setup({});
		await mockPlayer.ready();
		await mockPlayer.play();
		await mockPlayer.pause();

		const trace = phaseTrace(mockPlayer);
		await mockPlayer.forward(5);

		expect(trace).toEqual([
			{ from: 'paused', to: 'seeking' },
			{ from: 'seeking', to: 'paused' },
		]);
	});

	it('restart() from paused: round-trip then play (paused→seeking→paused, then on to starting)', async () => {
		const mockPlayer = makePlayer('sp-restart').setup({});
		await mockPlayer.ready();
		await mockPlayer.play();
		await mockPlayer.pause();

		const trace = phaseTrace(mockPlayer);
		await mockPlayer.restart();

		// First two transitions are the seek round-trip.
		expect(trace[0]).toEqual({ from: 'paused', to: 'seeking' });
		expect(trace[1]).toEqual({ from: 'seeking', to: 'paused' });
		// Then play() kicks the phase to 'starting'.
		expect(trace[2]).toEqual({ from: 'paused', to: 'starting' });
	});

	// ── 6. preventDefault on beforeSeek skips phase change entirely ──

	it('beforeSeek.preventDefault() → NO phase change', async () => {
		const mockPlayer = makePlayer('sp-prevent').setup({});
		await mockPlayer.ready();
		await mockPlayer.play();
		await mockPlayer.pause();

		mockPlayer.on('beforeSeek', (beforeEvent) => {
			beforeEvent.preventDefault();
		});

		const trace = phaseTrace(mockPlayer);
		await mockPlayer.time(10);

		expect(trace).toEqual([]);
		expect(mockPlayer.phase()).toBe('paused');
	});
});
