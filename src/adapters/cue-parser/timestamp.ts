// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Canonical timestamp / duration parsers shared across cue parsers and player
 * normalisers.
 *
 * Two functions are exported:
 *
 *  - `parseTimestamp(ts)` — parses a colon-delimited cue timestamp into
 *    seconds. Accepts `HH:MM:SS`, `HH:MM:SS.mmm`, `MM:SS`, and `MM:SS.mmm`.
 *    Returns `NaN` for unrecognised input. Used by VTT and sprite parsers.
 *
 *  - `parseDurationSeconds(value)` — parses a `"H:M:S"` / `"M:S"` duration
 *    string (integer parts only, no fraction) into seconds. Returns `undefined`
 *    for unrecognised input. Used by playlist-item normalisers.
 */

/**
 * Parse a WebVTT-style timestamp (`HH:MM:SS.mmm` or `MM:SS.mmm`, HH optional,
 * fractional seconds optional) into a total-seconds `number`.
 *
 * Returns `NaN` when the input cannot be parsed (wrong part count, non-numeric
 * segment, or missing required components).
 *
 * @param ts - The raw timestamp string, e.g. `"01:23:45.678"` or `"12:34.500"`.
 */
export function parseTimestamp(ts: string): number {
	const parts = ts.split(':');

	if (parts.length === 3) {
		const hours = Number.parseInt(parts[0]!, 10);
		const minutes = Number.parseInt(parts[1]!, 10);
		const seconds = Number.parseFloat(parts[2]!);

		if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds))
			return Number.NaN;

		return hours * 3600 + minutes * 60 + seconds;
	}

	if (parts.length === 2) {
		const minutes = Number.parseInt(parts[0]!, 10);
		const seconds = Number.parseFloat(parts[1]!);

		if (Number.isNaN(minutes) || Number.isNaN(seconds))
			return Number.NaN;

		return minutes * 60 + seconds;
	}

	return Number.NaN;
}

/**
 * Parse a `"H:M:S"` or `"M:S"` duration string (integer colon-separated
 * parts, no fractional seconds) into a total-seconds `number`.
 *
 * Returns `undefined` when the input is invalid (empty, non-numeric part, or
 * zero parts). This matches the normaliser contract where `undefined` means
 * "duration unknown" rather than 0.
 *
 * @param value - The raw duration string, e.g. `"1:24:14"` or `"24:14"`.
 */
export function parseDurationSeconds(value: string): number | undefined {
	if (!value)
		return undefined;

	const parts = value.split(':').map(Number);

	if (parts.length === 0 || parts.some(Number.isNaN))
		return undefined;

	return parts.reduce((total, part) => total * 60 + part, 0);
}
