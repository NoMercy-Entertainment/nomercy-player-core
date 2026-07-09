// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Pure formatting utility tests — `src/core/format.ts`.
 *
 * Test groups:
 *  - escapeHtml — entity replacement for & < > " '
 *  - formatSeconds — M:SS / H:MM:SS rollover, zero-padding, invalid input
 *  - clampVolume — 0-100 clamp + rounding
 *  - formatDuration — number/string/nullish display wrapper
 */

import { describe, expect, it } from 'vitest';
import {
	clampVolume,
	escapeHtml,
	formatDuration,
	formatSeconds,
} from '../core/format';

describe('escapeHtml()', () => {
	it('escapes each special character to its entity', () => {
		expect(escapeHtml('&')).toBe('&amp;');
		expect(escapeHtml('<')).toBe('&lt;');
		expect(escapeHtml('>')).toBe('&gt;');
		expect(escapeHtml('"')).toBe('&quot;');
		expect(escapeHtml('\'')).toBe('&#39;');
	});

	it('escapes every occurrence in a mixed string', () => {
		expect(escapeHtml('<a href="x">Tom & Jerry\'s</a>')).toBe(
			'&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
		);
	});

	it('returns safe strings unchanged', () => {
		expect(escapeHtml('plain text 123 äöü')).toBe('plain text 123 äöü');
	});

	it('returns the empty string unchanged', () => {
		expect(escapeHtml('')).toBe('');
	});

	it('double-escapes an already-escaped entity (no entity detection)', () => {
		expect(escapeHtml('&amp;')).toBe('&amp;amp;');
	});
});

describe('formatSeconds()', () => {
	it('formats zero as 0:00', () => {
		expect(formatSeconds(0)).toBe('0:00');
	});

	it('formats sub-minute values as 0:SS', () => {
		expect(formatSeconds(5)).toBe('0:05');
		expect(formatSeconds(59)).toBe('0:59');
	});

	it('rolls seconds into minutes at 60', () => {
		expect(formatSeconds(60)).toBe('1:00');
		expect(formatSeconds(61)).toBe('1:01');
	});

	it('does not zero-pad the leading minutes field', () => {
		expect(formatSeconds(65)).toBe('1:05');
		expect(formatSeconds(600)).toBe('10:00');
	});

	it('stays in M:SS form right up to the hour boundary', () => {
		expect(formatSeconds(3599)).toBe('59:59');
	});

	it('rolls minutes into hours at 3600 and zero-pads minutes and seconds', () => {
		expect(formatSeconds(3600)).toBe('1:00:00');
		expect(formatSeconds(3661)).toBe('1:01:01');
		expect(formatSeconds(7325)).toBe('2:02:05');
	});

	it('formats the last second before midnight as 23:59:59', () => {
		expect(formatSeconds(86_399)).toBe('23:59:59');
	});

	it('does not cap hours at 24', () => {
		expect(formatSeconds(90_000)).toBe('25:00:00');
	});

	it('floors fractional seconds', () => {
		expect(formatSeconds(61.9)).toBe('1:01');
		expect(formatSeconds(0.999)).toBe('0:00');
	});

	it('returns 0:00 for negative input', () => {
		expect(formatSeconds(-1)).toBe('0:00');
		expect(formatSeconds(-3600)).toBe('0:00');
	});

	it('returns 0:00 for NaN', () => {
		expect(formatSeconds(Number.NaN)).toBe('0:00');
	});

	it('returns 0:00 for Infinity in either direction', () => {
		expect(formatSeconds(Number.POSITIVE_INFINITY)).toBe('0:00');
		expect(formatSeconds(Number.NEGATIVE_INFINITY)).toBe('0:00');
	});
});

describe('clampVolume()', () => {
	it('passes through in-range integers', () => {
		expect(clampVolume(0)).toBe(0);
		expect(clampVolume(50)).toBe(50);
		expect(clampVolume(100)).toBe(100);
	});

	it('clamps values below 0 to 0', () => {
		expect(clampVolume(-1)).toBe(0);
		expect(clampVolume(-1000)).toBe(0);
	});

	it('clamps values above 100 to 100', () => {
		expect(clampVolume(101)).toBe(100);
		expect(clampVolume(1e6)).toBe(100);
	});

	it('rounds to the nearest integer', () => {
		expect(clampVolume(49.4)).toBe(49);
		expect(clampVolume(49.5)).toBe(50);
		expect(clampVolume(0.4)).toBe(0);
	});

	it('clamps infinities to the range bounds', () => {
		expect(clampVolume(Number.POSITIVE_INFINITY)).toBe(100);
		expect(clampVolume(Number.NEGATIVE_INFINITY)).toBe(0);
	});

	it('propagates NaN (no NaN coercion in the clamp formula)', () => {
		expect(Number.isNaN(clampVolume(Number.NaN))).toBe(true);
	});
});

describe('formatDuration()', () => {
	it('returns the empty string for undefined', () => {
		expect(formatDuration(undefined)).toBe('');
	});

	it('returns the empty string for zero', () => {
		expect(formatDuration(0)).toBe('');
	});

	it('returns the empty string for negative numbers', () => {
		expect(formatDuration(-30)).toBe('');
	});

	it('returns the empty string for NaN and Infinity', () => {
		expect(formatDuration(Number.NaN)).toBe('');
		expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('');
	});

	it('formats a positive number of seconds via formatSeconds', () => {
		expect(formatDuration(1454)).toBe('24:14');
		expect(formatDuration(3661)).toBe('1:01:01');
	});

	it('strips a leading 00: hour field from wire-format strings', () => {
		expect(formatDuration('00:24:14')).toBe('24:14');
	});

	it('strips only ONE leading 00: segment', () => {
		expect(formatDuration('00:00:30')).toBe('00:30');
	});

	it('keeps strings with a non-zero hour field intact', () => {
		expect(formatDuration('01:23:45')).toBe('01:23:45');
	});

	it('passes through strings that do not start with 00:', () => {
		expect(formatDuration('5:00')).toBe('5:00');
	});
});
