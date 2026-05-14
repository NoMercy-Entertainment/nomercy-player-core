import type { ActionOptions, BasePlaylistItem } from '../../types';

import type { Internals } from '../state';
import { emitBeforeMutation } from '../util/mutation-guard';
import { disposeSidecarSubtitle } from '../util/sidecar';
import { resolveAndEmitChapters } from '../util/tracks';


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
		// Item changed → drop any in-flight sidecar subtitle context
		// (its CueTracker is bound to the old item's time stream and
		// would emit stale cues against the new media). Renderers will
		// receive a fresh `subtitleCue` event when the next selection
		// happens (via `currentSubtitle` from a UI / preferences plugin).
		disposeSidecarSubtitle(self);
		self.emit('current', data);

		// Ensure chapter data is populated for the new item and announce it.
		// Fire-and-forget: load() already calls _resolveItemTrackUrls before
		// moving the cursor, so this is a no-op for the initial load path.
		// For cursor-only switches (player.current(i), next, previous) where
		// load() was never called for that item, this is the only trigger.
		void resolveAndEmitChapters(self, data.item?.id);
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
	queue(this: Internals, items?: BasePlaylistItem[], _opts?: ActionOptions): ReadonlyArray<BasePlaylistItem> | void {
		_wireQueue(this);
		if (items === undefined)
			return this._queueList.get();
		this._queueList.set(items);
	},
	queueAppend(this: Internals, item: BasePlaylistItem | BasePlaylistItem[], _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.append(item);
	},
	queuePrepend(this: Internals, item: BasePlaylistItem | BasePlaylistItem[], _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.prepend(item);
	},
	queueInsert(this: Internals, item: BasePlaylistItem | BasePlaylistItem[], index: number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.insert(item, index);
	},
	queueRemove(this: Internals, id: string | number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.remove(id);
	},
	queueRemoveAt(this: Internals, index: number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.removeAt(index);
	},
	queueMove(this: Internals, from: number, to: number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.move(from, to);
	},
	queueClear(this: Internals, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.clear();
	},
	queueShuffle(this: Internals, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.shuffle();
	},
	queueSort(this: Internals, compare: (a: BasePlaylistItem, b: BasePlaylistItem) => number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.sort(compare);
	},
	peekNext(this: Internals): BasePlaylistItem | undefined {
		return this._queueList.peekNext();
	},
	peekPrevious(this: Internals): BasePlaylistItem | undefined {
		return this._queueList.peekPrevious();
	},
	queueLength(this: Internals): number {
		return this._queueList.length();
	},
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
		if (!emitBeforeMutation(this, 'current', [target]))
			return;

		// Invalidate any in-flight load() so its cursor-move continuation does
		// not overwrite the position we're about to set here. This covers the
		// case where current(B) is called while a previous load(A) is awaiting
		// the backend — readyToLoad is false so we skip calling load() again,
		// but without bumping the epoch the load(A) continuation would move the
		// cursor back to A once it resolves.
		this._loadEpoch = (this._loadEpoch ?? 0) + 1;

		this._queueList.setCurrent(target);

		const readyToLoad = this._phase === 'ready'
			|| this._phase === 'playing'
			|| this._phase === 'paused'
			|| this._phase === 'ended'
			|| this._phase === 'stopped';
		if (!readyToLoad) return;

		const item = this._queueList.current();
		if (!item) return;

		void this.load(item as BasePlaylistItem & { url?: string }, { source: opts?.source }).then(() => {
			if (opts?.autoplay) {
				void this.play({ source: opts.source });
			}
		}).catch(() => { /* load errors surface via the 'error' event; suppress unhandled rejection */ });
	},
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
		if (!emitBeforeMutation(this, 'current', [zeroBasedIndex]))
			return;

		this._queueList.setCurrent(zeroBasedIndex);
	},

	backlog(this: Internals, items?: BasePlaylistItem[]): ReadonlyArray<BasePlaylistItem> | void {
		_wireQueue(this);
		if (items === undefined)
			return this._backlogList.get();
		this._backlogList.set(items);
	},
	backlogAppend(this: Internals, item: BasePlaylistItem | BasePlaylistItem[]): void {
		_wireQueue(this);
		this._backlogList.append(item);
	},
	backlogRemove(this: Internals, id: string | number): void {
		_wireQueue(this);
		this._backlogList.remove(id);
	},
	backlogClear(this: Internals): void {
		_wireQueue(this);
		this._backlogList.clear();
	},
} as const;
