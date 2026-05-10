import type { BasePlaylistItem } from './types';
import { EventEmitter } from './events';

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
 * List-with-cursor primitive. Both player libraries delegate their `queue*`
 * methods to a single `MediaList<T>` instance.
 *
 * Knows the current item, supports all the standard mutation ops, emits
 * events on every change so consumers can re-render off a single source.
 *
 * Cursor semantics:
 *  - `currentIndex()` defaults to 0 when items exist, -1 when empty.
 *  - Mutations preserve the cursor pointing at the same item where possible:
 *    if you remove the item before the current, currentIndex shifts down by 1
 *    so the cursor still points at the same logical track.
 *  - `setCurrent(item)` accepts the item itself, an id, or an index.
 */
export class MediaList<T extends BasePlaylistItem> extends EventEmitter<MediaListEventMap<T>> {
	private items: T[] = [];
	private cursor = -1;

	// ── Read ──

	get(): ReadonlyArray<T> {
		return this.items;
	}

	set(items: T[]): void {
		const previousId = this.items[this.cursor]?.id;

		this.items = [...items];

		// Try to preserve cursor by id; otherwise reset to 0 (or -1 if empty).
		if (previousId !== undefined) {
			const idx = this.items.findIndex(i => i.id === previousId);
			this.cursor = idx >= 0 ? idx : (this.items.length > 0 ? 0 : -1);
		}
		else {
			this.cursor = this.items.length > 0 ? 0 : -1;
		}

		this.emitChange();
	}

	length(): number {
		return this.items.length;
	}

	// ── Cursor ──

	current(): T | undefined {
		return this.cursor >= 0 ? this.items[this.cursor] : undefined;
	}

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

	setCurrent(target: T | string | number): void {
		let idx: number;

		if (typeof target === 'number' && Number.isInteger(target)) {
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

	peekNext(): T | undefined {
		if (this.cursor < 0)
			return this.items[0];

		return this.items[this.cursor + 1];
	}

	peekPrevious(): T | undefined {
		if (this.cursor < 0)
			return undefined;

		return this.items[this.cursor - 1];
	}

	// ── Add ──

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

	remove(id: string | number): void {
		const idx = this.items.findIndex(i => i.id === id);
		if (idx < 0)
			return;

		this.removeAt(idx);
	}

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
			// Cursor was pointing at the removed item; clamp to the new last
			// index if we fell off the end.
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

		// Fix cursor: if it was pointing at the moved item, follow it.
		if (this.cursor === from) {
			this.cursor = to;
		}
		else {
			// Otherwise shift if the move crossed the cursor's position.
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

	clear(): void {
		const previousLength = this.items.length;
		if (previousLength === 0)
			return;

		this.items = [];
		this.cursor = -1;

		this.emit('clear', { previousLength });
		this.emitChange();
	}

	shuffle(): void {
		if (this.items.length <= 1)
			return;

		const currentItem = this.cursor >= 0 ? this.items[this.cursor] : undefined;

		// Fisher-Yates
		for (let i = this.items.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[this.items[i], this.items[j]] = [this.items[j]!, this.items[i]!];
		}

		// Re-locate the cursor on the same item.
		if (currentItem) {
			const newIdx = this.items.findIndex(i => i.id === currentItem.id);
			if (newIdx >= 0)
				this.cursor = newIdx;
		}

		this.emit('shuffle');
		this.emitChange();
	}

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

	dispose(): void {
		this.items = [];
		this.cursor = -1;

		this.off('all');
	}

	private emitChange(): void {
		this.emit('change', { items: this.items });
	}
}
