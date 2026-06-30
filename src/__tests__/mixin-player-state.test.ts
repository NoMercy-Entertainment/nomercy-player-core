// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slice 03 — consequence-pinning tests for `playerStateMethods`.
 *
 * Pinned consequences:
 *  12. `bufferState()` returns a value from the `BufferState` enum.
 *  13. `networkState()` returns a value from the `NetworkState` enum.
 *  14. `qualityMode('auto')` causes `qualityMode()` to return `QualityState.AUTO`.
 */

import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	BufferState,
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	NetworkState,
	playerCoreMethods,
	QualityState,
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
	declare bufferState: () => BufferState;
	declare networkState: () => NetworkState;
	declare qualityMode: { (): QualityState; (target: number | 'auto'): void };

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

const BUFFER_STATE_VALUES = new Set(Object.values(BufferState));
const NETWORK_STATE_VALUES = new Set(Object.values(NetworkState));

describe('playerStateMethods (slice 03)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('bufferState() returns a value from the BufferState enum', () => {
		const player = makePlayer('ps-1');

		const state = player.bufferState();

		expect(BUFFER_STATE_VALUES.has(state)).toBe(true);
	});

	it('networkState() returns a value from the NetworkState enum', () => {
		const player = makePlayer('ps-2');

		const state = player.networkState();

		expect(NETWORK_STATE_VALUES.has(state)).toBe(true);
	});

	it('qualityMode("auto") causes qualityMode() to return QualityState.AUTO', () => {
		const player = makePlayer('ps-3');

		player.qualityMode('auto');
		const result = player.qualityMode();

		expect(result).toBe(QualityState.AUTO);
	});
});
