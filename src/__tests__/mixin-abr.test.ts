// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slice 03 — consequence-pinning tests for `abrMethods`.
 *
 * Pinned consequences:
 *  1. `bandwidth()` returns 0 before any estimator is set.
 *  2. `bandwidthEstimator(fn)` stores the function; `bandwidthEstimator()` returns it.
 *  3. `canPlay({ contentType })` returns an object with `{ supported: boolean }` shape.
 *  4. `bandwidthEstimator(fn)` makes `bandwidth()` return `fn()`'s value — the
 *     override actually feeds the getter, not just a separate cache slot.
 *  5. `bandwidth()` falls through to the active backend's own
 *     `bandwidthEstimate()` when no consumer override is set.
 *  6. A consumer-set `bandwidthEstimator(fn)` still wins over a wired
 *     backend estimate.
 *  7. `bandwidth()` returns 0 (never `NaN`) when the wired backend has no
 *     `bandwidthEstimate` capability.
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
	declare bandwidth: () => number;
	declare bandwidthEstimator: { (): (() => number) | undefined; (fn: () => number): void };
	declare canPlay: (profile: { contentType: string; width?: number; height?: number; bitrate?: number; framerate?: number }) => Promise<{ supported: boolean; smooth: boolean; powerEfficient: boolean }>;

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

function wireBackend(player: MockPlayer, backend: { bandwidthEstimate?: () => number }): void {
	(player as unknown as { backend: () => unknown }).backend = (): unknown => backend;
}

describe('abrMethods (slice 03)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('bandwidth() returns 0 before any estimator is wired', () => {
		const player = makePlayer('abr-1');

		const result = player.bandwidth();

		expect(result).toBe(0);
	});

	it('bandwidthEstimator(fn) stores the function; bandwidthEstimator() returns that exact reference', () => {
		const player = makePlayer('abr-2');
		const estimator = (): number => 1234;

		player.bandwidthEstimator(estimator);
		const stored = player.bandwidthEstimator();

		expect(stored).toBe(estimator);
	});

	it('canPlay({ contentType }) returns an object with a boolean `supported` field', async () => {
		const player = makePlayer('abr-3');

		const result = await player.canPlay({ contentType: 'video/mp4' });

		expect(result).toBeDefined();
		expect(typeof result.supported).toBe('boolean');
	});

	it('bandwidthEstimator(fn) makes bandwidth() return fn()\'s value', () => {
		const player = makePlayer('abr-4');

		player.bandwidthEstimator(() => 12_345);

		expect(player.bandwidth()).toBe(12_345);
	});

	it('bandwidth() returns the backend\'s live bandwidthEstimate() when no estimator is wired', () => {
		const player = makePlayer('abr-5');
		wireBackend(player, { bandwidthEstimate: () => 2_500_000 });

		expect(player.bandwidth()).toBe(2_500_000);
	});

	it('a consumer-set bandwidthEstimator(fn) wins over a wired backend estimate', () => {
		const player = makePlayer('abr-6');
		wireBackend(player, { bandwidthEstimate: () => 2_500_000 });

		player.bandwidthEstimator(() => 999);

		expect(player.bandwidth()).toBe(999);
	});

	it('bandwidth() returns 0 when the wired backend has no bandwidthEstimate capability', () => {
		const player = makePlayer('abr-7');
		wireBackend(player, {});

		expect(player.bandwidth()).toBe(0);
	});
});
