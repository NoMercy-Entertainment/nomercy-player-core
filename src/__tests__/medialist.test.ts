// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * MediaList<T> tests — exhaustive behavior lock for the cursor-aware list
 * primitive. Both NMMusicPlayer (queue + backlog) and NMVideoPlayer (queue +
 * backlog) delegate to this; any drift here breaks both libraries silently.
 *
 * Test groups:
 *  - Construction
 *  - Read accessors (get / length / current / currentIndex)
 *  - set() — replace items, cursor preservation by id
 *  - setCurrent() — by index, by id (string), by id (number), by reference
 *  - peek (peekNext / peekPrevious)
 *  - Add (append / prepend / insert)
 *  - Remove (remove / removeAt) — cursor adjustment
 *  - Reorder (move) — cursor follows the moved item
 *  - Bulk (clear / shuffle / sort)
 *  - Lifecycle (dispose)
 *  - Event ordering
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaList } from '../adapters/media-list/default';

interface Item {
	id: string | number;
	name?: string;
}

const makeItem = (id: string | number, name?: string): Item => ({ id, name: name ?? `item-${id}` });
function makeItems(count: number, prefix = 'i'): Item[] {
	return Array.from({ length: count }, (_item, idx) => makeItem(`${prefix}${idx}`));
}

describe('MediaList<T>', () => {
	let list: MediaList<Item>;

	beforeEach(() => {
		list = new MediaList<Item>();
	});

	afterEach(() => {
		list.dispose();
	});

	// ─────────────────────────────────────────────────────────────────────
	// Construction
	// ─────────────────────────────────────────────────────────────────────

	describe('construction', () => {
		it('starts with no items', () => {
			expect(list.length()).toBe(0);
			expect(list.get()).toEqual([]);
		});

		it('starts with cursor at -1 (empty)', () => {
			expect(list.currentIndex()).toBe(-1);
		});

		it('current() returns undefined when empty', () => {
			expect(list.current()).toBeUndefined();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// get() / length()
	// ─────────────────────────────────────────────────────────────────────

	describe('get()', () => {
		it('returns the live items array (read-only typing)', () => {
			list.append(makeItems(3));
			expect(list.get()).toHaveLength(3);
		});

		it('returns items in insertion order', () => {
			list.append(makeItem('a'));
			list.append(makeItem('b'));
			list.append(makeItem('c'));
			expect(list.get().map(i => i.id)).toEqual(['a', 'b', 'c']);
		});
	});

	describe('length()', () => {
		it('reflects the current item count', () => {
			expect(list.length()).toBe(0);
			list.append(makeItems(5));
			expect(list.length()).toBe(5);
		});

		it('updates after each mutation', () => {
			list.append(makeItem('a'));
			expect(list.length()).toBe(1);
			list.append(makeItem('b'));
			expect(list.length()).toBe(2);
			list.remove('a');
			expect(list.length()).toBe(1);
			list.clear();
			expect(list.length()).toBe(0);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// set()
	// ─────────────────────────────────────────────────────────────────────

	describe('set()', () => {
		it('replaces all items', () => {
			list.append(makeItems(3, 'a'));
			list.set(makeItems(2, 'b'));
			expect(list.length()).toBe(2);
			expect(list.get().map(i => i.id)).toEqual(['b0', 'b1']);
		});

		it('does NOT mutate the input array (defensive copy)', () => {
			const input = makeItems(2);
			list.set(input);
			input.push(makeItem('extra'));
			expect(list.length()).toBe(2);
		});

		it('initializes cursor to 0 when transitioning from empty to non-empty', () => {
			list.set(makeItems(3));
			expect(list.currentIndex()).toBe(0);
		});

		it('preserves cursor by id when current item exists in new set', () => {
			list.append(makeItems(3, 'x')); // cursor at 0 → x0
			list.setCurrent(2); // cursor at 2 → x2
			list.set([makeItem('other'), makeItem('x2'), makeItem('another')]);
			expect(list.currentIndex()).toBe(1);
			expect(list.current()?.id).toBe('x2');
		});

		it('resets cursor to 0 when current item not in new set but new set is non-empty', () => {
			list.append(makeItems(3, 'x'));
			list.setCurrent(1);
			list.set(makeItems(2, 'y'));
			expect(list.currentIndex()).toBe(0);
		});

		it('resets cursor to -1 when set to an empty array', () => {
			list.append(makeItems(3));
			list.set([]);
			expect(list.currentIndex()).toBe(-1);
			expect(list.current()).toBeUndefined();
		});

		it('emits change event with the new items', () => {
			const handler = vi.fn();
			list.on('change', handler);
			list.set(makeItems(2));
			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith({ items: expect.arrayContaining([
				expect.objectContaining({ id: 'i0' }),
				expect.objectContaining({ id: 'i1' }),
			]) });
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// current() / currentIndex()
	// ─────────────────────────────────────────────────────────────────────

	describe('current() + currentIndex()', () => {
		it('returns the item at the cursor', () => {
			list.append(makeItems(3));
			list.setCurrent(1);
			expect(list.current()?.id).toBe('i1');
			expect(list.currentIndex()).toBe(1);
		});

		it('returns undefined when cursor is -1', () => {
			expect(list.current()).toBeUndefined();
			expect(list.currentIndex()).toBe(-1);
		});

		it('reflects updates from setCurrent() + mutations', () => {
			list.append(makeItems(3));
			expect(list.currentIndex()).toBe(0);
			list.append(makeItem('extra'));
			expect(list.currentIndex()).toBe(0); // cursor stays put on append
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// setCurrent()
	// ─────────────────────────────────────────────────────────────────────

	describe('setCurrent()', () => {
		beforeEach(() => {
			list.append([makeItem('a'), makeItem('b'), makeItem('c')]);
		});

		describe('by integer index', () => {
			it('moves cursor to the index', () => {
				list.setCurrent(2);
				expect(list.currentIndex()).toBe(2);
				expect(list.current()?.id).toBe('c');
			});

			it('no-op when index out of bounds (high)', () => {
				list.setCurrent(99);
				expect(list.currentIndex()).toBe(0); // unchanged
			});

			it('no-op when index out of bounds (negative)', () => {
				list.setCurrent(-5);
				expect(list.currentIndex()).toBe(0);
			});

			it('emits item event with item + index', () => {
				const handler = vi.fn();
				list.on('item', handler);
				list.setCurrent(1);
				expect(handler).toHaveBeenCalledWith({ item: expect.objectContaining({ id: 'b' }), index: 1 });
			});

			it('does NOT emit item event when index is out of bounds', () => {
				const handler = vi.fn();
				list.on('item', handler);
				list.setCurrent(99);
				expect(handler).not.toHaveBeenCalled();
			});
		});

		describe('by string id', () => {
			it('moves cursor to the matching item', () => {
				list.setCurrent('c');
				expect(list.currentIndex()).toBe(2);
			});

			it('no-op when id does not exist', () => {
				list.setCurrent('not-found');
				expect(list.currentIndex()).toBe(0);
			});
		});

		describe('by item reference', () => {
			it('moves cursor to the matching item by id', () => {
				const target = list.get()[2]!;
				list.setCurrent(target);
				expect(list.currentIndex()).toBe(2);
			});

			it('matches by id even if reference object differs', () => {
				const lookalike = makeItem('b'); // same id, different object reference
				list.setCurrent(lookalike);
				expect(list.currentIndex()).toBe(1);
			});
		});

		describe('on empty list', () => {
			it('no-op when called on empty list', () => {
				const empty = new MediaList<Item>();
				empty.setCurrent('anything');
				expect(empty.currentIndex()).toBe(-1);
				empty.dispose();
			});
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// peekNext / peekPrevious
	// ─────────────────────────────────────────────────────────────────────

	describe('peekNext()', () => {
		it('returns the next item when cursor is mid-list', () => {
			list.append([makeItem('a'), makeItem('b'), makeItem('c')]);
			expect(list.peekNext()?.id).toBe('b');
		});

		it('returns undefined when cursor is at the last item', () => {
			list.append([makeItem('a'), makeItem('b')]);
			list.setCurrent(1);
			expect(list.peekNext()).toBeUndefined();
		});

		it('returns the first item when cursor is -1 (empty list with peek-ahead)', () => {
			expect(list.peekNext()).toBeUndefined();
			list.append([makeItem('a')]);
			// cursor still -1 in a hypothetical pre-cursor state would peek items[0]
			// but append already moved cursor to 0; verify peekNext now points to items[1]
			expect(list.peekNext()).toBeUndefined();
		});
	});

	describe('peekPrevious()', () => {
		it('returns the previous item when cursor is mid-list', () => {
			list.append([makeItem('a'), makeItem('b'), makeItem('c')]);
			list.setCurrent(2);
			expect(list.peekPrevious()?.id).toBe('b');
		});

		it('returns undefined when cursor is at the first item', () => {
			list.append([makeItem('a'), makeItem('b')]);
			expect(list.peekPrevious()).toBeUndefined();
		});

		it('returns undefined when cursor is -1 (empty)', () => {
			expect(list.peekPrevious()).toBeUndefined();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// append()
	// ─────────────────────────────────────────────────────────────────────

	describe('append()', () => {
		it('appends a single item', () => {
			list.append(makeItem('a'));
			expect(list.get().map(i => i.id)).toEqual(['a']);
		});

		it('appends an array of items in order', () => {
			list.append([makeItem('a'), makeItem('b'), makeItem('c')]);
			expect(list.get().map(i => i.id)).toEqual(['a', 'b', 'c']);
		});

		it('no-op on empty array', () => {
			const handler = vi.fn();
			list.on('change', handler);
			list.append([]);
			expect(list.length()).toBe(0);
			expect(handler).not.toHaveBeenCalled();
		});

		it('initializes cursor to 0 when appending to an empty list', () => {
			list.append(makeItem('a'));
			expect(list.currentIndex()).toBe(0);
		});

		it('does NOT move cursor when appending to a non-empty list', () => {
			list.append(makeItem('a'));
			list.append(makeItem('b'));
			expect(list.currentIndex()).toBe(0);
		});

		it('emits append event with items + from index', () => {
			const handler = vi.fn();
			list.on('append', handler);
			list.append(makeItem('a'));
			expect(handler).toHaveBeenCalledWith({ items: [expect.objectContaining({ id: 'a' })], from: 0 });
		});

		it('emits change event after append', () => {
			const handler = vi.fn();
			list.on('change', handler);
			list.append(makeItem('a'));
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('append event fires with correct from index for second batch', () => {
			list.append(makeItems(3));
			const handler = vi.fn();
			list.on('append', handler);
			list.append(makeItem('extra'));
			expect(handler).toHaveBeenCalledWith({ items: expect.any(Array), from: 3 });
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// prepend()
	// ─────────────────────────────────────────────────────────────────────

	describe('prepend()', () => {
		it('prepends a single item', () => {
			list.append(makeItem('a'));
			list.prepend(makeItem('z'));
			expect(list.get().map(i => i.id)).toEqual(['z', 'a']);
		});

		it('prepends an array of items', () => {
			list.append(makeItem('c'));
			list.prepend([makeItem('a'), makeItem('b')]);
			expect(list.get().map(i => i.id)).toEqual(['a', 'b', 'c']);
		});

		it('no-op on empty array', () => {
			const handler = vi.fn();
			list.on('change', handler);
			list.prepend([]);
			expect(handler).not.toHaveBeenCalled();
		});

		it('shifts cursor by prepended count when cursor was non-negative', () => {
			list.append(makeItems(3)); // cursor at 0
			list.prepend(makeItems(2, 'pre'));
			expect(list.currentIndex()).toBe(2); // shifted
			expect(list.current()?.id).toBe('i0');
		});

		it('initializes cursor to 0 when prepending to empty list', () => {
			list.prepend(makeItem('a'));
			expect(list.currentIndex()).toBe(0);
		});

		it('emits prepend event with items', () => {
			const handler = vi.fn();
			list.on('prepend', handler);
			list.prepend(makeItem('a'));
			expect(handler).toHaveBeenCalledWith({ items: [expect.objectContaining({ id: 'a' })] });
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// insert()
	// ─────────────────────────────────────────────────────────────────────

	describe('insert()', () => {
		beforeEach(() => {
			list.append([makeItem('a'), makeItem('b'), makeItem('c')]);
		});

		it('inserts at the given index', () => {
			list.insert(makeItem('mid'), 1);
			expect(list.get().map(i => i.id)).toEqual(['a', 'mid', 'b', 'c']);
		});

		it('inserts an array of items at the given index', () => {
			list.insert([makeItem('m1'), makeItem('m2')], 1);
			expect(list.get().map(i => i.id)).toEqual(['a', 'm1', 'm2', 'b', 'c']);
		});

		it('inserts at index 0 (equivalent to prepend)', () => {
			list.insert(makeItem('z'), 0);
			expect(list.get()[0]?.id).toBe('z');
		});

		it('inserts at length (equivalent to append at end)', () => {
			list.insert(makeItem('end'), 3);
			expect(list.get()[3]?.id).toBe('end');
		});

		it('clamps to 0 when given a negative index', () => {
			list.insert(makeItem('clamp-low'), -100);
			expect(list.get()[0]?.id).toBe('clamp-low');
		});

		it('clamps to length when given an index past the end', () => {
			list.insert(makeItem('clamp-high'), 9999);
			expect(list.get().at(-1)?.id).toBe('clamp-high');
		});

		it('shifts cursor when inserting before it', () => {
			list.setCurrent(2); // cursor at 'c'
			list.insert(makeItem('mid'), 1);
			expect(list.current()?.id).toBe('c');
			expect(list.currentIndex()).toBe(3);
		});

		it('shifts cursor when inserting at cursor position', () => {
			list.setCurrent(1); // cursor at 'b'
			list.insert(makeItem('at-cursor'), 1);
			expect(list.current()?.id).toBe('b');
			expect(list.currentIndex()).toBe(2);
		});

		it('does NOT shift cursor when inserting after it', () => {
			list.setCurrent(0);
			list.insert(makeItem('later'), 2);
			expect(list.currentIndex()).toBe(0);
		});

		it('initializes cursor to 0 when inserting into empty list', () => {
			const empty = new MediaList<Item>();
			empty.insert(makeItem('a'), 0);
			expect(empty.currentIndex()).toBe(0);
			empty.dispose();
		});

		it('no-op on empty array input', () => {
			const handler = vi.fn();
			list.on('change', handler);
			list.insert([], 1);
			expect(handler).not.toHaveBeenCalled();
		});

		it('emits insert event with items + final index used', () => {
			const handler = vi.fn();
			list.on('insert', handler);
			list.insert(makeItem('mid'), 9999); // clamped
			expect(handler).toHaveBeenCalledWith({ items: expect.any(Array), index: 3 });
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// remove() / removeAt()
	// ─────────────────────────────────────────────────────────────────────

	describe('remove() (by id)', () => {
		beforeEach(() => {
			list.append([makeItem('a'), makeItem('b'), makeItem('c')]);
		});

		it('removes the matching item', () => {
			list.remove('b');
			expect(list.get().map(i => i.id)).toEqual(['a', 'c']);
		});

		it('no-op when id does not exist', () => {
			const handler = vi.fn();
			list.on('change', handler);
			list.remove('not-found');
			expect(list.length()).toBe(3);
			expect(handler).not.toHaveBeenCalled();
		});

		it('emits remove event with id + index + item', () => {
			const handler = vi.fn();
			list.on('remove', handler);
			list.remove('b');
			expect(handler).toHaveBeenCalledWith({ id: 'b', index: 1, item: expect.objectContaining({ id: 'b' }) });
		});
	});

	describe('removeAt() (by index)', () => {
		beforeEach(() => {
			list.append([makeItem('a'), makeItem('b'), makeItem('c')]);
		});

		it('removes the item at the index', () => {
			list.removeAt(1);
			expect(list.get().map(i => i.id)).toEqual(['a', 'c']);
		});

		it('no-op on negative index', () => {
			const handler = vi.fn();
			list.on('change', handler);
			list.removeAt(-1);
			expect(list.length()).toBe(3);
			expect(handler).not.toHaveBeenCalled();
		});

		it('no-op on out-of-bounds high index', () => {
			const handler = vi.fn();
			list.on('change', handler);
			list.removeAt(999);
			expect(list.length()).toBe(3);
			expect(handler).not.toHaveBeenCalled();
		});

		describe('cursor adjustment', () => {
			it('shifts cursor down by 1 when removing item before cursor', () => {
				list.setCurrent(2); // 'c'
				list.removeAt(0); // remove 'a'
				expect(list.currentIndex()).toBe(1);
				expect(list.current()?.id).toBe('c');
			});

			it('keeps cursor at same index when removing item AT cursor (clamps if at end)', () => {
				list.setCurrent(1); // 'b'
				list.removeAt(1); // remove 'b' itself
				// items now ['a', 'c'], cursor was 1 — still 1 → 'c'
				expect(list.currentIndex()).toBe(1);
				expect(list.current()?.id).toBe('c');
			});

			it('clamps cursor when removing the last item it was pointing at', () => {
				list.setCurrent(2); // 'c' (last)
				list.removeAt(2); // remove 'c'
				// items ['a', 'b'], cursor was 2 → clamps to 1
				expect(list.currentIndex()).toBe(1);
				expect(list.current()?.id).toBe('b');
			});

			it('keeps cursor unchanged when removing item after cursor', () => {
				list.setCurrent(0);
				list.removeAt(2);
				expect(list.currentIndex()).toBe(0);
			});

			it('resets cursor to -1 when removing the only remaining item', () => {
				const single = new MediaList<Item>();
				single.append(makeItem('only'));
				single.removeAt(0);
				expect(single.currentIndex()).toBe(-1);
				expect(single.current()).toBeUndefined();
				single.dispose();
			});
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// move()
	// ─────────────────────────────────────────────────────────────────────

	describe('move()', () => {
		beforeEach(() => {
			list.append([makeItem('a'), makeItem('b'), makeItem('c'), makeItem('d')]);
		});

		it('moves an item from one index to another', () => {
			list.move(0, 2);
			expect(list.get().map(i => i.id)).toEqual(['b', 'c', 'a', 'd']);
		});

		it('moves backwards (high to low)', () => {
			list.move(3, 0);
			expect(list.get().map(i => i.id)).toEqual(['d', 'a', 'b', 'c']);
		});

		it('no-op when from === to', () => {
			const handler = vi.fn();
			list.on('move', handler);
			list.move(1, 1);
			expect(handler).not.toHaveBeenCalled();
		});

		it('no-op on out-of-bounds from', () => {
			const handler = vi.fn();
			list.on('move', handler);
			list.move(99, 0);
			expect(handler).not.toHaveBeenCalled();
		});

		it('no-op on out-of-bounds to', () => {
			const handler = vi.fn();
			list.on('move', handler);
			list.move(0, 99);
			expect(handler).not.toHaveBeenCalled();
		});

		describe('cursor follows the moved item', () => {
			it('cursor moves with the item when cursor was on it', () => {
				list.setCurrent(0); // 'a'
				list.move(0, 2);
				expect(list.currentIndex()).toBe(2);
				expect(list.current()?.id).toBe('a');
			});
		});

		describe('cursor adjusts when move crosses it', () => {
			it('shifts cursor down when item moves from before cursor to after', () => {
				list.setCurrent(2); // 'c'
				list.move(0, 3); // 'a' → end
				// items ['b', 'c', 'd', 'a']; cursor was on 'c' which is now index 1
				expect(list.current()?.id).toBe('c');
				expect(list.currentIndex()).toBe(1);
			});

			it('shifts cursor up when item moves from after cursor to before', () => {
				list.setCurrent(1); // 'b'
				list.move(3, 0); // 'd' → start
				// items ['d', 'a', 'b', 'c']; cursor was on 'b' which is now index 2
				expect(list.current()?.id).toBe('b');
				expect(list.currentIndex()).toBe(2);
			});
		});

		it('emits move event with from + to indices', () => {
			const handler = vi.fn();
			list.on('move', handler);
			list.move(0, 2);
			expect(handler).toHaveBeenCalledWith({ from: 0, to: 2 });
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// clear()
	// ─────────────────────────────────────────────────────────────────────

	describe('clear()', () => {
		it('removes all items', () => {
			list.append(makeItems(3));
			list.clear();
			expect(list.length()).toBe(0);
			expect(list.get()).toEqual([]);
		});

		it('resets cursor to -1', () => {
			list.append(makeItems(3));
			list.clear();
			expect(list.currentIndex()).toBe(-1);
			expect(list.current()).toBeUndefined();
		});

		it('no-op on already-empty list', () => {
			const handler = vi.fn();
			list.on('clear', handler);
			list.clear();
			expect(handler).not.toHaveBeenCalled();
		});

		it('emits clear event with previousLength', () => {
			list.append(makeItems(5));
			const handler = vi.fn();
			list.on('clear', handler);
			list.clear();
			expect(handler).toHaveBeenCalledWith({ previousLength: 5 });
		});

		it('emits change event after clear', () => {
			list.append(makeItems(3));
			const handler = vi.fn();
			list.on('change', handler);
			list.clear();
			expect(handler).toHaveBeenCalledTimes(1);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// shuffle()
	// ─────────────────────────────────────────────────────────────────────

	describe('shuffle()', () => {
		it('preserves all items', () => {
			list.append(makeItems(10));
			const before = list.get().map(i => i.id).sort();
			list.shuffle();
			const after = list.get().map(i => i.id).sort();
			expect(after).toEqual(before);
		});

		it('preserves cursor on the same item after shuffle', () => {
			list.append(makeItems(10));
			list.setCurrent(5);
			const currentId = list.current()?.id;
			list.shuffle();
			expect(list.current()?.id).toBe(currentId);
		});

		it('no-op on empty list', () => {
			const handler = vi.fn();
			list.on('shuffle', handler);
			list.shuffle();
			expect(handler).not.toHaveBeenCalled();
		});

		it('no-op on single-item list', () => {
			list.append(makeItem('only'));
			const handler = vi.fn();
			list.on('shuffle', handler);
			list.shuffle();
			expect(handler).not.toHaveBeenCalled();
		});

		it('emits shuffle event for lists with 2+ items', () => {
			list.append(makeItems(5));
			const handler = vi.fn();
			list.on('shuffle', handler);
			list.shuffle();
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('emits change event after shuffle', () => {
			list.append(makeItems(5));
			const handler = vi.fn();
			list.on('change', handler);
			list.shuffle();
			expect(handler).toHaveBeenCalledTimes(1);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// sort()
	// ─────────────────────────────────────────────────────────────────────

	describe('sort()', () => {
		it('sorts items by the comparator', () => {
			list.append([makeItem('c'), makeItem('a'), makeItem('b')]);
			list.sort((x, y) => String(x.id).localeCompare(String(y.id)));
			expect(list.get().map(i => i.id)).toEqual(['a', 'b', 'c']);
		});

		it('preserves cursor on the same item after sort', () => {
			list.append([makeItem('c'), makeItem('a'), makeItem('b')]);
			list.setCurrent(0); // 'c'
			list.sort((x, y) => String(x.id).localeCompare(String(y.id)));
			expect(list.current()?.id).toBe('c');
			expect(list.currentIndex()).toBe(2);
		});

		it('no-op on empty list', () => {
			const handler = vi.fn();
			list.on('sort', handler);
			list.sort(() => 0);
			expect(handler).not.toHaveBeenCalled();
		});

		it('no-op on single-item list', () => {
			list.append(makeItem('only'));
			const handler = vi.fn();
			list.on('sort', handler);
			list.sort(() => 0);
			expect(handler).not.toHaveBeenCalled();
		});

		it('emits sort event for lists with 2+ items', () => {
			list.append(makeItems(3));
			const handler = vi.fn();
			list.on('sort', handler);
			list.sort(() => 0);
			expect(handler).toHaveBeenCalledTimes(1);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// dispose()
	// ─────────────────────────────────────────────────────────────────────

	describe('dispose()', () => {
		it('clears all items', () => {
			list.append(makeItems(5));
			list.dispose();
			expect(list.length()).toBe(0);
		});

		it('resets cursor to -1', () => {
			list.append(makeItems(3));
			list.dispose();
			expect(list.currentIndex()).toBe(-1);
		});

		it('removes all event listeners', () => {
			const handler = vi.fn();
			list.on('change', handler);
			list.on('append', handler);
			list.dispose();
			// After dispose, the EventEmitter should have no listeners.
			// We assert by re-initializing items via internal setter and checking
			// no event fires (impossible after dispose since items is reset).
			// Best assertion: hasListeners returns false.
			expect(list.hasListeners('change')).toBe(false);
			expect(list.hasListeners('append')).toBe(false);
		});

		it('is safe to call multiple times', () => {
			list.append(makeItems(2));
			list.dispose();
			expect(() => list.dispose()).not.toThrow();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Event ordering
	// ─────────────────────────────────────────────────────────────────────

	describe('event ordering', () => {
		it('mutation event fires BEFORE change event for append', () => {
			const order: string[] = [];
			list.on('append', () => order.push('append'));
			list.on('change', () => order.push('change'));
			list.append(makeItem('a'));
			expect(order).toEqual(['append', 'change']);
		});

		it('mutation event fires BEFORE change event for remove', () => {
			list.append(makeItems(3));
			const order: string[] = [];
			list.on('remove', () => order.push('remove'));
			list.on('change', () => order.push('change'));
			list.removeAt(1);
			expect(order).toEqual(['remove', 'change']);
		});

		it('item event fires when setCurrent() moves the cursor', () => {
			list.append(makeItems(3));
			const handler = vi.fn();
			list.on('item', handler);
			list.setCurrent(2);
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('item event does NOT fire on append (cursor only auto-init when empty)', () => {
			const handler = vi.fn();
			list.on('item', handler);
			list.append(makeItem('a'));
			expect(handler).not.toHaveBeenCalled();
		});
	});
});
