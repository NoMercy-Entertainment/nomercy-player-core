// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * media-tracks dedup + language normalisation tests.
 *
 * `subtitles()` must:
 *   - Prefer sidecar over backend when both cover the same language.
 *   - Treat ISO 639-2/B, 639-2/T and 639-1 variants of the same language as
 *     equal ("ger" = "deu" = "de", "eng" = "en", "fre" = "fra" = "fr", etc.).
 *   - Deduplicate within the sidecar list (first occurrence wins).
 *   - Not drop unrelated tracks.
 *
 * Also tests `normalizeLanguage` directly.
 */

import type { SubtitleTrack } from '../types';
import { describe, expect, it } from 'vitest';

import { mediaTracksMethods, normalizeLanguage } from '../core/mixins/media-tracks';

// ── helpers ────────────────────────────────────────────────────────────────

/** Minimal "Internals" shape that `subtitles()` actually reads. */
function makeInternals(opts: {
	backendTracks?: SubtitleTrack[];
	sidecarTracks?: Array<{
		kind?: string;
		file?: string;
		language?: string;
		label?: string;
	}>;
}): ThisParameterType<typeof mediaTracksMethods.subtitles> {
	return {
		_peekBackendTyped<S extends object>(): S | undefined {
			if (!opts.backendTracks)
				return undefined;
			return {
				subtitleTracks: (): SubtitleTrack[] => opts.backendTracks!,
			} as unknown as S;
		},
		item(): { tracks?: Array<{ kind?: string; file?: string; language?: string; label?: string }> } | undefined {
			if (!opts.sidecarTracks)
				return undefined;
			return { tracks: opts.sidecarTracks };
		},
	} as unknown as ThisParameterType<typeof mediaTracksMethods.subtitles>;
}

function callSubtitles(opts: {
	backendTracks?: SubtitleTrack[];
	sidecarTracks?: Array<{
		kind?: string;
		file?: string;
		language?: string;
		label?: string;
	}>;
}): ReadonlyArray<SubtitleTrack> {
	return mediaTracksMethods.subtitles.call(makeInternals(opts));
}

// ── normalizeLanguage ──────────────────────────────────────────────────────

describe('normalizeLanguage()', () => {
	it('passes ISO 639-1 codes through unchanged', () => {
		expect(normalizeLanguage('de')).toBe('de');
		expect(normalizeLanguage('en')).toBe('en');
		expect(normalizeLanguage('fr')).toBe('fr');
		expect(normalizeLanguage('nl')).toBe('nl');
	});

	it('maps ISO 639-2/B codes to ISO 639-1', () => {
		expect(normalizeLanguage('ger')).toBe('de');
		expect(normalizeLanguage('eng')).toBe('en');
		expect(normalizeLanguage('fre')).toBe('fr');
		expect(normalizeLanguage('dut')).toBe('nl');
	});

	it('maps ISO 639-2/T codes to ISO 639-1', () => {
		expect(normalizeLanguage('deu')).toBe('de');
		expect(normalizeLanguage('fra')).toBe('fr');
		expect(normalizeLanguage('nld')).toBe('nl');
	});

	it('strips BCP-47 region subtag before normalising', () => {
		expect(normalizeLanguage('de-AT')).toBe('de');
		expect(normalizeLanguage('ger-DE')).toBe('de');
		expect(normalizeLanguage('en-US')).toBe('en');
	});

	it('passes through unknown codes unchanged', () => {
		expect(normalizeLanguage('xyz')).toBe('xyz');
	});

	it('returns undefined for undefined input', () => {
		expect(normalizeLanguage(undefined)).toBeUndefined();
	});

	it('returns empty string for empty string input', () => {
		expect(normalizeLanguage('')).toBe('');
	});
});

// ── subtitles() dedup ──────────────────────────────────────────────────────

describe('subtitles() dedup', () => {
	it('returns sidecar tracks when no backend tracks exist', () => {
		const result = callSubtitles({
			sidecarTracks: [
				{ kind: 'subtitles', file: '/eng.vtt', language: 'eng', label: 'English' },
				{ kind: 'subtitles', file: '/ger.vtt', language: 'ger', label: 'German' },
			],
		});

		expect(result).toHaveLength(2);
		expect(result[0]!.label).toBe('English');
		expect(result[1]!.label).toBe('German');
	});

	it('removes backend track when sidecar covers the same language (same code form)', () => {
		const result = callSubtitles({
			backendTracks: [
				{ id: 'b0', language: 'ger', kind: 'subtitles', label: 'German (HLS)', url: '' },
			],
			sidecarTracks: [
				{ kind: 'subtitles', file: '/ger.vtt', language: 'ger', label: 'German (sidecar)' },
			],
		});

		expect(result).toHaveLength(1);
		expect(result[0]!.label).toBe('German (sidecar)');
	});

	it('removes backend track when sidecar uses ISO 639-2/B and backend uses ISO 639-1 — ger vs de', () => {
		const result = callSubtitles({
			backendTracks: [
				{ id: 'b0', language: 'de', kind: 'subtitles', label: 'German (HLS/de)', url: '' },
			],
			sidecarTracks: [
				{ kind: 'subtitles', file: '/ger.vtt', language: 'ger', label: 'German (Full)' },
			],
		});

		expect(result).toHaveLength(1);
		expect(result[0]!.label).toBe('German (Full)');
	});

	it('removes backend track when sidecar uses ISO 639-2/B and backend uses ISO 639-2/T — ger vs deu', () => {
		const result = callSubtitles({
			backendTracks: [
				{ id: 'b0', language: 'deu', kind: 'subtitles', label: 'German (HLS/deu)', url: '' },
			],
			sidecarTracks: [
				{ kind: 'subtitles', file: '/ger.vtt', language: 'ger', label: 'German (Full)' },
			],
		});

		expect(result).toHaveLength(1);
		expect(result[0]!.label).toBe('German (Full)');
	});

	it('keeps both tracks when they are different languages', () => {
		const result = callSubtitles({
			backendTracks: [
				{ id: 'b0', language: 'en', kind: 'subtitles', label: 'English (HLS)', url: '' },
			],
			sidecarTracks: [
				{ kind: 'subtitles', file: '/ger.vtt', language: 'ger', label: 'German (Full)' },
			],
		});

		expect(result).toHaveLength(2);
	});

	it('deduplicates within sidecar list — first occurrence wins', () => {
		const result = callSubtitles({
			sidecarTracks: [
				{ kind: 'subtitles', file: '/ger.vtt', language: 'ger', label: 'German (Full)' },
				{ kind: 'subtitles', file: '/eng.vtt', language: 'eng', label: 'English (Full)' },
				{ kind: 'subtitles', file: '/ger.vtt', language: 'ger', label: 'German (Full)' },
			],
		});

		expect(result).toHaveLength(2);
		expect(result.map(t => t.label)).toEqual(['German (Full)', 'English (Full)']);
	});

	it('regression: sidecar ger + manifest de → one German entry, sidecar wins', () => {
		const result = callSubtitles({
			backendTracks: [
				{ id: 'b0', language: 'de', kind: 'subtitles', label: 'German (manifest)', url: '' },
				{ id: 'b1', language: 'en', kind: 'subtitles', label: 'English (manifest)', url: '' },
			],
			sidecarTracks: [
				{ kind: 'subtitles', file: '/eng.vtt', language: 'eng', label: 'English (Full)' },
				{ kind: 'subtitles', file: '/ger.vtt', language: 'ger', label: 'German (Full)' },
			],
		});

		expect(result).toHaveLength(2);

		const labels = result.map(t => t.label);
		expect(labels).toContain('English (Full)');
		expect(labels).toContain('German (Full)');
		expect(labels).not.toContain('German (manifest)');
		expect(labels).not.toContain('English (manifest)');
	});

	it('regression: same-language variants with distinct files both survive — eng full + eng sign', () => {
		const result = callSubtitles({
			sidecarTracks: [
				{ kind: 'subtitles', file: '/eng.full.ass', language: 'eng', label: 'full' },
				{ kind: 'subtitles', file: '/eng.sign.ass', language: 'eng', label: 'sign' },
			],
		});

		expect(result).toHaveLength(2);
		expect(result.map(t => t.label)).toEqual(['full', 'sign']);
	});

	it('variant sidecars still displace the backend track for that language', () => {
		const result = callSubtitles({
			backendTracks: [
				{ id: 'b0', language: 'en', kind: 'subtitles', label: 'English (manifest)', url: '' },
			],
			sidecarTracks: [
				{ kind: 'subtitles', file: '/eng.full.ass', language: 'eng', label: 'full' },
				{ kind: 'subtitles', file: '/eng.sign.ass', language: 'eng', label: 'sign' },
			],
		});

		expect(result.map(t => t.label)).toEqual(['full', 'sign']);
	});

	it('drops sidecar tracks with no file URL', () => {
		const result = callSubtitles({
			sidecarTracks: [
				{ kind: 'subtitles', file: '/ger.vtt', language: 'ger', label: 'German (Full)' },
				{ kind: 'subtitles', language: 'eng', label: 'English (no file)' },
			],
		});

		expect(result).toHaveLength(1);
		expect(result[0]!.label).toBe('German (Full)');
	});

	it('returns backend tracks when no sidecar item is active', () => {
		const result = callSubtitles({
			backendTracks: [
				{ id: 'b0', language: 'en', kind: 'subtitles', label: 'English (HLS)', url: '' },
			],
		});

		expect(result).toHaveLength(1);
		expect(result[0]!.label).toBe('English (HLS)');
	});
});
