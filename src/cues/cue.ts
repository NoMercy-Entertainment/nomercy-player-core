/** A single timed cue. Lyrics, subtitles, and sprite previews all use this. */
export interface Cue<T = unknown> {
	start: number;
	end: number;
	payload: T;
	/** Optional stable id, used by `MutableCueList.remove`. */
	id?: string | number;
}

/**
 * Time-indexed list of cues. Active/next/prev are O(log n) via binary search.
 *
 * Cues do not need to be sorted on input — `createCueList` sorts them by
 * `start`. Overlapping cues are supported: `active(time)` returns ALL cues
 * whose interval contains `time`, not just one. This matters for subtitles
 * with parallel tracks and for sprite previews where adjacent thumbnail
 * cues overlap by a frame.
 */
export interface CueList<T = unknown> {
	readonly cues: ReadonlyArray<Cue<T>>;
	active(time: number): Cue<T>[];
	next(time: number): Cue<T> | undefined;
	prev(time: number): Cue<T> | undefined;
}

/**
 * Mutable variant of `CueList`. Used for live captions / dynamic chapter
 * loading where cues arrive after the list is created. All query methods
 * (`active/next/prev`) return live data — the underlying buffer is re-sorted
 * on mutation.
 */
export interface MutableCueList<T = unknown> extends CueList<T> {
	/** Insert a cue, kept sorted by `start`. */
	add(cue: Cue<T>): void;
	/** Remove the first cue matching `id`. Returns `true` if removed. */
	remove(id: string | number): boolean;
	/** Drop every cue. */
	clear(): void;
	/** Subscribe to mutations. Returns an unsubscribe fn. */
	subscribe(fn: (cues: ReadonlyArray<Cue<T>>) => void): () => void;
}

/**
 * Build an immutable, time-indexed cue list from an array of raw cues.
 *
 * Input order does not matter — the list sorts by `start` on construction.
 * Cues with equal `start` retain their relative input order.
 *
 * The returned object's `active(t)` uses binary search (O(log n)) and returns
 * every cue whose interval contains `t`, including overlapping cues.
 * `next(t)` and `prev(t)` locate the cue immediately after and before `t`.
 */
export function createCueList<T>(cues: ReadonlyArray<Cue<T>>): CueList<T> {
	const sorted = [...cues].sort((a, b) => a.start - b.start);

	// Returns the first index whose start > time (sorted.length when none exists).
	const upperBound = (time: number): number => {
		let lo = 0;
		let hi = sorted.length;
		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			const cue = sorted[mid];
			if (!cue)
				break;
			if (cue.start > time)
				hi = mid;
			else lo = mid + 1;
		}
		return lo;
	};

	return {
		cues: sorted,

		active(time: number): Cue<T>[] {
			// No early exit: sorted-by-end is not maintained, so every candidate
			// with start <= time must be checked for end >= time.
			const result: Cue<T>[] = [];
			const ub = upperBound(time);
			for (let i = ub - 1; i >= 0; i--) {
				const cue = sorted[i];
				if (!cue)
					continue;
				if (cue.end >= time)
					result.push(cue);
			}
			return result.reverse();
		},

		next(time: number): Cue<T> | undefined {
			const ub = upperBound(time);
			return sorted[ub];
		},

		prev(time: number): Cue<T> | undefined {
			const ub = upperBound(time);
			for (let i = ub - 1; i >= 0; i--) {
				const cue = sorted[i];
				if (!cue)
					continue;
				if (cue.end < time)
					return cue;
			}
			return undefined;
		},
	};
}

/**
 * Build a mutable, time-indexed cue list.
 *
 * Exposes the same query surface as `createCueList` (`active`, `next`, `prev`)
 * against a live buffer that grows and shrinks at runtime. Use this for live
 * captions or chapter lists that stream in after playback starts.
 *
 * Mutation methods (`add`, `remove`, `clear`) keep the buffer sorted and
 * notify all `subscribe` listeners synchronously after each change.
 * Subscriber errors are swallowed so a bad consumer cannot corrupt the list.
 */
export function createMutableCueList<T>(initial?: ReadonlyArray<Cue<T>>): MutableCueList<T> {
	const sorted: Cue<T>[] = initial ? [...initial].sort((a, b) => a.start - b.start) : [];
	const subs = new Set<(cues: ReadonlyArray<Cue<T>>) => void>();

	const upperBound = (time: number): number => {
		let lo = 0;
		let hi = sorted.length;
		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			const cue = sorted[mid];
			if (!cue)
				break;
			if (cue.start > time)
				hi = mid;
			else lo = mid + 1;
		}
		return lo;
	};

	const insertSorted = (cue: Cue<T>): void => {
		// Insert AFTER any existing cue with the same start — stable ordering.
		let lo = 0;
		let hi = sorted.length;
		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			const probe = sorted[mid];
			if (!probe)
				break;
			if (probe.start > cue.start)
				hi = mid;
			else lo = mid + 1;
		}
		sorted.splice(lo, 0, cue);
	};

	const notify = (): void => {
		const snapshot: ReadonlyArray<Cue<T>> = sorted.slice();
		for (const fn of subs) {
			try {
				fn(snapshot);
			}
			catch { /* subscriber errors must not corrupt the list */ }
		}
	};

	return {
		get cues(): ReadonlyArray<Cue<T>> {
			return sorted;
		},

		active(time: number): Cue<T>[] {
			const result: Cue<T>[] = [];
			const ub = upperBound(time);
			for (let i = ub - 1; i >= 0; i--) {
				const cue = sorted[i];
				if (!cue)
					continue;
				if (cue.end >= time)
					result.push(cue);
			}
			return result.reverse();
		},

		next(time: number): Cue<T> | undefined {
			return sorted[upperBound(time)];
		},

		prev(time: number): Cue<T> | undefined {
			const ub = upperBound(time);
			for (let i = ub - 1; i >= 0; i--) {
				const cue = sorted[i];
				if (!cue)
					continue;
				if (cue.end < time)
					return cue;
			}
			return undefined;
		},

		add(cue: Cue<T>): void {
			insertSorted(cue);
			notify();
		},

		remove(id: string | number): boolean {
			const idx = sorted.findIndex(c => c.id === id);
			if (idx === -1)
				return false;
			sorted.splice(idx, 1);
			notify();
			return true;
		},

		clear(): void {
			if (sorted.length === 0)
				return;
			sorted.length = 0;
			notify();
		},

		subscribe(fn: (cues: ReadonlyArray<Cue<T>>) => void): () => void {
			subs.add(fn);
			return () => {
				subs.delete(fn);
			};
		},
	};
}
