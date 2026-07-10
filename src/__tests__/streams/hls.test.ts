// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * HLS stream factory tests — URL/content-type detection. Full attach behavior
 * (hls.js MediaAttached, native HLS path) requires a real media element and is
 * tested via Playwright; here we lock the static `canPlay` matrix.
 */

import { describe, expect, it } from 'vitest';
import { hlsFactory } from '../../adapters/stream/hls';

describe('hlsFactory', () => {
	describe('id', () => {
		it('is "hls"', () => {
			expect(hlsFactory.id).toBe('hls');
		});
	});

	describe('canPlay() — URL extension', () => {
		it('accepts .m3u8', () => {
			expect(hlsFactory.canPlay('https://x/stream.m3u8')).toBe(true);
		});

		it('accepts .m3u8 with query string', () => {
			expect(hlsFactory.canPlay('https://x/stream.m3u8?token=abc')).toBe(true);
		});

		it('accepts .m3u8 with a #fragment (parity with native/audio-video extension matching)', () => {
			expect(hlsFactory.canPlay('https://x/stream.m3u8#t=10')).toBe(true);
		});

		it('rejects .mp3', () => {
			expect(hlsFactory.canPlay('https://x/track.mp3')).toBe(false);
		});

		it('rejects .mp4', () => {
			expect(hlsFactory.canPlay('https://x/movie.mp4')).toBe(false);
		});
	});

	describe('canPlay() — content-type (RFC 8216 + IANA registrations)', () => {
		it('accepts application/vnd.apple.mpegurl (canonical IANA)', () => {
			expect(hlsFactory.canPlay('https://x/stream', 'application/vnd.apple.mpegurl')).toBe(true);
		});

		it('accepts application/x-mpegurl (legacy alias)', () => {
			expect(hlsFactory.canPlay('https://x/stream', 'application/x-mpegurl')).toBe(true);
		});

		it('accepts application/x-mpegURL (mixed case)', () => {
			expect(hlsFactory.canPlay('https://x/stream', 'application/x-mpegURL')).toBe(true);
		});

		it('accepts audio/mpegurl (RFC 8216 audio variant)', () => {
			expect(hlsFactory.canPlay('https://x/stream', 'audio/mpegurl')).toBe(true);
		});

		it('accepts audio/x-mpegurl (legacy audio variant)', () => {
			expect(hlsFactory.canPlay('https://x/stream', 'audio/x-mpegurl')).toBe(true);
		});

		it('rejects audio/mpeg (different format — MP3, not HLS)', () => {
			expect(hlsFactory.canPlay('https://x/stream', 'audio/mpeg')).toBe(false);
		});

		it('rejects video/mp4', () => {
			expect(hlsFactory.canPlay('https://x/stream', 'video/mp4')).toBe(false);
		});

		it('accepts application/vnd.apple.mpegurl with a charset parameter', () => {
			expect(hlsFactory.canPlay('https://media.example.com/manifest?token=abc', 'application/vnd.apple.mpegurl; charset=utf-8')).toBe(true);
		});
	});

	describe('canPlay() — without extension or content-type', () => {
		it('rejects URL with unknown shape', () => {
			expect(hlsFactory.canPlay('https://x/blob')).toBe(false);
		});
	});
});
