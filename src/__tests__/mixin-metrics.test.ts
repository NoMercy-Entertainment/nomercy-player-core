// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slice 03 — consequence-pinning tests for `metricsMethods`.
 *
 * Pinned consequences:
 *  10. `metrics()` returns an object with a `sessionDurationMs` field of type number.
 *  11. `recordMetric('ttfb', 99)` causes the next `metrics()` call to return an
 *      object where `ttfb === 99`.
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
	declare metrics: () => Record<string, number | null>;
	declare recordMetric: (name: string, value: number) => void;

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

describe('metricsMethods (slice 03)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('metrics() returns an object containing sessionDurationMs as a number', () => {
		const player = makePlayer('metrics-1');

		const snapshot = player.metrics();

		expect(snapshot).toBeDefined();
		expect(typeof snapshot['sessionDurationMs']).toBe('number');
	});

	it('recordMetric("ttfb", 99) causes metrics().ttfb to equal 99', () => {
		const player = makePlayer('metrics-2');

		player.recordMetric('ttfb', 99);
		const snapshot = player.metrics();

		expect(snapshot['ttfb']).toBe(99);
	});
});
