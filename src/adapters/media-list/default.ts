import type { BasePlaylistItem } from '../../types';
import { EventEmitter } from '../event-bus/default';

export type MediaListEvent = 'change' | 'append' | 'prepend' | 'insert' | 'remove' | 'move' | 'clear' | 'shuffle' | 'sort' | 'current';

interface MediaListEventMap<T> {
	change: { items: ReadonlyArray<T> };
	append: { items: T[]; from: number };
	prepend: { items: T[] };
	insert: { items: T[]; index: number };
	remove: { id: string | number; index: number; item: T };
	move: { from: number; to: number };
	clear: { previousLength: number };
	shuffle: void;
	sort: void;
	current: { item: T | undefined; index: number };
}

/**
 * Cursor-aware ordered list shared by both player libraries.
 *
 * Both `NMMusicPlayer` and `NMVideoPlayer` delegate their queue methods to a
 * single `MediaList<T>` instance rather than maintaining parallel list state.
 * Consumers subscribe to the typed events emitted here instead of polling.
 *
 * Cursor semantics:
 *  - `currentIndex()` is `0` when items exist, `-1` when the list is empty.
 *  - Every mutation that shifts item positions also shifts the cursor so it
 *    keeps pointing at the same item. Removing the item before the current
 *    decrements the cursor index by one; removing the current item clamps the
 *    cursor to the new last index.
 *  - `setCurrent()` accepts the item itself, its id, an index, or a predicate.
 */
export class MediaList<T extends BasePlaylistItem> extends EventEmitter<MediaListEventMap<T>> {
	private items: T[] = [];
	private cursor = -1;

	// ── Read ──

	/**
	 * All items in the list, in order. The returned array is a live reference —
	 * do not mutate it directly; use the mutation methods instead.
	 */
	get(): ReadonlyArray<T> {
		return this.items;
	}

	/**
	 * Replace the entire list with `items`.
	 *
	 * The cursor is preserved by item `id` when possible. If the previously
	 * current item is still present in `items`, the cursor moves to its new
	 * index. If it is no longer present, the cursor resets to `0` (or `-1`
	 * if `items` is empty). Fires a `change` event.
	 */
	set(items: T[]): void {
		const previousId = this.items[this.cursor]?.id;

		this.items = [...items];

		if (previousId !== undefined) {
			const idx = this.items.findIndex(i => i.id === previousId);
			this.cursor = idx >= 0 ? idx : (this.items.length > 0 ? 0 : -1);
		}
		else {
			this.cursor = this.items.length > 0 ? 0 : -1;
		}

		this.emitChange();
	}

	/** Number of items currently in the list. */
	length(): number {
		return this.items.length;
	}

	// ── Cursor ──

	/** The item at the current cursor position, or `undefined` when the list is empty. */
	current(): T | undefined {
		return this.cursor >= 0 ? this.items[this.cursor] : undefined;
	}

	/** Zero-based index of the current item, or `-1` when the list is empty. */
	currentIndex(): number {
		return this.cursor;
	}

	/**
	 * Replace the item with the same `id` in place. Cursor and all other
	 * positions are unaffected. Fires no events — callers that need to
	 * notify listeners must do so themselves.
	 */
	replaceItem(item: T): void {
		const idx = this.items.findIndex(i => i.id === item.id);
		if (idx >= 0) this.items[idx] = item;
	}

	/**
	 * Move the cursor to the item identified by `target`.
	 *
	 * `target` may be:
	 * - an item object — matched by `id`
	 * - a `string` or non-integer `number` — matched against item `id`
	 * - an integer `number` — used directly as a zero-based index
	 * - a predicate `(item: T) => boolean` — first match wins
	 *
	 * Does nothing if `target` resolves to an out-of-range index. On success
	 * emits a `current` event with the new item and index.
	 */
	setCurrent(target: T | string | number | ((item: T) => boolean)): void {
		let idx: number;

		if (typeof target === 'function') {
			idx = this.items.findIndex(target);
		}
		else if (typeof target === 'number' && Number.isInteger(target)) {
			idx = target;
		}
		else if (typeof target === 'string' || typeof target === 'number') {
			idx = this.items.findIndex(i => i.id === target);
		}
		else {
			idx = this.items.findIndex(i => i.id === target.id);
		}

		if (idx < 0 || idx >= this.items.length)
			return;

		this.cursor = idx;

		this.emit('current', {
			item: this.items[idx],
			index: idx,
		});
	}

	// ── Peek ──

	/**
	 * The item immediately after the current one, or `undefined` if the cursor
	 * is at the last position. When the cursor is `-1` (empty list), returns
	 * the first item or `undefined`.
	 */
	peekNext(): T | undefined {
		if (this.cursor < 0)
			return this.items[0];

		return this.items[this.cursor + 1];
	}

	/**
	 * The item immediately before the current one, or `undefined` if the cursor
	 * is at the first position or the list is empty.
	 */
	peekPrevious(): T | undefined {
		if (this.cursor < 0)
			return undefined;

		return this.items[this.cursor - 1];
	}

	// ── Add ──

	/**
	 * Add one or more items to the end of the list. The cursor is set to `0` if
	 * it was previously `-1`. Fires `append` then `change`.
	 */
	append(item: T | T[]): void {
		const items = Array.isArray(item) ? item : [item];
		if (items.length === 0)
			return;

		const from = this.items.length;
		this.items.push(...items);

		if (this.cursor < 0)
			this.cursor = 0;

		this.emit('append', {
			items,
			from,
		});
		this.emitChange();
	}

	/**
	 * Add one or more items to the front of the list. The cursor index shifts
	 * up by the number of prepended items so it keeps pointing at the same item.
	 * Fires `prepend` then `change`.
	 */
	prepend(item: T | T[]): void {
		const items = Array.isArray(item) ? item : [item];
		if (items.length === 0)
			return;

		this.items.unshift(...items);

		if (this.cursor >= 0)
			this.cursor += items.length;
		else this.cursor = 0;

		this.emit('prepend', { items });
		this.emitChange();
	}

	/**
	 * Insert one or more items at `index`. `index` is clamped to `[0, length]`.
	 * The cursor shifts up if it was at or after the insertion point, keeping it
	 * on the same item. Fires `insert` then `change`.
	 */
	insert(item: T | T[], index: number): void {
		const items = Array.isArray(item) ? item : [item];
		if (items.length === 0)
			return;

		const safeIndex = Math.max(0, Math.min(index, this.items.length));
		this.items.splice(safeIndex, 0, ...items);

		if (this.cursor >= safeIndex)
			this.cursor += items.length;
		else if (this.cursor < 0)
			this.cursor = 0;

		this.emit('insert', {
			items,
			index: safeIndex,
		});
		this.emitChange();
	}

	// ── Remove ──

	/**
	 * Remove the item with the given `id`. Does nothing if not found.
	 * Delegates to `removeAt` for cursor adjustment and event emission.
	 */
	remove(id: string | number): void {
		const idx = this.items.findIndex(i => i.id === id);
		if (idx < 0)
			return;

		this.removeAt(idx);
	}

	/**
	 * Remove the item at `index`. Does nothing if out of range.
	 *
	 * Cursor adjustment: if `index` is before the cursor, the cursor decrements
	 * by one. If `index` equals the cursor, the cursor stays at the same index
	 * (now pointing at the next item) and clamps to the new last index if it
	 * fell off the end. Fires `remove` then `change`.
	 */
	removeAt(index: number): void {
		if (index < 0 || index >= this.items.length)
			return;

		const [removed] = this.items.splice(index, 1);
		if (!removed)
			return;

		if (this.items.length === 0) {
			this.cursor = -1;
		}
		else if (index < this.cursor) {
			this.cursor -= 1;
		}
		else if (index === this.cursor) {
			if (this.cursor >= this.items.length)
				this.cursor = this.items.length - 1;
		}

		this.emit('remove', {
			id: removed.id,
			index,
			item: removed,
		});
		this.emitChange();
	}

	// ── Reorder / bulk ──

	/**
	 * Move the item at `from` to position `to`. Does nothing if either index is
	 * out of range or `from === to`. The cursor follows the moved item if it was
	 * current; otherwise it shifts by ±1 if the move crossed its position.
	 * Fires `move` then `change`.
	 */
	move(from: number, to: number): void {
		if (from < 0 || from >= this.items.length)
			return;
		if (to < 0 || to >= this.items.length)
			return;
		if (from === to)
			return;

		const [moved] = this.items.splice(from, 1);
		if (!moved)
			return;

		this.items.splice(to, 0, moved);

		if (this.cursor === from) {
			this.cursor = to;
		}
		else {
			if (from < this.cursor && to >= this.cursor)
				this.cursor -= 1;
			else if (from > this.cursor && to <= this.cursor)
				this.cursor += 1;
		}

		this.emit('move', {
			from,
			to,
		});
		this.emitChange();
	}

	/**
	 * Remove all items and reset the cursor to `-1`. Does nothing when already
	 * empty. Fires `clear` then `change`.
	 */
	clear(): void {
		const previousLength = this.items.length;
		if (previousLength === 0)
			return;

		this.items = [];
		this.cursor = -1;

		this.emit('clear', { previousLength });
		this.emitChange();
	}

	/**
	 * Shuffle the list in place using Fisher-Yates. The cursor follows the
	 * current item to its new position. Fires `shuffle` then `change`.
	 */
	shuffle(): void {
		if (this.items.length <= 1)
			return;

		const currentItem = this.cursor >= 0 ? this.items[this.cursor] : undefined;

		// Fisher-Yates
		for (let i = this.items.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[this.items[i], this.items[j]] = [this.items[j]!, this.items[i]!];
		}

		if (currentItem) {
			const newIdx = this.items.findIndex(i => i.id === currentItem.id);
			if (newIdx >= 0)
				this.cursor = newIdx;
		}

		this.emit('shuffle');
		this.emitChange();
	}

	/**
	 * Sort the list in place using `compare`. The cursor follows the current
	 * item to its new position. Fires `sort` then `change`.
	 */
	sort(compare: (a: T, b: T) => number): void {
		if (this.items.length <= 1)
			return;

		const currentItem = this.cursor >= 0 ? this.items[this.cursor] : undefined;

		this.items.sort(compare);

		if (currentItem) {
			const newIdx = this.items.findIndex(i => i.id === currentItem.id);
			if (newIdx >= 0)
				this.cursor = newIdx;
		}

		this.emit('sort');
		this.emitChange();
	}

	// ── Lifecycle ──

	/** Clear all items, reset the cursor, and remove all event listeners. */
	dispose(): void {
		this.items = [];
		this.cursor = -1;

		this.off('all');
	}

	private emitChange(): void {
		this.emit('change', { items: this.items });
	}
}
