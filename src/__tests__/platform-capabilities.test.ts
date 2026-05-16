/**
 * browserCapabilitiesProbe.supportedCodecs() tests.
 *
 * happy-dom (used in vitest config) exposes a minimal MediaSource stub.
 * The test verifies structural correctness (array, strings) rather than
 * specific codec support which varies by browser build.
 */

import { describe, expect, it } from 'vitest';
import { browserPlatform } from '../adapters/platform/browser';

describe('browserCapabilitiesProbe.supportedCodecs()', () => {
	it('returns an array', () => {
		const result = browserPlatform.capabilities.supportedCodecs?.();
		expect(Array.isArray(result)).toBe(true);
	});

	it('every entry in the returned list is a non-empty string', () => {
		const result = browserPlatform.capabilities.supportedCodecs?.() ?? [];
		for (const codec of result) {
			expect(typeof codec).toBe('string');
			expect(codec.length).toBeGreaterThan(0);
		}
	});

	it('result is a subset of the probed codec set (no unknown entries)', () => {
		// Verifies the implementation only returns codecs from the known probe
		// set — not fabricated strings.
		const knownPrefixes = ['video/mp4', 'video/webm', 'audio/mp4', 'audio/webm', 'audio/flac'];
		const result = browserPlatform.capabilities.supportedCodecs?.() ?? [];
		for (const codec of result) {
			const known = knownPrefixes.some(prefix => codec.startsWith(prefix));
			expect(known, `unexpected codec: ${codec}`).toBe(true);
		}
	});
});
