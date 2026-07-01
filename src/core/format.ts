// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Generic, pure, dependency-free formatting and escaping utilities shared
 * across all player packages.
 *
 * Rule: every function here is a pure function — no `this`, no player
 * reference, no DOM dependency.
 */

/**
 * Escape a string for safe insertion into HTML attribute values and text nodes.
 * Replaces `&`, `<`, `>`, `"`, and `'` with their HTML entities.
 *
 * @param str - The raw string to escape.
 */
export function escapeHtml(str: string): string {
	return str.replace(/[&<>"']/g, (char) => {
		const entities: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			'\'': '&#39;',
		};

		return entities[char]!;
	});
}

/**
 * Format a duration in seconds as `M:SS` or `H:MM:SS`.
 *
 * Returns `"0:00"` for negative or non-finite input.
 *
 * @param seconds - Total duration in seconds (non-negative finite number).
 */
export function formatSeconds(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0)
		return '0:00';

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	return hours > 0
		? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
		: `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Clamp a raw volume value to the 0-100 range and round to the nearest integer.
 *
 * Both the slider `value` assignment and the `--vol-pct` CSS custom-property
 * use this formula, so it lives here once rather than being repeated inline.
 *
 * @param value - Raw volume value (kit scale, 0-100).
 */
export function clampVolume(value: number): number {
	return Math.round(Math.max(0, Math.min(100, value)));
}

/**
 * Format a duration value for display in menu labels.
 *
 * Accepts a server-side duration in seconds (number) or a pre-formatted
 * duration string (e.g. `"01:23:45"` from the wire). Strips a leading `"00:"`
 * from string values so `"00:24:14"` renders as `"24:14"`. Returns an empty
 * string for null/undefined/zero/non-finite inputs.
 *
 * `formatSeconds` is the canonical formatter for pure number inputs;
 * `formatDuration` is the display-layer wrapper that also accepts wire-format
 * strings and null/undefined.
 *
 * @param duration - Seconds as a number, a pre-formatted string, or nullish.
 */
export function formatDuration(duration: number | string | undefined): string {
	if (duration == null)
		return '';

	if (typeof duration === 'string')
		return duration.replace(/^00:/u, '');

	if (!Number.isFinite(duration) || duration <= 0)
		return '';

	return formatSeconds(duration);
}
