// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Unit tests for the malformed-chapter safety net (`fillChapterGaps`).
 *
 * Verifies:
 *  1. The boss's motivating case — a single chapter covering part of the
 *     runtime backfills to the full duration.
 *  2. Leading / interior / trailing gap detection, independently and combined.
 *  3. Epsilon tolerance — sub-threshold drift is not treated as a gap.
 *  4. Empty list and full-coverage list both pass through untouched
 *     (`changed: false`, same array reference).
 *  5. Unknown duration (0 / negative / NaN / Infinity) never backfills.
 *  6. Idempotence — re-running on an already-filled list with the same
 *     duration is a no-op; a duration correction re-derives from the real
 *     entries instead of stacking a second filler.
 *  7. `index` renumbering after an insertion shifts the list correctly.
 *  8. The filler-title resolver is invoked per filler and its return value
 *     becomes the synthetic chapter's title.
 */

import type { Chapter } from '../types';
import { describe, expect, it } from 'vitest';
import { CHAPTER_GAP_EPSILON_SECONDS, fillChapterGaps } from '../core/chapters/fill-gaps';

function chapter(index: number, start: number, end: number, title: string): Chapter {
	return {
		index,
		start,
		end,
		title,
	};
}

const TITLE = (): string => 'Chapter';

describe('fillChapterGaps()', () => {
	// ── The boss's exact case ──────────────────────────────────────────────

	it('backfills a single partial chapter to the full duration (trailing gap)', () => {
		const chapters = [chapter(0, 0, 10, 'Intro')];

		const result = fillChapterGaps(chapters, 30, TITLE);

		expect(result.changed).toBe(true);
		expect(result.chapters).toHaveLength(2);
		expect(result.chapters[0]).toEqual(chapter(0, 0, 10, 'Intro'));
		expect(result.chapters[1]).toMatchObject({
			index: 1,
			start: 10,
			end: 30,
			title: 'Chapter',
			synthetic: true,
		});
	});

	// ── Leading gap ─────────────────────────────────────────────────────────

	it('fills a leading gap when the first chapter starts after 0', () => {
		const chapters = [chapter(0, 5, 30, 'Main')];

		const result = fillChapterGaps(chapters, 30, TITLE);

		expect(result.changed).toBe(true);
		expect(result.chapters).toHaveLength(2);
		expect(result.chapters[0]).toMatchObject({
			index: 0,
			start: 0,
			end: 5,
			synthetic: true,
		});
		expect(result.chapters[1]).toEqual(chapter(1, 5, 30, 'Main'));
	});

	// ── Interior gap ────────────────────────────────────────────────────────

	it('fills an interior gap between two chapters', () => {
		const chapters = [
			chapter(0, 0, 10, 'Intro'),
			chapter(1, 20, 30, 'Outro'),
		];

		const result = fillChapterGaps(chapters, 30, TITLE);

		expect(result.changed).toBe(true);
		expect(result.chapters).toHaveLength(3);
		expect(result.chapters[1]).toMatchObject({
			index: 1,
			start: 10,
			end: 20,
			synthetic: true,
		});
		expect(result.chapters[2]).toEqual(chapter(2, 20, 30, 'Outro'));
	});

	// ── Leading + interior + trailing combined ─────────────────────────────

	it('fills leading, interior, AND trailing gaps in the same pass', () => {
		const chapters = [
			chapter(0, 5, 10, 'A'),
			chapter(1, 15, 20, 'B'),
		];

		const result = fillChapterGaps(chapters, 30, TITLE);

		expect(result.changed).toBe(true);
		expect(result.chapters.map(entry => [entry.start, entry.end, entry.synthetic ?? false])).toEqual([
			[0, 5, true],
			[5, 10, false],
			[10, 15, true],
			[15, 20, false],
			[20, 30, true],
		]);
		expect(result.chapters.map(entry => entry.index)).toEqual([0, 1, 2, 3, 4]);
	});

	// ── Epsilon tolerance ───────────────────────────────────────────────────

	describe('epsilon tolerance', () => {
		it('does not insert a filler for a gap smaller than the epsilon', () => {
			const chapters = [
				chapter(0, 0, 10, 'A'),
				chapter(1, 10 + CHAPTER_GAP_EPSILON_SECONDS / 2, 20, 'B'),
			];

			const result = fillChapterGaps(chapters, 20, TITLE);

			expect(result.changed).toBe(false);
			expect(result.chapters).toBe(chapters);
		});

		it('does not insert a trailing filler when duration drift is within the epsilon', () => {
			const chapters = [chapter(0, 0, 20, 'A')];

			const result = fillChapterGaps(chapters, 20 + CHAPTER_GAP_EPSILON_SECONDS / 2, TITLE);

			expect(result.changed).toBe(false);
			expect(result.chapters).toBe(chapters);
		});

		it('DOES insert a filler once the gap exceeds the epsilon', () => {
			const chapters = [
				chapter(0, 0, 10, 'A'),
				chapter(1, 10 + CHAPTER_GAP_EPSILON_SECONDS * 2, 20, 'B'),
			];

			const result = fillChapterGaps(chapters, 20, TITLE);

			expect(result.changed).toBe(true);
			expect(result.chapters).toHaveLength(3);
		});
	});

	// ── Empty stays empty ───────────────────────────────────────────────────

	it('leaves an empty list empty regardless of duration', () => {
		const chapters: Chapter[] = [];

		const result = fillChapterGaps(chapters, 120, TITLE);

		expect(result.changed).toBe(false);
		expect(result.chapters).toBe(chapters);
		expect(result.chapters).toHaveLength(0);
	});

	// ── Full coverage passes through untouched ─────────────────────────────

	it('returns the identical reference when the list already fully covers the duration', () => {
		const chapters = [
			chapter(0, 0, 10, 'A'),
			chapter(1, 10, 20, 'B'),
		];

		const result = fillChapterGaps(chapters, 20, TITLE);

		expect(result.changed).toBe(false);
		expect(result.chapters).toBe(chapters);
	});

	// ── Unknown duration never backfills ────────────────────────────────────

	describe('unknown duration', () => {
		const chapters = [chapter(0, 0, 10, 'Intro')];

		it('duration 0 passes through raw', () => {
			const result = fillChapterGaps(chapters, 0, TITLE);
			expect(result.changed).toBe(false);
			expect(result.chapters).toBe(chapters);
		});

		it('negative duration passes through raw', () => {
			const result = fillChapterGaps(chapters, -5, TITLE);
			expect(result.changed).toBe(false);
			expect(result.chapters).toBe(chapters);
		});

		it('NaN duration passes through raw', () => {
			const result = fillChapterGaps(chapters, Number.NaN, TITLE);
			expect(result.changed).toBe(false);
			expect(result.chapters).toBe(chapters);
		});

		it('Infinity duration passes through raw', () => {
			const result = fillChapterGaps(chapters, Number.POSITIVE_INFINITY, TITLE);
			expect(result.changed).toBe(false);
			expect(result.chapters).toBe(chapters);
		});
	});

	// ── Idempotence / re-normalization ──────────────────────────────────────

	describe('idempotence across repeated calls', () => {
		it('re-running with the SAME duration on an already-filled list is a no-op', () => {
			const chapters = [chapter(0, 0, 10, 'Intro')];
			const first = fillChapterGaps(chapters, 30, TITLE);
			expect(first.changed).toBe(true);

			const second = fillChapterGaps(first.chapters, 30, TITLE);

			expect(second.changed).toBe(false);
			expect(second.chapters).toBe(first.chapters);
		});

		it('a LATER, larger duration extends the trailing filler instead of stacking a second one', () => {
			const chapters = [chapter(0, 0, 10, 'Intro')];
			const first = fillChapterGaps(chapters, 30, TITLE);

			const second = fillChapterGaps(first.chapters, 90, TITLE);

			expect(second.changed).toBe(true);
			expect(second.chapters).toHaveLength(2);
			expect(second.chapters[1]).toMatchObject({
				start: 10,
				end: 90,
				synthetic: true,
			});
		});

		it('a duration that shrinks back to exactly the real content drops the now-stale filler', () => {
			const chapters = [chapter(0, 0, 10, 'Intro')];
			const first = fillChapterGaps(chapters, 30, TITLE);
			expect(first.chapters).toHaveLength(2);

			const second = fillChapterGaps(first.chapters, 10, TITLE);

			expect(second.changed).toBe(true);
			expect(second.chapters).toHaveLength(1);
			expect(second.chapters[0]).toEqual(chapter(0, 0, 10, 'Intro'));
		});
	});

	// ── Filler-title resolver ────────────────────────────────────────────────

	it('invokes makeFillerTitle once per inserted filler and uses its return value', () => {
		const chapters = [
			chapter(0, 5, 10, 'A'),
			chapter(1, 20, 25, 'B'),
		];
		const calls: number[] = [];
		let callCount = 0;
		const makeTitle = (): string => {
			callCount += 1;
			calls.push(callCount);
			return `Filler ${callCount}`;
		};

		const result = fillChapterGaps(chapters, 25, makeTitle);

		expect(calls).toEqual([1, 2]);
		const fillers = result.chapters.filter(entry => entry.synthetic);
		expect(fillers.map(entry => entry.title)).toEqual(['Filler 1', 'Filler 2']);
	});

	// ── synthetic flag ───────────────────────────────────────────────────────

	it('never marks a real (ingest-sourced) chapter as synthetic', () => {
		const chapters = [chapter(0, 5, 10, 'A')];

		const result = fillChapterGaps(chapters, 30, TITLE);

		const real = result.chapters.find(entry => entry.title === 'A');
		expect(real?.synthetic).toBeUndefined();
	});
});
