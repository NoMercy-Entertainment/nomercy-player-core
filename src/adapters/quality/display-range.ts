// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Whether this screen can actually show HDR.
 *
 * `types/tracks.ts` already named the query — `matchMedia('(dynamic-range: high)')`
 * — as how this would be answered, and nothing ever asked it. So `hdrDecision` had
 * no input and an HDR ladder played on an SDR panel unchallenged.
 *
 * `video-dynamic-range` is asked first because it is the one that describes the
 * VIDEO plane. `dynamic-range` answers for the page, and a browser can composite
 * HDR video on a screen whose page rendering it reports as standard.
 */
export interface DisplayRangeProbe {
	/** Answers a CSS media query. Injected so the decision is testable. */
	matches: (query: string) => boolean;
}

const VIDEO_RANGE_QUERY = '(video-dynamic-range: high)';
const PAGE_RANGE_QUERY = '(dynamic-range: high)';

/**
 * A probe backed by the real browser, or null when there is no browser.
 *
 * Null rather than a probe that always says no: "there is no screen to ask" and
 * "the screen said no" are different answers, and only the first one should leave
 * a caller free to skip the whole question.
 */
export function browserDisplayRangeProbe(): DisplayRangeProbe | null {
	if (typeof globalThis.matchMedia !== 'function')
		return null;

	return {
		matches: (query: string): boolean => {
			try {
				return globalThis.matchMedia(query).matches;
			}
			catch {
				// A browser that does not understand the query throws rather than
				// returning false, and an unknown query is not a claim about the screen.
				return false;
			}
		},
	};
}

/**
 * True only when the screen says so.
 *
 * Defaults to SDR when nothing can be asked, because that is the assumption whose
 * failure is visible and recoverable: an SDR decision on an HDR panel shows a
 * correct-looking picture at a lower rung, and an HDR decision on an SDR panel shows
 * the washed-out one a viewer reported.
 */
export function detectDisplayHdr(probe: DisplayRangeProbe | null = browserDisplayRangeProbe()): boolean {
	if (probe === null)
		return false;

	return probe.matches(VIDEO_RANGE_QUERY) || probe.matches(PAGE_RANGE_QUERY);
}
