// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { Chapter } from '../../types';

/**
 * Tolerance (seconds) below which a start/end mismatch is treated as
 * floating-point slop rather than a real gap. VTT timestamps parse to
 * millisecond precision and a browser-reported `duration` carries its own
 * rounding error, so a few hundred milliseconds of drift between "last
 * chapter ends" and "next chapter starts" (or the media's real duration) is
 * routine, not malformed data. Real gaps in the wild — this safety net's
 * actual target — run from several seconds to entire missing segments.
 */
export const CHAPTER_GAP_EPSILON_SECONDS = 0.25;

/** Result of {@link fillChapterGaps}. */
export interface ChapterGapFillResult {
	/**
	 * The gap-filled list. Reference-identical to the input `chapters` array
	 * when `changed` is `false` — callers can skip a write/re-emit with an
	 * identity check instead of a deep comparison.
	 */
	chapters: ReadonlyArray<Chapter>;
	/** `true` when the returned list differs from the input. */
	changed: boolean;
}

/**
 * The malformed-chapter safety net. Given a chapter list and the media's
 * known duration, fills every gap with a synthetic chapter (`synthetic: true`)
 * so the list always covers `[0, duration)` with no holes:
 *
 *  - **Leading gap** — the first chapter starts after `0` → filler from `0`.
 *  - **Interior gap** — chapter `N` ends before chapter `N+1` starts → filler
 *    between them.
 *  - **Trailing gap** — the last chapter ends before `duration` → filler to
 *    `duration`. This covers a single chapter that only covers part of the
 *    runtime — the most common malformed shape.
 *
 * Gaps are re-derived from the REAL (non-synthetic) entries on every call, so
 * re-running this on an already-filled list (duration corrected a second
 * time) never stacks fillers from a prior pass — idempotent by construction.
 *
 * No-ops (returns the input untouched, `changed: false`) when:
 *  - the list is empty — the net catches malformed lists, not absent ones.
 *  - `duration` is unknown (`0`, negative, `NaN`, or `Infinity`) — chapters
 *    routinely resolve before a real duration is known; backfilling against
 *    an unknown length would be worse than showing the raw list. Re-invoke
 *    once a real duration lands.
 *  - the list already covers `[0, duration)` with no gap wider than
 *    {@link CHAPTER_GAP_EPSILON_SECONDS}.
 *
 * `makeFillerTitle` is invoked once per inserted filler and must already be
 * translated — this function is a pure data transform with no translator
 * dependency of its own.
 */
export function fillChapterGaps(
	chapters: ReadonlyArray<Chapter>,
	duration: number,
	makeFillerTitle: () => string,
): ChapterGapFillResult {
	if (chapters.length === 0) {
		return {
			chapters,
			changed: false,
		};
	}

	if (!Number.isFinite(duration) || duration <= 0) {
		return {
			chapters,
			changed: false,
		};
	}

	const real = chapters.filter(chapter => !chapter.synthetic);
	if (real.length === 0) {
		return {
			chapters,
			changed: false,
		};
	}

	const filled: Chapter[] = [];
	let cursor = 0;

	for (const chapter of real) {
		if (chapter.start > cursor + CHAPTER_GAP_EPSILON_SECONDS) {
			filled.push(_makeFiller(cursor, chapter.start, makeFillerTitle()));
		}
		filled.push(chapter);
		cursor = Math.max(cursor, chapter.end);
	}

	if (duration > cursor + CHAPTER_GAP_EPSILON_SECONDS) {
		filled.push(_makeFiller(cursor, duration, makeFillerTitle()));
	}

	if (_sameChapterList(filled, chapters)) {
		return {
			chapters,
			changed: false,
		};
	}

	return {
		chapters: _reindex(filled),
		changed: true,
	};
}

function _makeFiller(start: number, end: number, title: string): Chapter {
	return {
		index: -1,
		start,
		end,
		title,
		synthetic: true,
	};
}

function _reindex(list: ReadonlyArray<Chapter>): Chapter[] {
	return list.map((chapter, index) => (chapter.index === index
		? chapter
		: {
				...chapter,
				index,
			}));
}

/**
 * Value-equal comparison (start / end / title / synthetic-ness), not
 * reference equality — a re-derived filler covering the same gap is a fresh
 * object even when it changes nothing observable. Real entries ARE the same
 * reference (this function never copies them), so this also short-circuits
 * cheaply on the common "nothing to do" path.
 */
function _sameChapterList(candidate: ReadonlyArray<Chapter>, existing: ReadonlyArray<Chapter>): boolean {
	if (candidate.length !== existing.length)
		return false;

	return candidate.every((chapter, i) => {
		const other = existing[i]!;
		return chapter === other
			|| (
				chapter.start === other.start
				&& chapter.end === other.end
				&& chapter.title === other.title
				&& Boolean(chapter.synthetic) === Boolean(other.synthetic)
			);
	});
}
