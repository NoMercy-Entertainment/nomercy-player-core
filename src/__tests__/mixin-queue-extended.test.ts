// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended coverage for `queueMethods`.
 *
 * Pinned consequences:
 *  Q-E1.  queuePrepend prepends item(s) and emits queue:prepend.
 *  Q-E2.  queueInsert inserts at index and emits queue:insert.
 *  Q-E3.  queueRemoveAt removes the item at index and emits queue:remove.
 *  Q-E4.  queueMove swaps positions and emits queue:move.
 *  Q-E5.  queueSort sorts in-place and emits queue:sort.
 *  Q-E6.  queueShuffle reorders in-place and emits queue:shuffle.
 *  Q-E7.  queueLength returns the item count.
 *  Q-E8.  queueIndexOf returns correct zero-based index or -1.
 *  Q-E9.  seekToIndex(1) navigates to the first item by 1-based ordinal.
 *  Q-E10. seekToIndex with non-positive or non-integer throws RangeError.
 *  Q-E11. seekToIndex with out-of-range ordinal is a no-op.
 *  Q-E12. item(predicate) — function predicate finds and sets cursor.
 *  Q-E13. index() returns the zero-based cursor index.
 *  Q-E14. backlogAppend appends and emits backlog:append.
 *  Q-E15. backlogRemove removes by id and emits backlog:remove.
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
	container: HTMLElement = {} as HTMLElement;

	get id(): string {
		return this.playerId;
	}

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare queue: { (): ReadonlyArray<BasePlaylistItem>; (items: BasePlaylistItem[]): void };
	declare queueAppend: (item: BasePlaylistItem | BasePlaylistItem[]) => void;
	declare queuePrepend: (item: BasePlaylistItem | BasePlaylistItem[]) => void;
	declare queueInsert: (item: BasePlaylistItem | BasePlaylistItem[], index: number) => void;
	declare queueRemove: (id: string | number) => void;
	declare queueRemoveAt: (index: number) => void;
	declare queueMove: (from: number, to: number) => void;
	declare queueClear: () => void;
	declare queueShuffle: () => void;
	declare queueSort: (compare: (itemA: BasePlaylistItem, itemB: BasePlaylistItem) => number) => void;
	declare queueLength: () => number;
	declare queueIndexOf: (id: string | number) => number;
	declare peekNext: () => BasePlaylistItem | undefined;
	declare peekPrevious: () => BasePlaylistItem | undefined;
	declare item: { (): BasePlaylistItem | undefined; (target: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean)): void };
	declare index: () => number;
	declare seekToIndex: (position: number) => void;
	declare backlog: { (): ReadonlyArray<BasePlaylistItem>; (items: BasePlaylistItem[]): void };
	declare backlogAppend: (item: BasePlaylistItem | BasePlaylistItem[]) => void;
	declare backlogRemove: (id: string | number) => void;
	declare backlogClear: () => void;

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

const makeItem = (id: string): BasePlaylistItem => ({ id, title: id, url: `https://example.com/${id}.mp3` } as BasePlaylistItem);

describe('queueMethods — extended (Q-E)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('Q-E1: queuePrepend prepends and emits queue:prepend', () => {
		const player = makePlayer('q-1');
		player.queue([makeItem('b'), makeItem('c')]);

		let prependEvent: unknown;
		player.on('queue:prepend' as keyof BaseEventMap, (data: unknown) => {
			prependEvent = data;
		});

		player.queuePrepend(makeItem('a'));

		expect((player.queue() as BasePlaylistItem[])[0]!.id).toBe('a');
		expect(prependEvent).toBeDefined();
	});

	it('Q-E2: queueInsert inserts at given index and emits queue:insert', () => {
		const player = makePlayer('q-2');
		player.queue([makeItem('a'), makeItem('c')]);

		let insertEvent: unknown;
		player.on('queue:insert' as keyof BaseEventMap, (data: unknown) => {
			insertEvent = data;
		});

		player.queueInsert(makeItem('b'), 1);

		const items = player.queue() as BasePlaylistItem[];
		expect(items[1]!.id).toBe('b');
		expect(items[2]!.id).toBe('c');
		expect(insertEvent).toBeDefined();
	});

	it('Q-E3: queueRemoveAt removes item at index and emits queue:remove', () => {
		const player = makePlayer('q-3');
		player.queue([makeItem('a'), makeItem('b'), makeItem('c')]);

		let removeEvent: unknown;
		player.on('queue:remove' as keyof BaseEventMap, (data: unknown) => {
			removeEvent = data;
		});

		player.queueRemoveAt(1);

		const items = player.queue() as BasePlaylistItem[];
		expect(items).toHaveLength(2);
		expect(items.some(i => i.id === 'b')).toBe(false);
		expect(removeEvent).toBeDefined();
	});

	it('Q-E4: queueMove swaps positions and emits queue:move', () => {
		const player = makePlayer('q-4');
		player.queue([makeItem('a'), makeItem('b'), makeItem('c')]);

		let moveEvent: unknown;
		player.on('queue:move' as keyof BaseEventMap, (data: unknown) => {
			moveEvent = data;
		});

		player.queueMove(0, 2);

		const items = player.queue() as BasePlaylistItem[];
		expect(items[2]!.id).toBe('a');
		expect(moveEvent).toBeDefined();
	});

	it('Q-E5: queueSort sorts in-place and emits queue:sort', () => {
		const player = makePlayer('q-5');
		player.queue([makeItem('c'), makeItem('a'), makeItem('b')]);

		let sortFired = false;
		player.on('queue:sort' as keyof BaseEventMap, () => {
			sortFired = true;
		});

		player.queueSort((x, y) => String(x.id).localeCompare(String(y.id)));

		const items = player.queue() as BasePlaylistItem[];
		expect(items.map(i => i.id)).toEqual(['a', 'b', 'c']);
		expect(sortFired).toBe(true);
	});

	it('Q-E6: queueShuffle reorders in-place and emits queue:shuffle', () => {
		const player = makePlayer('q-6');
		player.queue([makeItem('a'), makeItem('b'), makeItem('c'), makeItem('d'), makeItem('e')]);

		let shuffleFired = false;
		player.on('queue:shuffle' as keyof BaseEventMap, () => {
			shuffleFired = true;
		});

		player.queueShuffle();

		expect(player.queueLength()).toBe(5);
		expect(shuffleFired).toBe(true);
	});

	it('Q-E7: queueLength returns item count', () => {
		const player = makePlayer('q-7');
		expect(player.queueLength()).toBe(0);

		player.queue([makeItem('a'), makeItem('b'), makeItem('c')]);
		expect(player.queueLength()).toBe(3);
	});

	it('Q-E8: queueIndexOf returns zero-based index or -1', () => {
		const player = makePlayer('q-8');
		player.queue([makeItem('a'), makeItem('b'), makeItem('c')]);

		expect(player.queueIndexOf('a')).toBe(0);
		expect(player.queueIndexOf('c')).toBe(2);
		expect(player.queueIndexOf('z')).toBe(-1);
	});

	it('Q-E9: seekToIndex(1) navigates to the first item by 1-based ordinal', () => {
		const player = makePlayer('q-9');
		player.queue([makeItem('a'), makeItem('b'), makeItem('c')]);
		player.item('b');

		player.seekToIndex(1);

		expect(player.index()).toBe(0);
	});

	it('Q-E10: seekToIndex with non-positive integer throws RangeError', () => {
		const player = makePlayer('q-10');
		player.queue([makeItem('a'), makeItem('b')]);

		expect(() => player.seekToIndex(0)).toThrow(RangeError);
		expect(() => player.seekToIndex(-1)).toThrow(RangeError);
	});

	it('Q-E10b: seekToIndex with non-integer throws RangeError', () => {
		const player = makePlayer('q-10b');
		player.queue([makeItem('a'), makeItem('b')]);

		expect(() => player.seekToIndex(1.5)).toThrow(RangeError);
	});

	it('Q-E11: seekToIndex with out-of-range ordinal is a no-op', () => {
		const player = makePlayer('q-11');
		player.queue([makeItem('a'), makeItem('b')]);
		player.item('a');

		player.seekToIndex(99);

		expect(player.index()).toBe(0);
	});

	it('Q-E12: item(predicate) function predicate finds and sets cursor', () => {
		const player = makePlayer('q-12');
		player.queue([makeItem('a'), makeItem('b'), makeItem('c')]);

		player.item((item: BasePlaylistItem) => item.id === 'b');

		expect(player.item()?.id).toBe('b');
	});

	it('Q-E13: index() returns zero-based cursor position', () => {
		const player = makePlayer('q-13');
		player.queue([makeItem('a'), makeItem('b'), makeItem('c')]);
		player.item('c');

		expect(player.index()).toBe(2);
	});

	it('Q-E14: backlogAppend appends and emits backlog:append', () => {
		const player = makePlayer('q-14');
		let appendFired = false;
		player.on('backlog:append' as keyof BaseEventMap, () => {
			appendFired = true;
		});

		player.backlogAppend(makeItem('x'));

		expect((player.backlog() as BasePlaylistItem[]).some(i => i.id === 'x')).toBe(true);
		expect(appendFired).toBe(true);
	});

	it('item(target) on an idle player sets cursor but does not trigger load', () => {
		const player = makePlayer('q-idle');
		player.queue([makeItem('a'), makeItem('b')]);

		let mediaReadyFired = false;
		player.on('mediaReady' as keyof BaseEventMap, () => { mediaReadyFired = true; });

		player.item('b');

		expect(player.item()?.id).toBe('b');
		expect(mediaReadyFired).toBe(false);
	});

	it('Q-E15: backlogRemove removes by id and emits backlog:remove', () => {
		const player = makePlayer('q-15');
		player.backlog([makeItem('x'), makeItem('y')]);

		let removeFired = false;
		player.on('backlog:remove' as keyof BaseEventMap, () => {
			removeFired = true;
		});

		player.backlogRemove('x');

		expect((player.backlog() as BasePlaylistItem[]).some(i => i.id === 'x')).toBe(false);
		expect(removeFired).toBe(true);
	});
});
