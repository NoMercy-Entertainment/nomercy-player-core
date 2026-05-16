import type { ActionOptions, BasePlaylistItem } from '../../types';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Wire the MediaList events to the player event bus. Idempotent — safe to
// call before every queue mutation.
// ──────────────────────────────────────────────────────────────────────────

function _wireQueue(self: Internals): void {
	if (self._queueWired)
		return;
	self._queueWired = true;

	self._queueList.on('change', ({ items }) => self.emit('queue', items));
	self._queueList.on('append', data => self.emit('queue:append', data));
	self._queueList.on('prepend', data => self.emit('queue:prepend', data));
	self._queueList.on('insert', data => self.emit('queue:insert', data));
	self._queueList.on('remove', data => self.emit('queue:remove', data));
	self._queueList.on('move', data => self.emit('queue:move', data));
	self._queueList.on('clear', data => self.emit('queue:clear', data));
	self._queueList.on('shuffle', () => self.emit('queue:shuffle'));
	self._queueList.on('sort', () => self.emit('queue:sort'));
	self._queueList.on('current', (data) => {
		// The sidecar subtitle CueTracker is bound to the old item's time stream —
		// disposing it here prevents stale cues from leaking into the new item.
		// The renderer will get a fresh `subtitleCue` once the next subtitle
		// selection fires via `currentSubtitle`.
		self._disposeSidecarSubtitle();
		self.emit('current', data);

		// For cursor-only switches (current(i), next, previous) where load() was
		// not called for that item, this is the only trigger for chapter data.
		void self._resolveAndEmitChapters(data.item?.id);
	});

	self._backlogList.on('change', ({ items }) => self.emit('backlog', items));
	self._backlogList.on('append', data => self.emit('backlog:append', data));
	self._backlogList.on('remove', data => self.emit('backlog:remove', data));
	self._backlogList.on('clear', data => self.emit('backlog:clear', data));
}


// ──────────────────────────────────────────────────────────────────────────
// Mixin: queue + cursor + backlog (delegates to MediaList<T>)
// ──────────────────────────────────────────────────────────────────────────

export const queueMethods = {
	/**
	 * Read or write the queue.
	 *
	 * `queue()` — returns the current playlist as a read-only array. Wires the
	 * internal `MediaList` event bridge on first call so subsequent mutations
	 * automatically emit the corresponding `queue:*` events.
	 *
	 * `queue(items)` — replace the entire playlist with `items`. Emits `queue`
	 * with the new array.
	 */
	queue(this: Internals, items?: BasePlaylistItem[], _opts?: ActionOptions): ReadonlyArray<BasePlaylistItem> | void {
		_wireQueue(this);
		if (items === undefined)
			return this._queueList.get();
		this._queueList.set(items);
	},

	/**
	 * Append one item or an array of items to the end of the queue. Emits
	 * `queue:append` with the added item(s) and index range.
	 */
	queueAppend(this: Internals, item: BasePlaylistItem | BasePlaylistItem[], _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.append(item);
	},

	/**
	 * Prepend one item or an array of items to the start of the queue. Emits
	 * `queue:prepend` with the added item(s).
	 */
	queuePrepend(this: Internals, item: BasePlaylistItem | BasePlaylistItem[], _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.prepend(item);
	},

	/**
	 * Insert one item or an array of items at `index`. Items at and after that
	 * position shift right. Emits `queue:insert` with the item(s) and insertion
	 * index.
	 */
	queueInsert(this: Internals, item: BasePlaylistItem | BasePlaylistItem[], index: number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.insert(item, index);
	},

	/**
	 * Remove the item with the given `id` from the queue. No-op when the id is
	 * not found. Emits `queue:remove` with the removed item and its former index.
	 */
	queueRemove(this: Internals, id: string | number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.remove(id);
	},

	/**
	 * Remove the item at the given zero-based `index`. No-op when `index` is
	 * out of range. Emits `queue:remove`.
	 */
	queueRemoveAt(this: Internals, index: number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.removeAt(index);
	},

	/**
	 * Move the item at position `from` to position `to` (both zero-based).
	 * No-op when either index is out of range. Emits `queue:move` with the
	 * old and new indices.
	 */
	queueMove(this: Internals, from: number, to: number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.move(from, to);
	},

	/**
	 * Remove all items from the queue. Emits `queue:clear`.
	 */
	queueClear(this: Internals, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.clear();
	},

	/**
	 * Randomly reorder all items in the queue in-place. Emits `queue:shuffle`.
	 */
	queueShuffle(this: Internals, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.shuffle();
	},

	/**
	 * Sort the queue in-place using `compare` (same contract as
	 * `Array.prototype.sort`). Emits `queue:sort`.
	 */
	queueSort(this: Internals, compare: (a: BasePlaylistItem, b: BasePlaylistItem) => number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.sort(compare);
	},

	/**
	 * Return the item that would become active if `next()` were called now,
	 * without moving the cursor. Returns `undefined` when the queue is
	 * exhausted.
	 */
	peekNext(this: Internals): BasePlaylistItem | undefined {
		return this._queueList.peekNext();
	},

	/**
	 * Return the item that would become active if `previous()` were called now,
	 * without moving the cursor. Returns `undefined` when already at the start.
	 */
	peekPrevious(this: Internals): BasePlaylistItem | undefined {
		return this._queueList.peekPrevious();
	},

	/**
	 * Return the total number of items in the queue.
	 */
	queueLength(this: Internals): number {
		return this._queueList.length();
	},

	/**
	 * Return the zero-based index of the item with the given `id`, or `-1`
	 * when not found.
	 */
	queueIndexOf(this: Internals, id: string | number): number {
		return this._queueList.get().findIndex(item => item.id === id);
	},

	/**
	 * Read or write the active queue cursor.
	 *
	 * `current()` — returns the active playlist item, or `undefined` when the
	 * queue is empty.
	 *
	 * `current(target, opts?)` — move the cursor to `target` (item ref, id
	 * string, or index). Fires `beforeMutation` so advisory plugins can cancel
	 * the change. Emits the `current` event when the cursor moves.
	 */
	current(this: Internals, target?: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean), opts?: ActionOptions): BasePlaylistItem | undefined | void {
		if (target === undefined) {
			return this._queueList.current();
		}
		_wireQueue(this);
		if (!this._emitBeforeMutation( 'current', [target]))
			return;

		// Bump the load epoch so any in-flight load()'s cursor-move continuation
		// does not overwrite the position we're about to set. Without this,
		// current(B) called while load(A) is still awaiting the backend would
		// let load(A) snap the cursor back to A on resolution.
		this._loadEpoch = (this._loadEpoch ?? 0) + 1;

		// Bump the current epoch independently of _loadEpoch. load() internally
		// bumps _loadEpoch again (race-guard for its own continuation), so
		// _loadEpoch at the call site is not a stable sentinel for the autoplay
		// continuation below. _currentEpoch is only ever written here, making it
		// a reliable "was a newer current() called?" check.
		this._currentEpoch = (this._currentEpoch ?? 0) + 1;
		const navigationEpoch = this._currentEpoch;

		this._queueList.setCurrent(target);

		if (this._phase === 'idle' || this._phase === 'disposed' || this._phase === 'disposing') return;

		const item = this._queueList.current();
		if (!item) return;

		const doLoad = (): void => {
			if (this._currentEpoch !== navigationEpoch) return;

			const currentItem = this._queueList.current();
			if (!currentItem) return;

			void this.load(currentItem as BasePlaylistItem & { url?: string }, { source: opts?.source }).then(() => {
				if (this._currentEpoch !== navigationEpoch) return;
				if (opts?.autoplay) {
					void this.play({ source: opts.source });
				}
			}).catch(() => { /* load errors surface via the 'error' event; suppress unhandled rejection */ });
		};

		if (this._phase === 'setup') {
			void this.ready().then(doLoad).catch(() => { /* setup failed — nothing to load */ });
		}
		else {
			doLoad();
		}
	},

	/**
	 * Return the zero-based index of the currently active item, or `-1` when
	 * the queue is empty.
	 */
	currentIndex(this: Internals): number {
		return this._queueList.currentIndex();
	},

	/**
	 * Navigate to a playlist item by 1-based ordinal position.
	 *
	 * `seekToIndex(1)` loads the first item, `seekToIndex(queueLength())` loads
	 * the last. Out-of-range values are silently ignored (no cursor move).
	 * Fires the same `beforeMutation` / `current` lifecycle as `current(target)`.
	 *
	 * @throws {RangeError} when `position` is not a positive integer.
	 */
	seekToIndex(this: Internals, position: number, opts?: ActionOptions): void {
		if (!Number.isInteger(position) || position < 1) {
			throw new RangeError(`seekToIndex: position must be a positive integer, got ${position}`);
		}

		const zeroBasedIndex = position - 1;
		const items = this._queueList.get();

		if (zeroBasedIndex >= items.length) return;

		_wireQueue(this);
		if (!this._emitBeforeMutation( 'current', [zeroBasedIndex]))
			return;

		this._queueList.setCurrent(zeroBasedIndex);
	},

	/**
	 * Read or write the backlog (items that have already played and precede the
	 * current queue). The backlog does not drive cursor movement — it is a
	 * history store that consumers populate manually.
	 *
	 * `backlog()` — returns the backlog as a read-only array.
	 * `backlog(items)` — replace the backlog with `items`. Emits `backlog`.
	 */
	backlog(this: Internals, items?: BasePlaylistItem[]): ReadonlyArray<BasePlaylistItem> | void {
		_wireQueue(this);
		if (items === undefined)
			return this._backlogList.get();
		this._backlogList.set(items);
	},

	/**
	 * Append one item or an array of items to the backlog. Emits
	 * `backlog:append`.
	 */
	backlogAppend(this: Internals, item: BasePlaylistItem | BasePlaylistItem[]): void {
		_wireQueue(this);
		this._backlogList.append(item);
	},

	/**
	 * Remove the item with the given `id` from the backlog. No-op when not
	 * found. Emits `backlog:remove`.
	 */
	backlogRemove(this: Internals, id: string | number): void {
		_wireQueue(this);
		this._backlogList.remove(id);
	},

	/**
	 * Remove all items from the backlog. Emits `backlog:clear`.
	 */
	backlogClear(this: Internals): void {
		_wireQueue(this);
		this._backlogList.clear();
	},
} as const;
