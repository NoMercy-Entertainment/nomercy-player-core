/**
 * Native stream factory tests — `canPlay` URL/content-type detection only.
 * The `create()` factory produces a NativeStreamSource which depends on a real
 * `<audio>` / `<video>` element + `loadedmetadata` event; that path is best
 * tested via integration / Playwright. Here we lock the URL detection.
 *
 * Test groups:
 *  - id is 'native'
 *  - canPlay accepts standard audio extensions
 *  - canPlay accepts standard video extensions
 *  - canPlay rejects HLS (m3u8) — that's hls factory's job
 *  - canPlay falls through to content-type when extension absent
 *  - canPlay rejects HLS content-type
 */

import { describe, expect, it } from 'vitest';
import { nativeFactory } from '../../streams/native';

describe('nativeFactory', () => {
	describe('id', () => {
		it('is "native"', () => {
			expect(nativeFactory.id).toBe('native');
		});
	});

	describe('canPlay() — audio extensions', () => {
		it('accepts .mp3', () => {
			expect(nativeFactory.canPlay('https://x/track.mp3')).toBe(true);
		});

		it('accepts .flac', () => {
			expect(nativeFactory.canPlay('https://x/track.flac')).toBe(true);
		});

		it('accepts .aac', () => {
			expect(nativeFactory.canPlay('https://x/track.aac')).toBe(true);
		});

		it('accepts .m4a', () => {
			expect(nativeFactory.canPlay('https://x/track.m4a')).toBe(true);
		});

		it('accepts .wav', () => {
			expect(nativeFactory.canPlay('https://x/track.wav')).toBe(true);
		});

		it('accepts .ogg', () => {
			expect(nativeFactory.canPlay('https://x/track.ogg')).toBe(true);
		});

		it('accepts .opus', () => {
			expect(nativeFactory.canPlay('https://x/track.opus')).toBe(true);
		});

		it('accepts .weba', () => {
			expect(nativeFactory.canPlay('https://x/track.weba')).toBe(true);
		});

		it('accepts URL with query string after extension', () => {
			expect(nativeFactory.canPlay('https://x/track.mp3?t=123')).toBe(true);
		});
	});

	describe('canPlay() — video extensions', () => {
		it('accepts .mp4', () => {
			expect(nativeFactory.canPlay('https://x/movie.mp4')).toBe(true);
		});

		it('accepts .webm', () => {
			expect(nativeFactory.canPlay('https://x/movie.webm')).toBe(true);
		});

		it('accepts .mov', () => {
			expect(nativeFactory.canPlay('https://x/movie.mov')).toBe(true);
		});

		it('accepts .m4v', () => {
			expect(nativeFactory.canPlay('https://x/movie.m4v')).toBe(true);
		});

		it('accepts .ogv', () => {
			expect(nativeFactory.canPlay('https://x/movie.ogv')).toBe(true);
		});
	});

	describe('canPlay() — HLS rejection', () => {
		it('rejects .m3u8', () => {
			expect(nativeFactory.canPlay('https://x/stream.m3u8')).toBe(false);
		});

		it('rejects application/vnd.apple.mpegurl content type', () => {
			expect(nativeFactory.canPlay('https://x/stream', 'application/vnd.apple.mpegurl')).toBe(false);
		});

		it('rejects application/x-mpegURL content type', () => {
			expect(nativeFactory.canPlay('https://x/stream', 'application/x-mpegURL')).toBe(false);
		});
	});

	describe('canPlay() — content-type fallback', () => {
		it('accepts audio/* without extension', () => {
			expect(nativeFactory.canPlay('https://x/blob', 'audio/mpeg')).toBe(true);
		});

		it('accepts video/* without extension', () => {
			expect(nativeFactory.canPlay('https://x/blob', 'video/mp4')).toBe(true);
		});
	});

	describe('canPlay() — unknown formats', () => {
		it('rejects URL with unknown extension and no content-type', () => {
			expect(nativeFactory.canPlay('https://x/file.dash')).toBe(false);
		});

		it('rejects empty URL', () => {
			expect(nativeFactory.canPlay('')).toBe(false);
		});
	});
});
