/**
 * VTT parser tests — `parseVtt` (raw), `parseVttSubtitles` (styled), `parseVttSprite` (preview thumbnails).
 *
 * Test groups:
 *  - Magic header validation
 *  - Empty / malformed input
 *  - Timestamp variants (mm:ss.xxx vs HH:MM:SS.xxx)
 *  - Cue id lines (optional, ignored)
 *  - Multi-line cue payloads
 *  - NOTE / STYLE / REGION blocks (skipped)
 *  - parseVttSubtitles: tag stripping + style detection
 *  - parseVttSprite: #xywh fragment parsing + baseUrl resolution
 *  - Line ending tolerance
 */

import { describe, expect, it } from 'vitest';
import { parseVtt, parseVttSprite, parseVttSubtitles } from '../../cues/parsers/vtt';

describe('parseVtt() — raw VTT', () => {
	describe('magic header validation (W3C WebVTT 1.0 §4)', () => {
		it('returns empty when first block lacks WEBVTT', () => {
			const list = parseVtt('00:00.000 --> 00:05.000\nHello');
			expect(list.cues).toEqual([]);
		});

		it('parses cues when first block has bare WEBVTT magic', () => {
			const list = parseVtt('WEBVTT\n\n00:00.000 --> 00:05.000\nHello');
			expect(list.cues).toHaveLength(1);
		});

		it('returns empty on empty string', () => {
			expect(parseVtt('').cues).toEqual([]);
		});

		it('accepts "WEBVTT - English subtitles" (space + comment header)', () => {
			const list = parseVtt('WEBVTT - English subtitles\n\n00:00.000 --> 00:05.000\nHello');
			expect(list.cues).toHaveLength(1);
		});

		it('accepts "WEBVTT\\tcomment" (tab + comment header)', () => {
			const list = parseVtt('WEBVTT\tnote\n\n00:00.000 --> 00:05.000\nHello');
			expect(list.cues).toHaveLength(1);
		});

		it('rejects "WEBVTTfoo" — magic must be followed by whitespace or EOF (spec §4)', () => {
			const list = parseVtt('WEBVTTfoo\n\n00:00.000 --> 00:05.000\nHello');
			expect(list.cues).toEqual([]);
		});

		it('strips UTF-8 BOM (U+FEFF) at start of file', () => {
			const list = parseVtt('﻿WEBVTT\n\n00:00.000 --> 00:05.000\nHello');
			expect(list.cues).toHaveLength(1);
			expect(list.cues[0]!.payload).toBe('Hello');
		});

		it('strips BOM and accepts "WEBVTT - description" together', () => {
			const list = parseVtt('﻿WEBVTT - subtitles\n\n00:00.000 --> 00:05.000\nHello');
			expect(list.cues).toHaveLength(1);
		});
	});

	describe('cue settings (spec §4 — settings appear after end timestamp)', () => {
		it('strips cue settings from cue body', () => {
			const list = parseVtt('WEBVTT\n\n00:00.000 --> 00:05.000 line:0 align:start\nHello');
			expect(list.cues).toHaveLength(1);
			expect(list.cues[0]!.payload).toBe('Hello');
		});

		it('handles position + size + region settings', () => {
			const list = parseVtt('WEBVTT\n\n00:00.000 --> 00:05.000 position:50% size:75% region:r1\nHello');
			expect(list.cues[0]!.payload).toBe('Hello');
		});

		it('handles vertical settings (vertical:rl, vertical:lr)', () => {
			const list = parseVtt('WEBVTT\n\n00:00.000 --> 00:05.000 vertical:rl\nJapanese text');
			expect(list.cues[0]!.payload).toBe('Japanese text');
		});
	});

	describe('timestamp formats', () => {
		it('parses mm:ss.xxx', () => {
			const list = parseVtt('WEBVTT\n\n00:10.500 --> 00:15.000\nHello');
			expect(list.cues[0]!.start).toBeCloseTo(10.5);
			expect(list.cues[0]!.end).toBeCloseTo(15);
		});

		it('parses HH:MM:SS.xxx', () => {
			const list = parseVtt('WEBVTT\n\n01:00:00.000 --> 01:00:30.000\nHello');
			expect(list.cues[0]!.start).toBe(3600);
			expect(list.cues[0]!.end).toBe(3630);
		});

		it('parses cue without milliseconds (mm:ss)', () => {
			const list = parseVtt('WEBVTT\n\n00:10 --> 00:15\nHello');
			expect(list.cues[0]!.start).toBe(10);
			expect(list.cues[0]!.end).toBe(15);
		});
	});

	describe('cue id lines', () => {
		it('accepts optional cue id before timestamp', () => {
			const list = parseVtt('WEBVTT\n\nmy-cue-1\n00:00.000 --> 00:05.000\nHello');
			expect(list.cues).toHaveLength(1);
			expect(list.cues[0]!.payload).toBe('Hello');
		});
	});

	describe('multi-line cue payloads', () => {
		it('joins multi-line cue body with newlines', () => {
			const list = parseVtt('WEBVTT\n\n00:00.000 --> 00:05.000\nLine 1\nLine 2');
			expect(list.cues[0]!.payload).toBe('Line 1\nLine 2');
		});
	});

	describe('NOTE / STYLE / REGION blocks', () => {
		it('skips NOTE block', () => {
			const list = parseVtt('WEBVTT\n\nNOTE This is a comment\n\n00:00.000 --> 00:05.000\nHello');
			expect(list.cues).toHaveLength(1);
		});

		it('skips STYLE block', () => {
			const list = parseVtt('WEBVTT\n\nSTYLE\n::cue { color: red }\n\n00:00.000 --> 00:05.000\nHello');
			expect(list.cues).toHaveLength(1);
		});

		it('skips REGION block', () => {
			const list = parseVtt('WEBVTT\n\nREGION\nid:r1\n\n00:00.000 --> 00:05.000\nHello');
			expect(list.cues).toHaveLength(1);
		});
	});

	describe('multi-cue files', () => {
		it('parses multiple cues separated by blank lines', () => {
			const list = parseVtt('WEBVTT\n\n00:00.000 --> 00:05.000\nA\n\n00:05.000 --> 00:10.000\nB');
			expect(list.cues).toHaveLength(2);
		});
	});

	describe('line endings', () => {
		it('handles CRLF', () => {
			const list = parseVtt('WEBVTT\r\n\r\n00:00.000 --> 00:05.000\r\nHello');
			expect(list.cues).toHaveLength(1);
		});

		it('handles bare CR', () => {
			const list = parseVtt('WEBVTT\r\r00:00.000 --> 00:05.000\rHello');
			expect(list.cues).toHaveLength(1);
		});
	});
});

describe('parseVttSubtitles() — styled', () => {
	it('strips inline tags from text', () => {
		const list = parseVttSubtitles('WEBVTT\n\n00:00.000 --> 00:05.000\n<b>Bold</b> and <i>italic</i>');
		expect(list.cues[0]!.payload.text).toBe('Bold and italic');
	});

	it('detects bold style', () => {
		const list = parseVttSubtitles('WEBVTT\n\n00:00.000 --> 00:05.000\n<b>Bold</b>');
		expect(list.cues[0]!.payload.styles?.bold).toBe(true);
	});

	it('detects italic style', () => {
		const list = parseVttSubtitles('WEBVTT\n\n00:00.000 --> 00:05.000\n<i>Italic</i>');
		expect(list.cues[0]!.payload.styles?.italic).toBe(true);
	});

	it('extracts color class', () => {
		const list = parseVttSubtitles('WEBVTT\n\n00:00.000 --> 00:05.000\n<c.red>Red</c>');
		expect(list.cues[0]!.payload.styles?.color).toBe('red');
	});

	it('omits styles object when no styling tags present', () => {
		const list = parseVttSubtitles('WEBVTT\n\n00:00.000 --> 00:05.000\nPlain text');
		expect(list.cues[0]!.payload.styles).toBeUndefined();
	});

	it('combines multiple styles', () => {
		const list = parseVttSubtitles('WEBVTT\n\n00:00.000 --> 00:05.000\n<b><i>Bold italic</i></b>');
		expect(list.cues[0]!.payload.styles?.bold).toBe(true);
		expect(list.cues[0]!.payload.styles?.italic).toBe(true);
	});

	describe('markup field — preserves renderer-safe inline tags', () => {
		it('preserves <i>, <b>, <u> with arbitrary nesting', () => {
			const list = parseVttSubtitles(
				'WEBVTT\n\n00:00.000 --> 00:05.000\n<b>Bold</b> <i>and italic</i> <u>under</u>',
			);
			expect(list.cues[0]!.payload.markup).toBe(
				'<b>Bold</b> <i>and italic</i> <u>under</u>',
			);
		});

		it('strips <c.classname> while keeping <i>/<b>/<u>', () => {
			const list = parseVttSubtitles(
				'WEBVTT\n\n00:00.000 --> 00:05.000\n<c.red>Red <b>bold</b></c>',
			);
			expect(list.cues[0]!.payload.markup).toBe('Red <b>bold</b>');
		});

		it('strips <v Speaker> tags', () => {
			const list = parseVttSubtitles(
				'WEBVTT\n\n00:00.000 --> 00:05.000\n<v John>Hello world</v>',
			);
			expect(list.cues[0]!.payload.markup).toBe('Hello world');
		});

		it('strips inline timestamp tags', () => {
			const list = parseVttSubtitles(
				'WEBVTT\n\n00:00.000 --> 00:05.000\nWord<00:00:01.000>by<00:00:02.000>word',
			);
			expect(list.cues[0]!.payload.markup).toBe('Wordbyword');
		});
	});

	describe('cue settings — line / align / size on timing line', () => {
		it('parses align:start', () => {
			const list = parseVttSubtitles(
				'WEBVTT\n\n00:00.000 --> 00:05.000 align:start\nLeft',
			);
			expect(list.cues[0]!.payload.alignment).toBe('start');
		});

		it('parses align:end', () => {
			const list = parseVttSubtitles(
				'WEBVTT\n\n00:00.000 --> 00:05.000 align:end\nRight',
			);
			expect(list.cues[0]!.payload.alignment).toBe('end');
		});

		it('normalises legacy align:middle to center', () => {
			const list = parseVttSubtitles(
				'WEBVTT\n\n00:00.000 --> 00:05.000 align:middle\nMid',
			);
			expect(list.cues[0]!.payload.alignment).toBe('center');
		});

		it('normalises align:left to start and align:right to end', () => {
			const list = parseVttSubtitles(
				'WEBVTT\n\n00:00.000 --> 00:05.000 align:left\nA\n\n00:10.000 --> 00:15.000 align:right\nB',
			);
			expect(list.cues[0]!.payload.alignment).toBe('start');
			expect(list.cues[1]!.payload.alignment).toBe('end');
		});

		it('parses line:50% as percentage', () => {
			const list = parseVttSubtitles(
				'WEBVTT\n\n00:00.000 --> 00:05.000 line:50%\nMiddle',
			);
			expect(list.cues[0]!.payload.linePosition).toBe(50);
		});

		it('parses line without trailing percent', () => {
			const list = parseVttSubtitles(
				'WEBVTT\n\n00:00.000 --> 00:05.000 line:75\nQuarter',
			);
			expect(list.cues[0]!.payload.linePosition).toBe(75);
		});

		it('parses size:50%', () => {
			const list = parseVttSubtitles(
				'WEBVTT\n\n00:00.000 --> 00:05.000 size:50%\nHalf',
			);
			expect(list.cues[0]!.payload.size).toBe(50);
		});

		it('parses combined align + line + size', () => {
			const list = parseVttSubtitles(
				'WEBVTT\n\n00:00.000 --> 00:05.000 align:start line:0% size:25%\nCombo',
			);
			const cue = list.cues[0]!.payload;
			expect(cue.alignment).toBe('start');
			expect(cue.linePosition).toBe(0);
			expect(cue.size).toBe(25);
		});

		it('omits cue-setting fields when no settings present', () => {
			const list = parseVttSubtitles('WEBVTT\n\n00:00.000 --> 00:05.000\nPlain');
			const cue = list.cues[0]!.payload;
			expect(cue.alignment).toBeUndefined();
			expect(cue.linePosition).toBeUndefined();
			expect(cue.size).toBeUndefined();
		});

		it('drops out-of-range numeric settings silently', () => {
			const list = parseVttSubtitles(
				'WEBVTT\n\n00:00.000 --> 00:05.000 line:200% size:-10%\nOOR',
			);
			const cue = list.cues[0]!.payload;
			expect(cue.linePosition).toBeUndefined();
			expect(cue.size).toBeUndefined();
		});
	});
});

describe('parseVttSprite() — preview thumbnails', () => {
	it('parses cue body as URL with #xywh fragment', () => {
		const list = parseVttSprite('WEBVTT\n\n00:00.000 --> 00:10.000\nthumbs.jpg#xywh=0,0,160,90');
		expect(list.cues).toHaveLength(1);
		expect(list.cues[0]!.payload).toEqual({
			url: 'thumbs.jpg',
			x: 0,
			y: 0,
			w: 160,
			h: 90,
		});
	});

	it('parses non-zero offsets', () => {
		const list = parseVttSprite('WEBVTT\n\n00:00.000 --> 00:10.000\nthumbs.jpg#xywh=160,90,160,90');
		expect(list.cues[0]!.payload).toEqual({
			url: 'thumbs.jpg',
			x: 160,
			y: 90,
			w: 160,
			h: 90,
		});
	});

	it('skips cues without #xywh fragment', () => {
		const list = parseVttSprite('WEBVTT\n\n00:00.000 --> 00:10.000\nthumbs.jpg');
		expect(list.cues).toHaveLength(0);
	});

	it('resolves absolute URLs as-is', () => {
		const list = parseVttSprite('WEBVTT\n\n00:00.000 --> 00:10.000\nhttps://cdn.example.com/thumbs.jpg#xywh=0,0,160,90', 'https://otherbase.com/path/');
		expect(list.cues[0]!.payload.url).toBe('https://cdn.example.com/thumbs.jpg');
	});

	it('joins relative URL with baseUrl', () => {
		const list = parseVttSprite('WEBVTT\n\n00:00.000 --> 00:10.000\nthumbs.jpg#xywh=0,0,160,90', 'https://cdn.example.com/path/');
		expect(list.cues[0]!.payload.url).toBe('https://cdn.example.com/path/thumbs.jpg');
	});

	it('joins absolute-rooted URL with baseUrl origin', () => {
		const list = parseVttSprite('WEBVTT\n\n00:00.000 --> 00:10.000\n/thumbs.jpg#xywh=0,0,160,90', 'https://cdn.example.com/path/');
		expect(list.cues[0]!.payload.url).toBe('https://cdn.example.com/thumbs.jpg');
	});

	it('parses negative offsets', () => {
		const list = parseVttSprite('WEBVTT\n\n00:00.000 --> 00:10.000\nthumbs.jpg#xywh=-10,-20,100,50');
		expect(list.cues[0]!.payload.x).toBe(-10);
		expect(list.cues[0]!.payload.y).toBe(-20);
	});
});
