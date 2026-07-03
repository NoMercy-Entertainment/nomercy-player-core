// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Perceptual volume curve — shared across all audio and video backends.
 *
 * ## Why a taper instead of linear gain
 *
 * The human ear perceives loudness logarithmically. Mapping the slider's
 * linear 0..1 position directly to a GainNode value (or element.volume)
 * compresses almost all of the audible range into the bottom ~30 % of the
 * slider. A listener drags the slider from 0 to 100 and hears nothing until
 * ~30, then the remaining 70 % of slider travel jumps from "barely audible"
 * to "full volume" in a narrow range at the top.
 *
 * A taper spreads the perceptual loudness change more evenly across slider
 * travel, so an equal slider step sounds roughly as loud everywhere on the
 * slider, not only at the top.
 *
 * ## The mapping chosen
 *
 * A quadratic (square-law) power taper — the standard consumer volume-slider
 * curve used by media players and OS-level volume controls:
 *
 *   gain = position²
 *
 * Key values:
 *   position 0.0 → 0     (exact silence — no floor hack needed)
 *   position 0.1 → 0.01  (−40 dB)
 *   position 0.3 → 0.09  (≈ −20.9 dB)
 *   position 0.5 → 0.25  (≈ −12 dB)
 *   position 0.6 → 0.36  (≈ −8.9 dB)
 *   position 1.0 → 1     (0 dB, unity)
 *
 * This is deliberately NOT the −60 dB…0 dB law used by professional DAW and
 * mixing-console faders. That range suits a fader whose job is fine gain-
 * riding on a mix already at a sensible level — it is the wrong shape for a
 * media player's master volume control, whose job is "how loud is this in
 * the room right now". A −60 dB range crams the entire usable listening
 * range into the top ~40 % of slider travel, leaving everything below that
 * "barely audible". The quadratic taper keeps the lower half of the slider
 * clearly audible while still tapering faster than a linear map, and it
 * passes through exactly (0, 0) and (1, 1) with no artificial silence floor.
 *
 * ## What this function is NOT responsible for
 *
 * The player mixin stores the 0..100 position in `_internalVolume` and
 * returns it directly from `player.volume()` — the slider always sees the
 * position, never a gain value. This function is called only at the point
 * where a backend writes a gain value to `gainNode.gain`, `element.volume`,
 * or a crossfade ramp target.
 *
 * @param position01 - Linear slider position in [0, 1]. Values outside that
 *   range are clamped before the curve is applied.
 * @returns Linear gain amplitude in [0, 1] to write to the Web Audio
 *   GainNode or HTMLMediaElement.volume.
 */
export function perceptualGain(position01: number): number {
	const clamped = Math.max(0, Math.min(1, position01));

	return clamped ** 2;
}
