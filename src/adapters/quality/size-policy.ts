// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { QualityLevel } from '../../types/tracks';

/**
 * What to do when a 4K rung meets a 740px-wide player.
 *
 * Adaptation climbed the ladder on bandwidth alone, so a pane a fifth of the
 * screen wide pulled a 3840-wide rendition and threw most of it away in the
 * scaler — paid for three times over, in bytes, in decode and in battery.
 *
 * `hls.js` ships `capLevelToPlayerSize` for this and it stays off deliberately:
 * `autoLevelCapping` is already written from `hdr-policy`'s ceiling, and two
 * writers to one property is a bug waiting for a resize. The rule lives here so
 * the Kotlin and Swift ports mirror one decision rather than one decision and
 * one library's private heuristic.
 */

/**
 * The smallest rung that still covers the pane, or null when nothing should cap.
 *
 * Smallest rather than largest: a rung above the pane is bytes the scaler
 * discards, and a rung below it upscales into a soft picture, which is the
 * mistake a viewer actually notices.
 *
 * Null on an unmeasured pane, on an empty ladder, and when the covering rung is
 * already the tallest thing on offer — a cap that changes nothing still narrows
 * what adaptation may pick if anything about the comparison is subtly wrong, and
 * the safest constraint is the one not applied. The same reason `hdrAbrCeiling`
 * returns null on a ladder with no HDR in it.
 */
export function sizeAbrCeiling(
	levels: ReadonlyArray<QualityLevel>,
	paneWidthPx: number,
	paneHeightPx: number,
): QualityLevel | null {
	// A pane measured before layout reports zero. Capping on that answer pins the
	// stream to its lowest rung for the whole session, so an unmeasured pane must
	// never cap at all.
	if (paneWidthPx <= 0 || paneHeightPx <= 0)
		return null;
	if (levels.length === 0)
		return null;

	// An undeclared width is not a narrow width. The native ladder carries no
	// widths whatsoever, so testing a missing one against the pane would drop
	// every rung there and land the port on a taller rendition than the web —
	// the divergence the port exists to remove. Height is the mandatory signal;
	// width only narrows the field when a rung actually states it.
	const covering = levels.filter((level) => {
		const heightCovers = (level.height ?? 0) >= paneHeightPx;
		const widthCovers = level.width == null || level.width >= paneWidthPx;
		return heightCovers && widthCovers;
	});
	if (covering.length === 0)
		return null;

	// `height` is optional on the web's QualityLevel — an audio-only rendition has
	// none, and so does a ladder a backend has only half described. Nought sorts it
	// below every real rung, which is what an unknown height deserves when the
	// question is "the least this pane can be fed without going soft".
	const ceiling = covering.reduce((best, level) => {
		const height = level.height ?? 0;
		const bestHeight = best.height ?? 0;

		if (height !== bestHeight)
			return height < bestHeight ? level : best;

		return (level.bitrate ?? 0) < (best.bitrate ?? 0) ? level : best;
	});

	const tallest = levels.reduce((max, level) => Math.max(max, level.height ?? 0), 0);
	if ((ceiling.height ?? 0) >= tallest)
		return null;

	return ceiling;
}

/**
 * The pane in device pixels, which is the unit a rendition is measured in.
 *
 * CSS pixels understate a phone or a HiDPI laptop by two or three times, so a
 * ceiling computed from them caps a retina viewer to a picture visibly softer
 * than the panel can draw. Mirrors `hls.js`'s own `contentScaleFactor`.
 *
 * The port deliberately does NOT do this: a Compose or UIKit surface is already
 * handed its size in real pixels, so a second multiplication there would cap a
 * rung too high.
 */
export function panePixels(
	element: { getBoundingClientRect(): { width: number; height: number } } | null | undefined,
): { widthPx: number; heightPx: number } {
	if (!element) {
		return {
			widthPx: 0,
			heightPx: 0,
		};
	}

	const rect = element.getBoundingClientRect();
	const reported = typeof window === 'undefined' ? undefined : window.devicePixelRatio;
	const scale = typeof reported === 'number' && Number.isFinite(reported) && reported > 0 ? reported : 1;

	return {
		widthPx: Math.round(rect.width * scale),
		heightPx: Math.round(rect.height * scale),
	};
}

/**
 * The more restrictive of the two ceilings.
 *
 * Two independent reasons to cap answer different questions, so neither may
 * overwrite the other: the lower rung satisfies both, the higher one breaks
 * whichever constraint it clears.
 */
export function abrCeiling(hdr: QualityLevel | null, size: QualityLevel | null): QualityLevel | null {
	if (hdr === null)
		return size;
	if (size === null)
		return hdr;

	const hdrHeight = hdr.height ?? 0;
	const sizeHeight = size.height ?? 0;

	if (hdrHeight !== sizeHeight)
		return hdrHeight < sizeHeight ? hdr : size;

	return (hdr.bitrate ?? 0) <= (size.bitrate ?? 0) ? hdr : size;
}
