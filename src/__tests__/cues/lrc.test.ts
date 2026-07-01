// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * LRC parser tests — covers plain LRC, enhanced (word-level) LRC, multi-
 * timestamp lines, metadata tag rejection, malformed inputs.
 *
 * Test groups:
 *  - Empty / malformed inputs
 *  - Plain timestamps + line text
 *  - Multi-timestamp lines (chorus repeats)
 *  - Metadata tags ([ar:Artist], [ti:Title], [length:m:s]) — ignored
 *  - Word-level timestamps (enhanced LRC)
 *  - Cue end-times derived from next cue's start
 *  - Last cue gets default trailing duration
 *  - Mixed line endings (CRLF, CR, LF)
 *  - Sort by start
 */

import { describe, expect, it } from 'vitest';
import { parseLrc } from '../../adapters/cue-parser/lrc';

describe('parseLrc()', () => {
	describe('empty / malformed input', () => {
		it('returns empty cue list on empty string', () => {
			const list = parseLrc('');
			expect(list.cues).toEqual([]);
		});

		it('returns empty cue list on whitespace-only', () => {
			const list = parseLrc('   \n  \n  ');
			expect(list.cues).toEqual([]);
		});

		it('returns empty cue list when no timestamps present', () => {
			const list = parseLrc('just some plain text\nno timestamps here');
			expect(list.cues).toEqual([]);
		});

		it('skips lines with text but no leading timestamp', () => {
			const list = parseLrc('plain line\n[00:10.00]has timestamp');
			expect(list.cues).toHaveLength(1);
			expect(list.cues[0]!.payload.text).toBe('has timestamp');
		});
	});

	describe('plain LRC', () => {
		it('parses single line with mm:ss.xx', () => {
			const list = parseLrc('[00:10.50]Hello world');
			expect(list.cues).toHaveLength(1);
			expect(list.cues[0]!.start).toBeCloseTo(10.5);
			expect(list.cues[0]!.payload.text).toBe('Hello world');
		});

		it('parses mm:ss without fractional seconds', () => {
			const list = parseLrc('[00:10]Plain');
			expect(list.cues[0]!.start).toBe(10);
		});

		it('parses mm:ss.xxx with milliseconds', () => {
			const list = parseLrc('[00:10.500]With ms');
			expect(list.cues[0]!.start).toBeCloseTo(10.5);
		});

		it('parses multi-line LRC', () => {
			const list = parseLrc('[00:00.00]First\n[00:10.00]Second\n[00:20.00]Third');
			expect(list.cues).toHaveLength(3);
			expect(list.cues.map(cue => cue.payload.text)).toEqual(['First', 'Second', 'Third']);
		});

		it('handles minutes > 60', () => {
			const list = parseLrc('[120:30.00]Past two hours');
			expect(list.cues[0]!.start).toBe(120 * 60 + 30);
		});

		it('cue end is derived from next cue start', () => {
			const list = parseLrc('[00:00.00]A\n[00:10.00]B\n[00:25.00]C');
			expect(list.cues[0]!.end).toBeCloseTo(10);
			expect(list.cues[1]!.end).toBeCloseTo(25);
		});

		it('last cue gets default trailing duration', () => {
			const list = parseLrc('[00:00.00]Only');
			expect(list.cues[0]!.end).toBeGreaterThan(0);
			expect(list.cues[0]!.end).toBeCloseTo(5);
		});
	});

	describe('multi-timestamp lines (chorus repeat)', () => {
		it('emits one cue per leading timestamp', () => {
			const list = parseLrc('[00:10.00][00:30.00][00:50.00]Chorus');
			expect(list.cues).toHaveLength(3);
			expect(list.cues.map(cue => cue.payload.text)).toEqual(['Chorus', 'Chorus', 'Chorus']);
		});

		it('sorts emitted cues by start', () => {
			const list = parseLrc('[00:30.00][00:10.00]Out of order');
			expect(list.cues[0]!.start).toBeCloseTo(10);
			expect(list.cues[1]!.start).toBeCloseTo(30);
		});
	});

	describe('metadata tags', () => {
		it('skips [ar:Artist]', () => {
			const list = parseLrc('[ar:Some Artist]\n[00:10.00]Lyric');
			expect(list.cues).toHaveLength(1);
			expect(list.cues[0]!.payload.text).toBe('Lyric');
		});

		it('skips [ti:Title]', () => {
			const list = parseLrc('[ti:Title]\n[00:10.00]Lyric');
			expect(list.cues).toHaveLength(1);
		});

		it('skips [al:Album]', () => {
			const list = parseLrc('[al:Album]\n[00:10.00]Lyric');
			expect(list.cues).toHaveLength(1);
		});

		it('skips [length:mm:ss]', () => {
			const list = parseLrc('[length:03:45]\n[00:10.00]Lyric');
			expect(list.cues).toHaveLength(1);
		});

		it('parses LRC with mixed metadata + cues', () => {
			const list = parseLrc(`[ar:Test]
[ti:Sample]
[00:00.00]First
[00:10.00]Second`);
			expect(list.cues).toHaveLength(2);
		});
	});

	describe('enhanced LRC (word-level)', () => {
		it('parses word-level timestamps', () => {
			const list = parseLrc('[00:10.00]<00:10.00>Hello <00:10.50>world');
			expect(list.cues[0]!.payload.words).toBeDefined();
			expect(list.cues[0]!.payload.words!.length).toBe(2);
		});

		it('extracts plain text alongside word data', () => {
			const list = parseLrc('[00:10.00]<00:10.00>Hello <00:10.50>world');
			expect(list.cues[0]!.payload.text).toContain('Hello');
			expect(list.cues[0]!.payload.text).toContain('world');
		});

		it('plain text only when no word timestamps', () => {
			const list = parseLrc('[00:10.00]Just plain text');
			expect(list.cues[0]!.payload.words).toBeUndefined();
			expect(list.cues[0]!.payload.text).toBe('Just plain text');
		});
	});

	describe('line endings', () => {
		it('handles LF', () => {
			const list = parseLrc('[00:00.00]A\n[00:10.00]B');
			expect(list.cues).toHaveLength(2);
		});

		it('handles CRLF', () => {
			const list = parseLrc('[00:00.00]A\r\n[00:10.00]B');
			expect(list.cues).toHaveLength(2);
		});

		it('handles bare CR', () => {
			const list = parseLrc('[00:00.00]A\r[00:10.00]B');
			expect(list.cues).toHaveLength(2);
		});
	});

	describe('CueList active() integration', () => {
		it('returns the cue active at the given time', () => {
			const list = parseLrc('[00:00.00]A\n[00:10.00]B\n[00:20.00]C');
			const active = list.active(15);
			expect(active.length).toBe(1);
			expect(active[0]!.payload.text).toBe('B');
		});

		it('returns no cues before any cue starts', () => {
			const list = parseLrc('[00:10.00]A');
			expect(list.active(5)).toEqual([]);
		});
	});
});
