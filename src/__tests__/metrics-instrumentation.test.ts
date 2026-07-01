// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Spec §T metrics instrumentation lock-in.
 *
 * Tests the per-event hooks installed during `setup()`:
 *  - TTFF (time-to-first-frame): captured on first `play` → `firstFrame` pair.
 *  - joinTime: ready→firstFrame total.
 *  - rebufferRatio: cumulative `backend:waiting` durations / session duration.
 *  - Periodic `playback:metrics` emit per `metricsIntervalMs`.
 *
 * Uses real timers + manual event firing to avoid flaky timing assertions.
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
	container: HTMLElement = <HTMLElement>{};

	get id(): string {
		return this.playerId;
	}

	declare options: any;
	declare setup: (config: any) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare metrics: () => any;
	declare recordMetric: (name: string, value: number) => void;

	constructor(id?: string | number) {
		super();
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing') {
			return resolved.instance as unknown as this;
		}
		initPlayerCoreState(this, { className: 'MockPlayer' });
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void {
		_instances.clear();
	}
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function make(divId: string, opts?: any): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId).setup(opts ?? {});
}

describe('metrics instrumentation', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('records TTFF on the first play → firstFrame pair', async () => {
		const mockPlayer = make('m1', { metricsIntervalMs: 0 });
		await mockPlayer.ready();

		expect(mockPlayer.metrics().ttff).toBe(0);

		mockPlayer.emit('play', {});
		await new Promise(r => setTimeout(r, 30));
		mockPlayer.emit('firstFrame');

		const ttff = mockPlayer.metrics().ttff;
		expect(ttff).toBeGreaterThan(0);
		expect(ttff).toBeLessThan(2000);
	});

	it('does not overwrite TTFF on a second play→firstFrame pair', async () => {
		const mockPlayer = make('m2', { metricsIntervalMs: 0 });
		await mockPlayer.ready();

		mockPlayer.emit('play', {});
		await new Promise(r => setTimeout(r, 20));
		mockPlayer.emit('firstFrame');
		const firstTtff = mockPlayer.metrics().ttff;

		// Second play+frame — should NOT reset TTFF.
		mockPlayer.emit('play', {});
		await new Promise(r => setTimeout(r, 50));
		mockPlayer.emit('firstFrame');

		expect(mockPlayer.metrics().ttff).toBe(firstTtff);
	});

	it('records joinTime as ready→firstFrame elapsed', async () => {
		const mockPlayer = make('m3', { metricsIntervalMs: 0 });
		await mockPlayer.ready();

		expect(mockPlayer.metrics().joinTime).toBe(0);

		mockPlayer.emit('play', {});
		await new Promise(r => setTimeout(r, 25));
		mockPlayer.emit('firstFrame');

		expect(mockPlayer.metrics().joinTime).toBeGreaterThan(0);
	});

	it('accumulates rebufferRatio across multiple stalls', async () => {
		const mockPlayer = make('m4', { metricsIntervalMs: 0 });
		await mockPlayer.ready();

		expect(mockPlayer.metrics().rebufferRatio).toBe(0);

		// Stall 1
		mockPlayer.emit('backend:waiting');
		await new Promise(r => setTimeout(r, 30));
		mockPlayer.emit('backend:loaded');

		// Stall 2
		mockPlayer.emit('backend:waiting');
		await new Promise(r => setTimeout(r, 30));
		mockPlayer.emit('play', {});

		const ratio = mockPlayer.metrics().rebufferRatio;
		expect(ratio).toBeGreaterThan(0);
		// ratio ≤ 1 by definition; in this test the entire session is stalls,
		// so it can hit 1.0 exactly.
		expect(ratio).toBeLessThanOrEqual(1);
	});

	it('recordMetric writes custom fields to the snapshot', async () => {
		const mockPlayer = make('m5', { metricsIntervalMs: 0 });
		await mockPlayer.ready();

		mockPlayer.recordMetric('customFoo', 42);
		expect(mockPlayer.metrics().customFoo).toBe(42);
	});

	it('metrics() snapshot includes a fresh sessionDurationMs', async () => {
		const mockPlayer = make('m6', { metricsIntervalMs: 0 });
		await mockPlayer.ready();

		await new Promise(r => setTimeout(r, 30));
		const snap = mockPlayer.metrics();
		expect(snap.sessionDurationMs).toBeGreaterThan(0);
	});

	it('periodic playback:metrics emit fires per metricsIntervalMs', async () => {
		const mockPlayer = make('m7', { metricsIntervalMs: 50 });
		await mockPlayer.ready();

		const seen: any[] = [];
		mockPlayer.on('playback:metrics', (data: unknown) => seen.push(data));

		await new Promise(r => setTimeout(r, 130));

		expect(seen.length).toBeGreaterThanOrEqual(2);
	});

	it('metricsIntervalMs: 0 disables periodic emit', async () => {
		const mockPlayer = make('m8', { metricsIntervalMs: 0 });
		await mockPlayer.ready();

		const seen: any[] = [];
		mockPlayer.on('playback:metrics', (data: unknown) => seen.push(data));

		await new Promise(r => setTimeout(r, 100));

		expect(seen.length).toBe(0);
	});
});
