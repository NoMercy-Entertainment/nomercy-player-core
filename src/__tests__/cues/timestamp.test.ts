// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Canonical timestamp parser tests.
 *
 * Covers all input forms handled by the four original callers:
 *  - VTT cue parser: `HH:MM:SS.mmm`, `MM:SS.mmm` (fractional seconds)
 *  - Sprite VTT parser: same VTT forms
 *  - Video playlist normaliser: `H:M:S`, `M:S` (integer-only, no fraction)
 *
 * Test groups:
 *  - parseTimestamp — valid forms
 *  - parseTimestamp — invalid / edge cases → NaN
 *  - parseDurationSeconds — valid forms
 *  - parseDurationSeconds — invalid / edge cases → undefined
 */

import { describe, expect, it } from 'vitest';
import { parseDurationSeconds, parseTimestamp } from '../../adapters/cue-parser/timestamp';

describe('parseTimestamp()', () => {
	describe('valid forms', () => {
		it('parses HH:MM:SS.mmm', () => {
			expect(parseTimestamp('01:23:45.678')).toBeCloseTo(1 * 3600 + 23 * 60 + 45.678, 9);
		});

		it('parses MM:SS.mmm', () => {
			expect(parseTimestamp('03:07.500')).toBeCloseTo(3 * 60 + 7.5, 9);
		});

		it('parses HH:MM:SS with no fraction', () => {
			expect(parseTimestamp('00:00:30')).toBe(30);
		});

		it('parses MM:SS with no fraction', () => {
			expect(parseTimestamp('24:14')).toBe(24 * 60 + 14);
		});

		it('parses 00:00:00.000 as zero', () => {
			expect(parseTimestamp('00:00:00.000')).toBe(0);
		});

		it('parses large hour values', () => {
			expect(parseTimestamp('100:00:00')).toBe(100 * 3600);
		});

		it('fraction: single digit treated as tenths', () => {
			expect(parseTimestamp('00:00:01.5')).toBeCloseTo(1.5, 9);
		});

		it('fraction: two-digit treated correctly', () => {
			expect(parseTimestamp('00:00:01.50')).toBeCloseTo(1.50, 9);
		});

		it('parses H:M:S (integer-only, normaliser form)', () => {
			expect(parseTimestamp('1:24:14')).toBe(1 * 3600 + 24 * 60 + 14);
		});

		it('parses M:S (integer-only, normaliser form)', () => {
			expect(parseTimestamp('5:30')).toBe(5 * 60 + 30);
		});
	});

	describe('invalid / edge cases', () => {
		it('returns NaN for empty string', () => {
			expect(parseTimestamp('')).toBeNaN();
		});

		it('returns NaN for single part', () => {
			expect(parseTimestamp('12')).toBeNaN();
		});

		it('returns NaN for four parts', () => {
			expect(parseTimestamp('1:2:3:4')).toBeNaN();
		});

		it('returns NaN when a segment is non-numeric', () => {
			expect(parseTimestamp('xx:00:00')).toBeNaN();
		});

		it('returns NaN when seconds segment is non-numeric', () => {
			expect(parseTimestamp('00:00:xx')).toBeNaN();
		});
	});
});

describe('parseDurationSeconds()', () => {
	describe('valid forms', () => {
		it('parses H:M:S', () => {
			expect(parseDurationSeconds('1:24:14')).toBe(1 * 3600 + 24 * 60 + 14);
		});

		it('parses M:S', () => {
			expect(parseDurationSeconds('24:14')).toBe(24 * 60 + 14);
		});

		it('parses single segment as seconds', () => {
			expect(parseDurationSeconds('90')).toBe(90);
		});

		it('parses zero duration', () => {
			expect(parseDurationSeconds('0:0:0')).toBe(0);
		});

		it('parses large values', () => {
			expect(parseDurationSeconds('100:0:0')).toBe(100 * 3600);
		});
	});

	describe('invalid / edge cases', () => {
		it('returns undefined for empty string', () => {
			expect(parseDurationSeconds('')).toBeUndefined();
		});

		it('returns undefined for non-numeric segment', () => {
			expect(parseDurationSeconds('1:xx:00')).toBeUndefined();
		});

		it('returns undefined when split produces NaN part', () => {
			expect(parseDurationSeconds('abc')).toBeUndefined();
		});
	});
});
