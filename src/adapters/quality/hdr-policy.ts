// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { QualityLevel } from '../../types/tracks';

/**
 * What to do when HDR content meets an SDR screen.
 *
 * The web had `dynamicRange` on QualityLevel and nothing that read it, so an HDR
 * ladder played on an SDR display with nothing consulted and nothing converted —
 * a washed-out picture, and a viewer with good bandwidth gets the WORST one,
 * because adaptation climbs into the HDR rungs on its own.
 *
 * This is the oracle for the native port rather than the other way round: the
 * native trio must match the web, so new behaviour lands here first and the Kotlin
 * and Swift sides conform. Written to mirror `HdrPolicy.kt` decision for decision
 * so the two cannot drift.
 */

/**
 * What a consumer wants when the backend cannot convert and there is no SDR rung.
 *
 * A choice rather than a rule, because both answers are defensible and the library
 * is not the one who has to explain either to a viewer: `play` shows a washed-out
 * picture, `refuse` shows none. Tone-mapping is preferred over both wherever the
 * backend can do it, so this only decides the case where it cannot.
 */
export type HdrOnSdrFallback = 'play' | 'refuse';

export type HdrDecision
/** Nothing to do: an HDR screen, or an item with no HDR in it. */
	= | { kind: 'as-is' }
	/**
	 * Ask the backend to convert HDR to SDR as it decodes.
	 *
	 * Preferred wherever the backend can do it, on every platform that can: it needs
	 * no second rendition on the server and no bandwidth decision, and the picture is
	 * right rather than merely watchable. It costs work per frame, deliberately.
	 */
		| { kind: 'tone-map' }
	/**
	 * Pin adaptation to the best SDR rung the ladder has.
	 *
	 * Ahead of tone-mapping when a rung exists, because a natively-SDR stream is
	 * correct without spending anything per frame.
	 */
		| { kind: 'cap-to'; level: QualityLevel }
	/** No SDR rung, no converter, and the consumer chose to show it anyway. */
		| { kind: 'play-unconverted' }
	/** No SDR rung, no converter, and the consumer chose not to. */
		| { kind: 'refuse' };

function isHdr(level: QualityLevel): boolean {
	return level.dynamicRange === 'hdr';
}

/**
 * The best SDR rung, or null when there is nothing to cap to.
 *
 * Null on an HDR display, and null on a ladder with no HDR in it — a cap that
 * changes nothing still narrows what adaptation may pick if anything about the
 * comparison is subtly wrong, and the safest constraint is the one not applied.
 *
 * Ordered height first then bitrate, the same ordering a quality menu uses.
 * Falling back to the lowest rung would be a worse picture than the display can
 * show, which is the opposite mistake.
 */
export function hdrAbrCeiling(levels: ReadonlyArray<QualityLevel>, displayHdr: boolean): QualityLevel | null {
	if (displayHdr)
		return null;
	if (!levels.some(isHdr))
		return null;

	const sdr = levels.filter(level => !isHdr(level));
	if (sdr.length === 0)
		return null;

	// `height` is optional on the web's QualityLevel — an audio-only rendition has
	// none, and so does a ladder a backend has only half described. Nought sorts it
	// below every real rung rather than above them, which is what an unknown height
	// deserves when the question is "the best picture this screen can show".
	return sdr.reduce((best, level) => {
		const height = level.height ?? 0;
		const bestHeight = best.height ?? 0;

		if (height !== bestHeight)
			return height > bestHeight ? level : best;

		return (level.bitrate ?? 0) > (best.bitrate ?? 0) ? level : best;
	});
}

/** Every rung is HDR and the display is not: there is nothing to cap to. */
export function isHdrUnplayable(levels: ReadonlyArray<QualityLevel>, displayHdr: boolean): boolean {
	return !displayHdr && levels.length > 0 && levels.every(isHdr);
}

/**
 * The decision, cheapest correct answer first.
 *
 * Pure and taking booleans rather than a Screen or a backend, so every branch is
 * provable without a device. The device answers two questions and this answers the
 * rest.
 *
 * `backendCanToneMap` is not a platform constant: the same browser answers
 * differently by codec, by decoder, and by whether hardware decoding is in use.
 */
export function hdrDecision(
	levels: ReadonlyArray<QualityLevel>,
	displayHdr: boolean,
	backendCanToneMap: boolean,
	fallback: HdrOnSdrFallback = 'play',
): HdrDecision {
	if (displayHdr)
		return { kind: 'as-is' };

	const ceiling = hdrAbrCeiling(levels, displayHdr);
	if (ceiling !== null) {
		return {
			kind: 'cap-to',
			level: ceiling,
		};
	}

	// An ordinary SDR item on an SDR screen. An empty ladder lands here too, which
	// is right — a backend that has not enumerated its rungs yet, or a progressive
	// file with no ladder, must not be refused.
	if (!isHdrUnplayable(levels, displayHdr))
		return { kind: 'as-is' };

	if (backendCanToneMap)
		return { kind: 'tone-map' };

	return fallback === 'play' ? { kind: 'play-unconverted' } : { kind: 'refuse' };
}
