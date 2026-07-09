// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Default clock and id-generator adapters.
 *
 * Test groups:
 *  - systemClock — Date.now() delegation, non-decreasing sequential reads
 *  - defaultIdGenerator — UUID shape, uniqueness, non-crypto fallback shape
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { systemClock } from '../adapters/clock/system';
import { defaultIdGenerator } from '../adapters/id-generator/default';

describe('systemClock', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns a finite epoch-milliseconds number', () => {
		const now = systemClock.now();
		expect(Number.isFinite(now)).toBe(true);
		expect(now).toBeGreaterThan(0);
	});

	it('delegates to Date.now()', () => {
		vi.spyOn(Date, 'now').mockReturnValue(1_234_567);
		expect(systemClock.now()).toBe(1_234_567);
	});

	it('never goes backwards across sequential reads', () => {
		let previous = systemClock.now();
		for (let iteration = 0; iteration < 200; iteration++) {
			const current = systemClock.now();
			expect(current).toBeGreaterThanOrEqual(previous);
			previous = current;
		}
	});
});

describe('defaultIdGenerator', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('produces UUID-shaped ids when crypto.randomUUID is available', () => {
		const id = defaultIdGenerator.next();
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);
	});

	it('produces unique ids across many calls', () => {
		const seen = new Set<string>();
		for (let iteration = 0; iteration < 1000; iteration++) {
			seen.add(defaultIdGenerator.next());
		}
		expect(seen.size).toBe(1000);
	});

	it('falls back to a timestamp-random shape when crypto.randomUUID is absent', () => {
		vi.stubGlobal('crypto', {});
		const id = defaultIdGenerator.next();
		expect(id).toMatch(/^[0-9a-z]+-[0-9a-z]+$/u);
	});

	it('fallback ids are still unique across calls', () => {
		vi.stubGlobal('crypto', {});
		const seen = new Set<string>();
		for (let iteration = 0; iteration < 100; iteration++) {
			seen.add(defaultIdGenerator.next());
		}
		expect(seen.size).toBe(100);
	});
});
