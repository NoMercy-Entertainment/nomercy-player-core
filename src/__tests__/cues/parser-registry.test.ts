// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * CueParserRegistry tests — same shape as StreamRegistry; mirror semantics.
 */

import type { ICueParser } from '../../adapters/cue-parser/ICueParser';
import type { CueList } from '../../core/cues/cue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CueParserRegistry } from '../../adapters/cue-parser/registry';

function makeParser(id: string, canParseResult: boolean = true): ICueParser {
	return {
		id,
		canParse: () => canParseResult,
		parse: () => ({ cues: [] } as unknown as CueList),
	};
}

describe('CueParserRegistry', () => {
	let registry: CueParserRegistry;

	beforeEach(() => {
		registry = new CueParserRegistry();
	});

	afterEach(() => {
		registry.dispose();
	});

	describe('register()', () => {
		it('adds a parser to the list', () => {
			registry.register(makeParser('lrc'));
			expect(registry.findById('lrc')).toBeDefined();
		});

		it('replaces a parser with the same id', () => {
			const parserA = makeParser('vtt');
			const parserB = makeParser('vtt');
			registry.register(parserA);
			registry.register(parserB);
			expect(registry.findById('vtt')).toBe(parserB);
		});

		it('default registration appends to the list (most-recent gets resolution priority)', () => {
			registry.register(makeParser('a'));
			registry.register(makeParser('b'));
			expect(registry.list()).toEqual(['b', 'a']);
		});

		it('prepend: true places the parser at the low-priority end', () => {
			registry.register(makeParser('a'));
			registry.register(makeParser('b'), true);
			// b prepended → idx 0; a appended → idx 1; list reverses → ['a', 'b']
			expect(registry.list()).toEqual(['a', 'b']);
		});
	});

	describe('unregister()', () => {
		it('removes a parser by id', () => {
			registry.register(makeParser('lrc'));
			registry.unregister('lrc');
			expect(registry.findById('lrc')).toBeUndefined();
		});

		it('no-op when id does not exist', () => {
			expect(() => registry.unregister('absent')).not.toThrow();
		});
	});

	describe('resolve()', () => {
		it('returns the first matching parser (most-recently-registered wins)', () => {
			const parserA = makeParser('a', true);
			const parserB = makeParser('b', true);
			registry.register(parserA);
			registry.register(parserB);
			expect(registry.resolve('foo.lrc')).toBe(parserB);
		});

		it('skips parsers whose canParse returns false', () => {
			registry.register(makeParser('a', false));
			registry.register(makeParser('b', true));
			expect(registry.resolve('foo')).toEqual(expect.objectContaining({ id: 'b' }));
		});

		it('returns undefined when no parser matches', () => {
			registry.register(makeParser('a', false));
			expect(registry.resolve('foo')).toBeUndefined();
		});

		it('returns undefined on empty registry', () => {
			expect(registry.resolve('foo')).toBeUndefined();
		});

		it('passes URL + contentType through to canParse', () => {
			const canParseSpy = vi.fn(() => true);
			registry.register({ id: 'spy', canParse: canParseSpy as any, parse: () => ({ cues: [] } as unknown as CueList) });
			registry.resolve('foo.lrc', 'text/lrc');
			expect(canParseSpy).toHaveBeenCalledWith('foo.lrc', 'text/lrc');
		});
	});

	describe('findById() / list()', () => {
		it('findById returns the parser by id', () => {
			const parser = makeParser('lrc');
			registry.register(parser);
			expect(registry.findById('lrc')).toBe(parser);
		});

		it('findById returns undefined for unknown id', () => {
			expect(registry.findById('unknown')).toBeUndefined();
		});

		it('list returns parser ids in resolution order (last → first)', () => {
			registry.register(makeParser('a'));
			registry.register(makeParser('b'));
			registry.register(makeParser('c'));
			expect(registry.list()).toEqual(['c', 'b', 'a']);
		});

		it('list returns empty array when nothing registered', () => {
			expect(registry.list()).toEqual([]);
		});
	});

	describe('dispose()', () => {
		it('clears all parsers', () => {
			registry.register(makeParser('a'));
			registry.register(makeParser('b'));
			registry.dispose();
			expect(registry.list()).toEqual([]);
		});
	});
});
