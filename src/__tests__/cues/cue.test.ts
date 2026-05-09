/**
 * createCueList tests — binary-search-backed time-indexed cue list. Used by
 * lyrics, subtitles, sprite previews, chapters. Independent of CueTracker.
 *
 * Test groups:
 *  - Empty + single-cue lists
 *  - Sorted output regardless of input order
 *  - active(time) — overlapping cues, gaps, boundaries
 *  - next(time) — first cue with start > time
 *  - prev(time) — last cue with end < time
 *  - createMutableCueList — add/remove/clear, subscribe, live queries
 */

import { describe, expect, it } from 'vitest';
import { createCueList, createMutableCueList } from '../../cues/cue';

interface Payload { name: string }

const cue = (start: number, end: number, name: string) => ({ start, end, payload: { name } });

describe('createCueList()', () => {
	describe('construction', () => {
		it('handles empty input', () => {
			const list = createCueList<Payload>([]);
			expect(list.cues).toEqual([]);
		});

		it('handles single cue', () => {
			const list = createCueList<Payload>([cue(0, 5, 'A')]);
			expect(list.cues).toHaveLength(1);
		});

		it('sorts cues by start ascending', () => {
			const list = createCueList<Payload>([
				cue(20, 25, 'C'),
				cue(0, 5, 'A'),
				cue(10, 15, 'B'),
			]);
			expect(list.cues.map(c => c.payload.name)).toEqual(['A', 'B', 'C']);
		});

		it('preserves input order for cues with same start', () => {
			const list = createCueList<Payload>([
				cue(0, 5, 'A'),
				cue(0, 5, 'B'),
				cue(0, 5, 'C'),
			]);
			expect(list.cues.map(c => c.payload.name)).toEqual(['A', 'B', 'C']);
		});

		it('does NOT mutate the input array', () => {
			const input = [cue(20, 25, 'C'), cue(0, 5, 'A')];
			const original = [...input];
			createCueList<Payload>(input);
			expect(input).toEqual(original);
		});
	});

	describe('active(time)', () => {
		it('returns empty when time is before any cue', () => {
			const list = createCueList<Payload>([cue(10, 20, 'A')]);
			expect(list.active(5)).toEqual([]);
		});

		it('returns empty when time is after every cue', () => {
			const list = createCueList<Payload>([cue(10, 20, 'A')]);
			expect(list.active(100)).toEqual([]);
		});

		it('returns the cue containing the time', () => {
			const list = createCueList<Payload>([
				cue(0, 10, 'A'),
				cue(20, 30, 'B'),
			]);
			expect(list.active(5).map(c => c.payload.name)).toEqual(['A']);
			expect(list.active(25).map(c => c.payload.name)).toEqual(['B']);
		});

		it('returns ALL overlapping cues', () => {
			const list = createCueList<Payload>([
				cue(0, 20, 'A'),
				cue(5, 25, 'B'),
				cue(10, 15, 'C'),
			]);
			const active = list.active(12);
			expect(active.map(c => c.payload.name).sort()).toEqual(['A', 'B', 'C']);
		});

		it('start boundary is inclusive', () => {
			const list = createCueList<Payload>([cue(10, 20, 'A')]);
			expect(list.active(10)).toHaveLength(1);
		});

		it('end boundary is inclusive', () => {
			const list = createCueList<Payload>([cue(10, 20, 'A')]);
			expect(list.active(20)).toHaveLength(1);
		});

		it('returns empty in a gap between cues', () => {
			const list = createCueList<Payload>([
				cue(0, 5, 'A'),
				cue(10, 15, 'B'),
			]);
			expect(list.active(7)).toEqual([]);
		});

		it('returns active cues in start-time order', () => {
			const list = createCueList<Payload>([
				cue(0, 100, 'A'),
				cue(10, 50, 'B'),
				cue(20, 30, 'C'),
			]);
			const active = list.active(25);
			expect(active.map(c => c.payload.name)).toEqual(['A', 'B', 'C']);
		});
	});

	describe('next(time)', () => {
		it('returns the first cue with start > time', () => {
			const list = createCueList<Payload>([
				cue(0, 5, 'A'),
				cue(10, 15, 'B'),
				cue(20, 25, 'C'),
			]);
			expect(list.next(7)?.payload.name).toBe('B');
		});

		it('returns undefined when time is past the last cue start', () => {
			const list = createCueList<Payload>([cue(0, 5, 'A')]);
			expect(list.next(10)).toBeUndefined();
		});

		it('returns the first cue when time is before all', () => {
			const list = createCueList<Payload>([cue(10, 20, 'A')]);
			expect(list.next(0)?.payload.name).toBe('A');
		});

		it('strict greater-than (skips current cue when time === start)', () => {
			const list = createCueList<Payload>([
				cue(10, 20, 'A'),
				cue(30, 40, 'B'),
			]);
			expect(list.next(10)?.payload.name).toBe('B');
		});

		it('returns undefined for empty list', () => {
			expect(createCueList<Payload>([]).next(0)).toBeUndefined();
		});
	});

	describe('prev(time)', () => {
		it('returns the last cue with end < time', () => {
			const list = createCueList<Payload>([
				cue(0, 5, 'A'),
				cue(10, 15, 'B'),
				cue(20, 25, 'C'),
			]);
			// At time=17, B (ends at 15) is the LAST cue whose end < 17.
			// A (ends at 5) also satisfies end < 17, but B comes later in order.
			expect(list.prev(17)?.payload.name).toBe('B');
		});

		it('returns undefined when no cue ends before time', () => {
			const list = createCueList<Payload>([cue(10, 20, 'A')]);
			expect(list.prev(5)).toBeUndefined();
		});

		it('strict less-than (skips current cue when time === end)', () => {
			const list = createCueList<Payload>([
				cue(0, 5, 'A'),
				cue(10, 15, 'B'),
			]);
			// At time=10, B's end is 15, which is NOT < 10. A's end is 5, which IS < 10.
			expect(list.prev(10)?.payload.name).toBe('A');
		});

		it('returns undefined for empty list', () => {
			expect(createCueList<Payload>([]).prev(100)).toBeUndefined();
		});
	});
});

describe('createMutableCueList()', () => {
	it('starts empty when called with no args', () => {
		const list = createMutableCueList<Payload>();
		expect(list.cues).toEqual([]);
	});

	it('seeds and sorts the initial buffer', () => {
		const list = createMutableCueList<Payload>([cue(20, 25, 'C'), cue(0, 5, 'A')]);
		expect(list.cues.map(c => c.payload.name)).toEqual(['A', 'C']);
	});

	it('add() inserts in sorted order', () => {
		const list = createMutableCueList<Payload>();
		list.add(cue(20, 25, 'C'));
		list.add(cue(0, 5, 'A'));
		list.add(cue(10, 15, 'B'));
		expect(list.cues.map(c => c.payload.name)).toEqual(['A', 'B', 'C']);
	});

	it('active/next/prev see live data after add()', () => {
		const list = createMutableCueList<Payload>();
		list.add(cue(0, 10, 'A'));
		expect(list.active(5).map(c => c.payload.name)).toEqual(['A']);
		list.add(cue(20, 30, 'B'));
		expect(list.next(5)?.payload.name).toBe('B');
		expect(list.prev(15)?.payload.name).toBe('A');
	});

	it('remove(id) returns true and drops the cue', () => {
		const list = createMutableCueList<Payload>();
		list.add({ start: 0, end: 5, payload: { name: 'A' }, id: 'a' });
		list.add({ start: 10, end: 15, payload: { name: 'B' }, id: 'b' });
		expect(list.remove('a')).toBe(true);
		expect(list.cues.map(c => c.payload.name)).toEqual(['B']);
	});

	it('remove(id) returns false when no cue matches', () => {
		const list = createMutableCueList<Payload>();
		list.add({ start: 0, end: 5, payload: { name: 'A' }, id: 'a' });
		expect(list.remove('missing')).toBe(false);
		expect(list.cues).toHaveLength(1);
	});

	it('remove(id) is a no-op for cues without an id (best-effort)', () => {
		const list = createMutableCueList<Payload>([cue(0, 5, 'A')]);
		expect(list.remove('a')).toBe(false);
		expect(list.cues).toHaveLength(1);
	});

	it('clear() empties the list', () => {
		const list = createMutableCueList<Payload>([cue(0, 5, 'A'), cue(10, 15, 'B')]);
		list.clear();
		expect(list.cues).toEqual([]);
		expect(list.active(0)).toEqual([]);
	});

	it('subscribe() fires on add/remove/clear with a snapshot', () => {
		const list = createMutableCueList<Payload>();
		const seen: number[] = [];
		const unsub = list.subscribe(cues => seen.push(cues.length));
		list.add({ start: 0, end: 5, payload: { name: 'A' }, id: 'a' });
		list.add({ start: 10, end: 15, payload: { name: 'B' }, id: 'b' });
		list.remove('a');
		list.clear();
		unsub();
		list.add(cue(20, 25, 'C'));
		expect(seen).toEqual([1, 2, 1, 0]);
	});

	it('clear() on an empty list does not notify', () => {
		const list = createMutableCueList<Payload>();
		const seen: number[] = [];
		list.subscribe(cues => seen.push(cues.length));
		list.clear();
		expect(seen).toEqual([]);
	});

	it('subscriber errors do not stop subsequent subscribers', () => {
		const list = createMutableCueList<Payload>();
		const calls: string[] = [];
		list.subscribe(() => {
			calls.push('a');
			throw new Error('boom');
		});
		list.subscribe(() => {
			calls.push('b');
		});
		list.add(cue(0, 5, 'A'));
		expect(calls).toEqual(['a', 'b']);
	});
});
