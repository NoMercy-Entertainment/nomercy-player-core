// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { QualityLevel } from '../types/tracks';

import { describe, expect, it } from 'vitest';
import { detectDisplayHdr } from '../adapters/quality/display-range';
import { hdrAbrCeiling, hdrDecision, isHdrUnplayable } from '../adapters/quality/hdr-policy';

// What to do about dynamic range on this screen.
//
// `dynamicRange` sat on QualityLevel with nothing reading it, so an HDR ladder
// played on an SDR display with nothing consulted and nothing converted — and a
// viewer with GOOD bandwidth got the worst picture, because adaptation climbs into
// the HDR rungs on its own.
//
// Mirrors HdrPolicyTest.kt case for case. Both sides exist so the native port has
// something to match; if these two files disagree, the port has drifted.
function rung(height: number, bitrate: number, range: 'sdr' | 'hdr'): QualityLevel {
	// Every field the type declares, not a cast over a partial. `label` and `index`
	// were missing and the `as` hid it — a fixture that is not really a QualityLevel
	// is a test agreeing with itself rather than with the type the code receives.
	return {
		label: `${height}p${range === 'hdr' ? ' HDR' : ''}`,
		index: height,
		height,
		bitrate,
		dynamicRange: range,
	};
}

const SDR_1080 = rung(1080, 6_000_000, 'sdr');
const SDR_720 = rung(720, 3_000_000, 'sdr');
const HDR_1080 = rung(1080, 6_500_000, 'hdr');
const HDR_2160 = rung(2160, 18_000_000, 'hdr');

const MIXED = [HDR_2160, HDR_1080, SDR_1080, SDR_720];
const SDR_ONLY = [SDR_1080, SDR_720];
const HDR_ONLY = [HDR_2160, HDR_1080];

describe('hdrAbrCeiling', () => {
	it('caps to the best SDR rung, height first then bitrate', () => {
		expect(hdrAbrCeiling(MIXED, false)).toBe(SDR_1080);
	});

	it('does not apply a cap that would change nothing', () => {
		// A cap still narrows what adaptation may pick if the comparison is subtly
		// wrong, so the safest constraint is the one not applied.
		expect(hdrAbrCeiling(MIXED, true)).toBeNull();
		expect(hdrAbrCeiling(SDR_ONLY, false)).toBeNull();
	});

	it('reports an HDR-only ladder rather than capping to nothing', () => {
		expect(hdrAbrCeiling(HDR_ONLY, false)).toBeNull();
		expect(isHdrUnplayable(HDR_ONLY, false)).toBe(true);
		expect(isHdrUnplayable(MIXED, false)).toBe(false);
	});
});

describe('hdrDecision', () => {
	it('leaves an HDR screen and an ordinary SDR item alone', () => {
		expect(hdrDecision(MIXED, true, false)).toEqual({ kind: 'as-is' });
		expect(hdrDecision(SDR_ONLY, false, true)).toEqual({ kind: 'as-is' });
	});

	it('prefers an SDR rung over tone-mapping', () => {
		// Cheaper and correct: a natively-SDR stream costs nothing per frame. Tone-
		// mapping is for the case with no rung to pick, not a first resort.
		expect(hdrDecision(MIXED, false, true)).toEqual({ kind: 'cap-to', level: SDR_1080 });
	});

	it('tone-maps when there is no SDR rung', () => {
		expect(hdrDecision(HDR_ONLY, false, true)).toEqual({ kind: 'tone-map' });
	});

	it('falls back to the consumer only when nothing else can decide', () => {
		expect(hdrDecision(HDR_ONLY, false, false, 'play')).toEqual({ kind: 'play-unconverted' });
		expect(hdrDecision(HDR_ONLY, false, false, 'refuse')).toEqual({ kind: 'refuse' });
	});

	it('never lets refuse override a rung or a converter', () => {
		// Refuse is a last resort, not a preference — a title with a perfectly good
		// SDR rendition must still play.
		expect(hdrDecision(MIXED, false, false, 'refuse')).toEqual({ kind: 'cap-to', level: SDR_1080 });
		expect(hdrDecision(HDR_ONLY, false, true, 'refuse')).toEqual({ kind: 'tone-map' });
	});

	it('does not refuse an empty ladder', () => {
		// A backend that has not enumerated its rungs yet, or a progressive file with
		// no ladder at all. Refusing there refuses every single-file item.
		expect(hdrDecision([], false, false, 'refuse')).toEqual({ kind: 'as-is' });
	});
});

describe('detectDisplayHdr', () => {
	it('asks the video plane before the page', () => {
		// A browser can composite HDR video on a screen whose PAGE rendering it
		// reports as standard, so asking only `dynamic-range` calls an HDR-capable
		// panel SDR and pins every ladder a rung lower than it needs.
		const asked: string[] = [];
		const probe = {
			matches: (query: string): boolean => {
				asked.push(query);
				return query.includes('video-dynamic-range');
			},
		};

		expect(detectDisplayHdr(probe)).toBe(true);
		expect(asked[0]).toBe('(video-dynamic-range: high)');
	});

	it('falls back to the page query', () => {
		const probe = { matches: (query: string): boolean => !query.includes('video-') };

		expect(detectDisplayHdr(probe)).toBe(true);
	});

	it('assumes SDR when there is nothing to ask', () => {
		// The assumption whose failure is visible and recoverable: SDR on an HDR panel
		// is a correct-looking picture one rung lower, HDR on an SDR panel is the
		// washed-out one that was reported.
		expect(detectDisplayHdr(null)).toBe(false);
		expect(detectDisplayHdr({ matches: () => false })).toBe(false);
	});
});
