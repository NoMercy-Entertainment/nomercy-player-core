// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended coverage for `timeMethods`.
 *
 * Pinned consequences:
 *  TM-E1. duration() returns 0 before any metadata loads (_internalDuration = 0).
 *  TM-E2. buffered() returns 0 when no backend is wired.
 *  TM-E3. timeData() snapshot is self-consistent (remaining = duration - position).
 *  TM-E4. seekByPercentage(50) on a 100s clip positions to 50s.
 *  TM-E5. seekByPercentage is a no-op when duration is 0.
 *  TM-E6. seekByPercentage is a no-op when duration is Infinity.
 *  TM-E7. playbackRate() getter returns 1 initially.
 *  TM-E8. playbackRate(rate) clamps below 0.25 to 0.25.
 *  TM-E9. playbackRate(rate) clamps above 2 to 2.
 *  TM-E10. playbackRate(rate) emits backend:ratechange and forwards to backend.
 *  TM-E11. time(t) clamps negative values to 0.
 *  TM-E12. time() getter returns current position without emitting.
 */

import type { BaseEventMap } from '../types';
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
	container: HTMLElement = {} as HTMLElement;

	get id(): string {
		return this.playerId;
	}

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare time: { (): number; (seconds: number, opts?: Record<string, unknown>): Promise<void> };
	declare duration: () => number;
	declare buffered: () => number;
	declare timeData: () => { position: number; duration: number; buffered: number; remaining: number; percentage: number };
	declare seekByPercentage: (pct: number) => void;
	declare playbackRate: { (): number; (rate: number): void };
	declare playbackRates: () => number[];

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

function makeSetupPlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId).setup({});
}

function setDuration(player: MockPlayer, seconds: number): void {
	(player as unknown as { _internalDuration: number })._internalDuration = seconds;
}

function setPosition(player: MockPlayer, seconds: number): void {
	(player as unknown as { _internalCurrentTime: number })._internalCurrentTime = seconds;
}

describe('timeMethods — extended (TM-E)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('TM-E1: duration() returns 0 before metadata loads', () => {
		const player = makePlayer('tm-1');

		expect(player.duration()).toBe(0);
	});

	it('TM-E2: buffered() returns 0 when no backend is wired', () => {
		const player = makePlayer('tm-2');

		expect(player.buffered()).toBe(0);
	});

	it('bufferedRanges() returns empty TimeRanges when no backend is wired', () => {
		const player = makePlayer('tm-br');
		const ranges = (player as unknown as { bufferedRanges: () => TimeRanges }).bufferedRanges();

		expect(ranges.length).toBe(0);
		expect(ranges.start(0)).toBe(0);
		expect(ranges.end(0)).toBe(0);
	});

	it('seekable() returns empty TimeRanges when no backend is wired', () => {
		const player = makePlayer('tm-sk');
		const ranges = (player as unknown as { seekable: () => TimeRanges }).seekable();

		expect(ranges.length).toBe(0);
	});

	it('TM-E3: timeData() snapshot is self-consistent', () => {
		const player = makePlayer('tm-3');
		setDuration(player, 200);
		setPosition(player, 50);

		const data = player.timeData();

		expect(data.position).toBe(50);
		expect(data.duration).toBe(200);
		expect(data.remaining).toBe(150);
		expect(data.percentage).toBeCloseTo(25);
	});

	it('TM-E3b: timeData() percentage is 0 when duration is 0', () => {
		const player = makePlayer('tm-3b');

		const data = player.timeData();

		expect(data.percentage).toBe(0);
		expect(data.remaining).toBe(0);
	});

	describe('seekByPercentage()', () => {
		it('TM-E4: seekByPercentage(50) on a 100s clip schedules seek to 50s', () => {
			const player = makeSetupPlayer('tm-4');
			setDuration(player, 100);

			const seekCalls: number[] = [];
			const origTime = player.time.bind(player);
			(player as unknown as { time: unknown }).time = (seconds?: number): number | Promise<void> => {
				if (seconds !== undefined) {
					seekCalls.push(seconds);
					return Promise.resolve();
				}
				return origTime();
			};

			player.seekByPercentage(50);

			expect(seekCalls).toHaveLength(1);
			expect(seekCalls[0]).toBeCloseTo(50);
		});

		it('TM-E5: seekByPercentage is a no-op when duration is 0', () => {
			const player = makeSetupPlayer('tm-5');

			const seekCalls: number[] = [];
			const origTime = player.time.bind(player);
			(player as unknown as { time: unknown }).time = (seconds?: number): number | Promise<void> => {
				if (seconds !== undefined) {
					seekCalls.push(seconds);
					return Promise.resolve();
				}
				return origTime();
			};

			player.seekByPercentage(50);

			expect(seekCalls).toHaveLength(0);
		});

		it('TM-E6: seekByPercentage is a no-op when duration is Infinity', () => {
			const player = makeSetupPlayer('tm-6');
			setDuration(player, Infinity);

			const seekCalls: number[] = [];
			const origTime = player.time.bind(player);
			(player as unknown as { time: unknown }).time = (seconds?: number): number | Promise<void> => {
				if (seconds !== undefined) {
					seekCalls.push(seconds);
					return Promise.resolve();
				}
				return origTime();
			};

			player.seekByPercentage(50);

			expect(seekCalls).toHaveLength(0);
		});
	});

	describe('playbackRate()', () => {
		it('TM-E7: playbackRate() getter returns 1 initially', () => {
			const player = makePlayer('tm-7');

			expect(player.playbackRate()).toBe(1);
		});

		it('TM-E8: playbackRate clamps below 0.25 to 0.25', () => {
			const player = makePlayer('tm-8');

			player.playbackRate(0.1);

			expect(player.playbackRate()).toBe(0.25);
		});

		it('TM-E9: playbackRate clamps above 2 to 2', () => {
			const player = makePlayer('tm-9');

			player.playbackRate(5);

			expect(player.playbackRate()).toBe(2);
		});

		it('TM-E10: playbackRate emits backend:ratechange and forwards to backend', () => {
			const player = makePlayer('tm-10');
			const backendCalls: number[] = [];
			(player as unknown as { backend: () => unknown }).backend = (): unknown => ({
				playbackRate: (rate: number): void => { backendCalls.push(rate); },
			});

			const emitted: Array<{ rate: number }> = [];
			player.on('backend:ratechange' as keyof BaseEventMap, (data: unknown) => {
				emitted.push(data as { rate: number });
			});

			player.playbackRate(1.5);

			expect(emitted).toHaveLength(1);
			expect(emitted[0]!.rate).toBe(1.5);
			expect(backendCalls).toEqual([1.5]);
		});
	});

	describe('time() getter', () => {
		it('TM-E12: time() getter returns current position without side effects', () => {
			const player = makePlayer('tm-12');
			setPosition(player, 42);

			const emitted: unknown[] = [];
			player.on('seek' as keyof BaseEventMap, (data: unknown) => { emitted.push(data); });

			const result = player.time();

			expect(result).toBe(42);
			expect(emitted).toHaveLength(0);
		});
	});

	it('TM-E11: time(negative) clamps to 0 and seeks to 0', async () => {
		const player = makeSetupPlayer('tm-11');
		await player.ready();

		const seekArgs: number[] = [];
		(player as unknown as { backend: () => unknown }).backend = (): unknown => ({
			currentTime: (seconds: number): void => { seekArgs.push(seconds); },
		});

		await player.time(-5);

		expect(seekArgs[0]).toBe(0);
	});

	it('playbackRates() returns the fixed list [0.5, 0.75, 1, 1.25, 1.5, 2]', () => {
		const player = makePlayer('tm-rates');

		expect(player.playbackRates()).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2]);
	});
});
