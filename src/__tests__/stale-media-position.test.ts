// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * The cursor moves BEFORE the media switch (`transport.next()`), so between a
 * `next()` and the backend finishing its mount the outgoing item's element is
 * still attached and still ticking. Those positions must not be readable as
 * the incoming item's position — a consumer that believes them reports the
 * previous episode's end position against the next episode.
 */

import type { BaseEventMap, BasePlaylistItem } from '../types';
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
	declare load: (item: BasePlaylistItem, opts?: any) => Promise<void>;
	declare queue: (items?: BasePlaylistItem[]) => any;
	declare item: (target?: any, opts?: any) => any;
	declare next: (opts?: any) => Promise<void>;
	declare time: (seconds?: number) => any;
	declare duration: () => number;

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

const EPISODE_A: BasePlaylistItem = { id: 'ep-a', title: 'Episode A', url: '/a.m3u8' } as BasePlaylistItem;
const EPISODE_B: BasePlaylistItem = { id: 'ep-b', title: 'Episode B', url: '/b.m3u8' } as BasePlaylistItem;

interface GatedBackend {
	/** Make the NEXT `backend.load()` hang, so assertions can land mid-mount. */
	hold: () => void;
	/** Release the held `backend.load()`, standing in for the media mount completing. */
	finishLoad: () => void;
}

function makePlayer(divId: string): { player: MockPlayer; backend: GatedBackend } {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	const player = new MockPlayer(divId).setup({});

	let release: (() => void) | undefined;
	let held = false;

	(player as unknown as { _resolveBackend: () => unknown })._resolveBackend = (): unknown => ({
		load: async (): Promise<void> => {
			if (!held)
				return;
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		},
		play: (): void => {},
		currentTime: (): void => {},
		buffered: (): number => 0,
	});

	return {
		player,
		backend: {
			hold: (): void => {
				held = true;
			},
			finishLoad: (): void => {
				held = false;
				release?.();
				release = undefined;
			},
		},
	};
}

/** Let the `beforeNext` dispatch settle so the cursor has moved, while the mount stays held. */
async function flush(): Promise<void> {
	await new Promise(resolve => setTimeout(resolve, 0));
}

/** Stand in for a backend `timeupdate` tick — the same channel the per-library bridges emit on. */
function tick(player: MockPlayer, position: number): void {
	player.emit('time', (player as unknown as { _timeStateAt: (seconds: number) => unknown })._timeStateAt(position) as never);
}

describe('position ownership across an item change', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('drops the outgoing item position the moment the cursor moves to the next item', async () => {
		const { player, backend } = makePlayer('stale-1');
		await player.ready();

		player.queue([EPISODE_A, EPISODE_B]);
		await player.load(EPISODE_A);

		tick(player, 1300);
		expect(player.time()).toBe(1300);

		// Hold the next mount so the assertions land inside the window the old
		// element is still attached in.
		backend.hold();
		void player.next();
		await flush();

		expect((player.item() as BasePlaylistItem).id).toBe('ep-b');
		expect(player.time()).toBe(0);
		expect(player.duration()).toBe(0);
	});

	it('reports the media as stale until the incoming item finishes mounting', async () => {
		const { player, backend } = makePlayer('stale-2');
		await player.ready();

		player.queue([EPISODE_A, EPISODE_B]);
		await player.load(EPISODE_A);

		const isStale = (): boolean => (player as unknown as { _mediaIsStale: () => boolean })._mediaIsStale();
		expect(isStale()).toBe(false);

		backend.hold();
		const advance = player.next();
		await flush();

		expect(isStale()).toBe(true);

		backend.finishLoad();
		await advance;

		expect(isStale()).toBe(false);
	});

	it('treats a player that never loaded an item as not stale', () => {
		const { player } = makePlayer('stale-3');
		player.queue([EPISODE_A]);

		expect((player as unknown as { _mediaIsStale: () => boolean })._mediaIsStale()).toBe(false);
	});
});
