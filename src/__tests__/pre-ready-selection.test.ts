// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Regression: `item(target)` called between `setup()` and `ready()` addressed a
 * queue the configured playlist had not seeded yet, so the cursor never moved
 * and the choice was lost — a `?season=&episode=` deep link opened on item 1.
 */

import type { BaseEventMap, BasePlaylistItem } from '../types';
import { beforeEach, describe, expect, it } from 'vitest';
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
	declare index: () => number;
	declare item: { (): BasePlaylistItem | undefined; (target: unknown, opts?: any): void };
	declare queue: { (): ReadonlyArray<BasePlaylistItem>; (items: BasePlaylistItem[]): void };

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

const playlist: BasePlaylistItem[] = [
	{ id: 'e1', url: 'http://example.test/e1.mp4' },
	{ id: 'e2', url: 'http://example.test/e2.mp4' },
	{ id: 'e3', url: 'http://example.test/e3.mp4' },
];

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	const player = new MockPlayer(divId);
	(player as unknown as { _resolveBackend: () => unknown })._resolveBackend = () => ({
		load: async () => {},
		play: async () => {},
		pause: () => {},
	});
	return player;
}

describe('selecting an item before ready()', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('honours an index picked before the configured playlist seeded', async () => {
		const player = makePlayer('pre-ready-index').setup({ playlist });

		player.item(1);
		await player.ready();

		expect(player.index()).toBe(1);
		expect(player.item()?.id).toBe('e2');
	});

	it('honours an id picked before the configured playlist seeded', async () => {
		const player = makePlayer('pre-ready-id').setup({ playlist });

		player.item('e3');
		await player.ready();

		expect(player.item()?.id).toBe('e3');
	});

	it('leaves the cursor on the first item when nothing was picked', async () => {
		const player = makePlayer('pre-ready-none').setup({ playlist });

		await player.ready();

		expect(player.index()).toBe(0);
	});

	it('still moves the cursor when the consumer seeded the queue itself', async () => {
		const player = makePlayer('pre-ready-seeded').setup({ playlist });

		player.queue(playlist);
		player.item(2);
		await player.ready();

		expect(player.item()?.id).toBe('e3');
	});
});
