// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Unit tests for the perceptualGain() volume curve.
 *
 * Verifies:
 *  1. Boundary values — position 0 → 0 gain, position 1 → unity gain.
 *  2. Key curve values — pins the quadratic (position²) taper at the
 *     positions that matter for the "barely audible below 60 %" bug report.
 *  3. Monotonicity — the curve is strictly non-decreasing.
 *  4. Perceptual property — equal slider step near the TOP produces a
 *     LARGER linear-gain delta than the same step near the BOTTOM. This is
 *     the defining characteristic of a power-law taper: the gain axis is
 *     compressed at low slider positions and expanded at high ones.
 *  5. Out-of-range inputs clamp safely.
 *  6. Regression guard — fails if the curve reverts to the old −60 dB
 *     broadcast/mastering law that made everything ≤ 60 % near-inaudible.
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

	it('position 0.1 produces gain 0.01 (−40 dB)', () => {
		expect(perceptualGain(0.1)).toBeCloseTo(0.01, 10);
	});

	it('position 0.3 produces gain 0.09 (≈ −20.9 dB)', () => {
		expect(perceptualGain(0.3)).toBeCloseTo(0.09, 10);
	});

	it('position 0.5 produces gain 0.25 (≈ −12 dB)', () => {
		expect(perceptualGain(0.5)).toBeCloseTo(0.25, 10);
	});

	it('position 0.6 produces gain 0.36 (≈ −8.9 dB) — the reported "barely audible" point', () => {
		expect(perceptualGain(0.6)).toBeCloseTo(0.36, 10);
	});

	it('regression guard: gain(0.5) must stay clearly audible, never fall back to the old −30 dB broadcast-fader value', () => {
		// The old −60 dB…0 dB law put position 0.5 at ≈ 0.0316 (−30 dB) — barely
		// audible, and the root cause of the reported bug. This must never regress.
		expect(perceptualGain(0.5)).toBeGreaterThan(0.1);
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
		// Defining characteristic of a power-law taper (gain = position²): the
		// derivative 2·position grows with position, so the same slider step
		// moves the gain more near the top than near the bottom — proof the
		// curve is not linear.
		const step = 0.05;

		const deltaBottom = perceptualGain(0.10 + step) - perceptualGain(0.10);
		const deltaTop = perceptualGain(0.90 + step) - perceptualGain(0.90);

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
