// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { QualityLevel } from '../types/tracks';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { hdrAbrCeiling } from '../adapters/quality/hdr-policy';
import { abrCeiling, panePixels, sizeAbrCeiling } from '../adapters/quality/size-policy';

// How big a rendition this pane deserves.
//
// The HLS backend capped by dynamic range and by nothing else, so a 3840-wide
// rung landed in a 740px-wide player whenever bandwidth allowed — bytes, decode
// and battery all spent on pixels the scaler throws away.
//
// Mirrors SizePolicyTest.kt case for case. Both sides exist so the native port
// has something to match; if these two files disagree, the port has drifted.
function rung(index: number, width: number, height: number, bitrate: number, range: 'sdr' | 'hdr'): QualityLevel {
	// Every field the type declares, not a cast over a partial: a fixture that is
	// not really a QualityLevel is a test agreeing with itself rather than with
	// the type the code receives.
	return {
		label: `${height}p${range === 'hdr' ? ' HDR' : ''}`,
		index,
		width,
		height,
		bitrate,
		dynamicRange: range,
	};
}

// The real Sintel ladder the media server produces, not an invented one: two
// resolutions, each in both dynamic ranges, so height ties resolve on bitrate.
const SINTEL_1080_SDR = rung(0, 1920, 818, 743_922, 'sdr');
const SINTEL_1080_HDR = rung(1, 1920, 818, 821_147, 'hdr');
const SINTEL_4K_SDR = rung(2, 3840, 1635, 2_077_179, 'sdr');
const SINTEL_4K_HDR = rung(3, 3840, 1635, 2_402_870, 'hdr');

const SINTEL = [SINTEL_1080_SDR, SINTEL_1080_HDR, SINTEL_4K_SDR, SINTEL_4K_HDR];

// Three heights, one dynamic range: the ladder that shows the ceiling is chosen
// by coverage rather than by "biggest" or "smallest".
const TIER_720 = rung(0, 1280, 720, 1_500_000, 'sdr');
const TIER_1080 = rung(1, 1920, 1080, 4_000_000, 'sdr');
const TIER_2160 = rung(2, 3840, 2160, 16_000_000, 'sdr');

const TIERS = [TIER_720, TIER_1080, TIER_2160];

describe('sizeAbrCeiling', () => {
	it('caps a small pane to the cheapest rung that still covers it', () => {
		// 800x341 is the desktop player in a page column. The 4K rungs cover it too,
		// and picking one would be the whole reported bug.
		expect(sizeAbrCeiling(SINTEL, 800, 341)).toBe(SINTEL_1080_SDR);
	});

	it('never picks a rung below the pane', () => {
		// A rung under the pane upscales into a soft picture, which is the mistake a
		// viewer notices. One pixel past 720p the 720 rung stops qualifying.
		expect(sizeAbrCeiling(TIERS, 1280, 720)).toBe(TIER_720);
		expect(sizeAbrCeiling(TIERS, 1281, 721)).toBe(TIER_1080);
	});

	it('does not apply a cap that would change nothing', () => {
		// A pane as large as the ladder's best rung. The cap saves no pixels and
		// still narrows what adaptation may pick if the comparison is subtly wrong,
		// so the safest constraint is the one not applied.
		expect(sizeAbrCeiling(SINTEL, 3840, 1635)).toBeNull();
		// Nothing covers a pane larger than the ladder either.
		expect(sizeAbrCeiling(SINTEL, 5120, 2160)).toBeNull();
	});

	it('never caps on a pane it has not measured', () => {
		// A pane read before layout reports zero. Capping on that answer pins the
		// stream to its lowest rung for the whole session.
		expect(sizeAbrCeiling(SINTEL, 0, 341)).toBeNull();
		expect(sizeAbrCeiling(SINTEL, 800, 0)).toBeNull();
		expect(sizeAbrCeiling(SINTEL, -1, -1)).toBeNull();
	});

	it('does not cap an empty ladder', () => {
		// A backend that has not enumerated its rungs yet, or a progressive file
		// with no ladder at all.
		expect(sizeAbrCeiling([], 800, 341)).toBeNull();
	});

	it('keeps a rung that declares no width', () => {
		// An undeclared width is not a narrow width. The native ladder carries no
		// widths at all, so dropping these would land the port on a taller rung
		// than the web — the divergence the port exists to remove.
		const widthless: QualityLevel = { label: '818p', index: 4, height: 818, bitrate: 700_000 };
		const ladder = [widthless, SINTEL_4K_SDR];

		expect(sizeAbrCeiling(ladder, 1200, 300)).toBe(widthless);
	});

	it('sorts a rung with no height below every real one', () => {
		// An audio-only rendition, or a ladder a backend has only half described.
		// Nought is what an unknown height deserves when the question is what this
		// pane can be fed, so it never covers and never becomes the ceiling.
		const audioOnly: QualityLevel = { label: 'audio', index: 4, bitrate: 128_000 };

		expect(sizeAbrCeiling([audioOnly, ...SINTEL], 800, 341)).toBe(SINTEL_1080_SDR);
		expect(sizeAbrCeiling([audioOnly], 800, 341)).toBeNull();
	});
});

describe('panePixels', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('measures in device pixels, not CSS pixels', () => {
		// CSS pixels understate a retina panel twofold, and a ceiling computed from
		// them caps that viewer to a visibly softer picture than the screen draws.
		vi.stubGlobal('devicePixelRatio', 2);
		const element = { getBoundingClientRect: () => ({ width: 400, height: 170.5 }) };

		expect(panePixels(element)).toEqual({ widthPx: 800, heightPx: 341 });
	});

	it('treats a ratio it cannot trust as 1', () => {
		const element = { getBoundingClientRect: () => ({ width: 800, height: 341 }) };

		for (const bad of [0, -2, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
			vi.stubGlobal('devicePixelRatio', bad);
			expect(panePixels(element)).toEqual({ widthPx: 800, heightPx: 341 });
		}
	});

	it('reports zero for an element that is not there', () => {
		expect(panePixels(null)).toEqual({ widthPx: 0, heightPx: 0 });
		expect(panePixels(undefined)).toEqual({ widthPx: 0, heightPx: 0 });
	});
});

describe('abrCeiling', () => {
	it('takes the more restrictive of the two', () => {
		const hdr = hdrAbrCeiling(SINTEL, false);
		expect(hdr).toBe(SINTEL_4K_SDR);
		expect(abrCeiling(hdr, SINTEL_1080_SDR)).toBe(SINTEL_1080_SDR);
		expect(abrCeiling(SINTEL_1080_SDR, SINTEL_4K_SDR)).toBe(SINTEL_1080_SDR);
	});

	it('breaks a height tie on bitrate', () => {
		expect(abrCeiling(SINTEL_1080_HDR, SINTEL_1080_SDR)).toBe(SINTEL_1080_SDR);
		expect(abrCeiling(SINTEL_1080_SDR, SINTEL_1080_HDR)).toBe(SINTEL_1080_SDR);
	});

	it('passes through whichever ceiling is set on its own', () => {
		expect(abrCeiling(null, SINTEL_1080_SDR)).toBe(SINTEL_1080_SDR);
		expect(abrCeiling(SINTEL_4K_SDR, null)).toBe(SINTEL_4K_SDR);
	});

	it('caps nothing when neither reason to cap exists', () => {
		expect(abrCeiling(null, null)).toBeNull();
	});
});
