/**
 * Perceptual volume curve — shared across all audio and video backends.
 *
 * ## Why a dB taper instead of linear gain
 *
 * The human ear perceives loudness logarithmically. Mapping the slider's
 * linear 0..1 position directly to a GainNode value (or element.volume)
 * compresses almost all of the audible range into the bottom ~30 % of the
 * slider. A listener drags the slider from 0 to 100 and hears nothing until
 * ~30, then the remaining 70 % of slider travel jumps from "barely audible"
 * to "full volume" in a narrow range at the top.
 *
 * A dB taper spreads the perceptual loudness change evenly across the entire
 * slider travel. Each equal increment of the slider position produces an
 * equal-sounding increment to the ear.
 *
 * ## The mapping chosen
 *
 * Standard −60 dB…0 dB broadcast/mastering law:
 *
 *   gain = 10^((position − 1) × 60 / 20)
 *        = 10^(3 × (position − 1))
 *
 * Key values:
 *   position 0.00 → silence (hard floor, below 1 % snaps to 0)
 *   position 0.01 → 10^(3 × −0.99) ≈ 10^(−2.97) ≈ 0.00107  (≈ −59.4 dB)
 *   position 0.50 → 10^(3 × −0.50) = 10^(−1.5)  ≈ 0.0316   (−30 dB)
 *   position 1.00 → 10^(0)          = 1.0         (0 dB, unity)
 *
 * The floor at 1 % (position < 0.01 → 0) prevents the tail of the
 * exponential curve from producing near-zero but still audible gain values
 * — below 1 % the slider is effectively silent.
 *
 * This is the same law used in every major professional DAW and hardware
 * console that implements a "dB-law" taper on its faders.
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

	if (clamped < 0.01) {
		return 0;
	}

	return 10 ** (3 * (clamped - 1));
}
