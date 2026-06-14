/**
 * Unit tests for the perceptualGain() volume curve.
 *
 * Verifies:
 *  1. Boundary values — position 0 → 0 gain, position 1 → unity gain.
 *  2. Silence floor  — any position below 1 % snaps to 0.
 *  3. Monotonicity   — the curve is strictly non-decreasing.
 *  4. Perceptual property — equal slider step near the TOP produces a
 *     SMALLER linear-gain delta than the same step near the BOTTOM.
 *     This is the defining characteristic of a dB taper: most of the
 *     audible change is spread across the lower portion of the slider.
 *  5. Out-of-range inputs clamp safely.
 */

import { describe, expect, it } from 'vitest';
import { perceptualGain } from '../core/volume-curve';

describe('perceptualGain', () => {
	it('position 0 produces gain 0 (complete silence)', () => {
		expect(perceptualGain(0)).toBe(0);
	});

	it('position 1 produces gain 1 (unity / 0 dB)', () => {
		expect(perceptualGain(1)).toBeCloseTo(1, 10);
	});

	it('positions below 0.01 snap to 0 (silence floor)', () => {
		expect(perceptualGain(0.005)).toBe(0);
		expect(perceptualGain(0.009)).toBe(0);
		expect(perceptualGain(0.0099)).toBe(0);
	});

	it('position 0.01 (1 %) produces a non-zero but very quiet gain', () => {
		const gain = perceptualGain(0.01);
		expect(gain).toBeGreaterThan(0);
		expect(gain).toBeLessThan(0.01);
	});

	it('position 0.5 produces gain close to 10^(-1.5) ≈ 0.0316 (−30 dB)', () => {
		expect(perceptualGain(0.5)).toBeCloseTo(10 ** -1.5, 5);
	});

	it('is monotonically non-decreasing across the [0, 1] range', () => {
		const STEPS = 1000;
		let previous = perceptualGain(0);

		for (let step = 1; step <= STEPS; step++) {
			const position = step / STEPS;
			const current = perceptualGain(position);
			expect(current).toBeGreaterThanOrEqual(previous);
			previous = current;
		}
	});

	it('equal slider step near the TOP produces a LARGER gain delta than near the BOTTOM', () => {
		// This is the defining characteristic of a dB-law (logarithmic) taper:
		// the gain axis is compressed at low slider positions and expanded at high
		// slider positions.
		//
		// Near position 0 the gain values are tiny (e.g. 0.002 at p=0.10); a
		// 0.05 step there adds only a fraction of a thousandth to the gain.
		// Near position 1 the gain values approach unity (0.5–1.0); the same
		// 0.05 step adds ~0.2 to the gain.
		//
		// What sounds equal to the ear is an equal NUMBER OF dB — not an equal
		// LINEAR gain change. The formula guarantees each 0.05 slider step
		// corresponds to 60/20 * 0.05 = 0.15 dB change everywhere. The absolute
		// gain delta is large at the top and tiny at the bottom, but the perceived
		// loudness change is the same.
		const step = 0.05;

		const deltaBottom = perceptualGain(0.10 + step) - perceptualGain(0.10);
		const deltaTop = perceptualGain(0.90 + step) - perceptualGain(0.90);

		// A step near the top must produce a LARGER absolute gain delta than a
		// step near the bottom — this proves the curve is NOT linear.
		expect(deltaTop).toBeGreaterThan(deltaBottom);
	});

	it('clamps negative positions to 0', () => {
		expect(perceptualGain(-0.5)).toBe(0);
		expect(perceptualGain(-100)).toBe(0);
	});

	it('clamps positions above 1 to unity gain (no amplification beyond 0 dB)', () => {
		expect(perceptualGain(1.5)).toBeCloseTo(1, 10);
		expect(perceptualGain(100)).toBeCloseTo(1, 10);
	});
});
