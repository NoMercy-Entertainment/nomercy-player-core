/**
 * `translationsFromGlob` — convention-driven translation discovery from
 * `import.meta.glob` results.
 *
 * Coverage:
 *   - Filename → BCP-47 tag mapping (en, nl, pt-BR, zh-Hant-TW).
 *   - `index.ts` is skipped (it's a barrel, not a language).
 *   - Default export wins; named export matching the tag is the fallback.
 *   - Non-string values in a bundle are dropped (defensive).
 *   - Nested folder paths are tolerated (basename only matters).
 *   - Unknown / malformed module shapes are ignored, not thrown.
 */

import { describe, expect, it, vi } from 'vitest';
import { getLazyTranslationLoader, translationsFromGlob } from '../translations-glob';

describe('translationsFromGlob — eager path', () => {
	it('maps filename to BCP-47 language tag', () => {
		const out = translationsFromGlob({
			'./i18n/en.ts': { default: { 'plugin.x.k': 'EN' } },
			'./i18n/nl.ts': { default: { 'plugin.x.k': 'NL' } },
			'./i18n/pt-BR.ts': { default: { 'plugin.x.k': 'BR' } },
			'./i18n/zh-Hant-TW.ts': { default: { 'plugin.x.k': 'ZH' } },
		});
		expect(out['en']).toEqual({ 'plugin.x.k': 'EN' });
		expect(out['nl']).toEqual({ 'plugin.x.k': 'NL' });
		expect(out['pt-BR']).toEqual({ 'plugin.x.k': 'BR' });
		expect(out['zh-Hant-TW']).toEqual({ 'plugin.x.k': 'ZH' });
	});

	it('skips `index.ts` (it is a barrel, not a language file)', () => {
		const out = translationsFromGlob({
			'./i18n/en.ts': { default: { 'plugin.x.k': 'EN' } },
			'./i18n/index.ts': { default: { 'plugin.x.k': 'whatever' } },
		});
		expect(Object.keys(out)).toEqual(['en']);
	});

	it('falls back to a named export matching the tag when no default is present', () => {
		// Older convention: `export const en = {...}`. Helper accepts both.
		const out = translationsFromGlob({
			'./i18n/en.ts': { en: { 'plugin.x.k': 'EN-named' } } as any,
		});
		expect(out['en']).toEqual({ 'plugin.x.k': 'EN-named' });
	});

	it('drops non-string values defensively', () => {
		const out = translationsFromGlob({
			'./i18n/en.ts': {
				default: {
					'plugin.x.ok': 'string',
					'plugin.x.bad-num': 42 as any,
					'plugin.x.bad-obj': { nested: 'no' } as any,
				},
			},
		});
		expect(out['en']).toEqual({ 'plugin.x.ok': 'string' });
	});

	it('returns an empty object when no files match', () => {
		expect(translationsFromGlob({})).toEqual({});
	});

	it('tolerates nested folder paths', () => {
		const out = translationsFromGlob({
			'./deeply/nested/i18n/en.ts': { default: { x: 'X' } },
			'/abs/path/to/nl.ts': { default: { x: 'Y' } },
		});
		expect(out['en']).toEqual({ x: 'X' });
		expect(out['nl']).toEqual({ x: 'Y' });
	});

	it('ignores modules without a default or matching named export', () => {
		const out = translationsFromGlob({
			'./i18n/en.ts': { someUnrelatedExport: { x: 'no' } } as any,
			'./i18n/nl.ts': null as any,
			'./i18n/fr.ts': undefined as any,
		});
		expect(out).toEqual({});
	});

	it('eager input is NOT marked lazy (no loader stamped)', () => {
		const out = translationsFromGlob({
			'./i18n/en.ts': { default: { x: 'X' } },
		});
		expect(getLazyTranslationLoader(out)).toBeNull();
	});
});

describe('translationsFromGlob — lazy path', () => {
	it('returns an object with the lazy marker when modules are loader functions', () => {
		const out = translationsFromGlob({
			'./i18n/en.ts': vi.fn(async () => ({ default: { x: 'EN' } })),
			'./i18n/nl.ts': vi.fn(async () => ({ default: { x: 'NL' } })),
		});
		const loader = getLazyTranslationLoader(out);
		expect(loader).toBeInstanceOf(Function);
	});

	it('lazy loader fetches a single language on demand', async () => {
		const enLoader = vi.fn(async () => ({ default: { x: 'EN' } }));
		const nlLoader = vi.fn(async () => ({ default: { x: 'NL' } }));
		const zhLoader = vi.fn(async () => ({ default: { x: 'ZH' } }));
		const out = translationsFromGlob({
			'./i18n/en.ts': enLoader,
			'./i18n/nl.ts': nlLoader,
			'./i18n/zh.ts': zhLoader,
		});
		const loader = getLazyTranslationLoader(out)!;
		const bundle = await loader('nl');
		expect(bundle).toEqual({ x: 'NL' });

		// Critical: ONLY the requested language's loader fires. Chinese is
		// not pulled into memory when the user wants Dutch.
		expect(nlLoader).toHaveBeenCalledTimes(1);
		expect(enLoader).not.toHaveBeenCalled();
		expect(zhLoader).not.toHaveBeenCalled();
	});

	it('lazy loader returns undefined for an unknown language', async () => {
		const out = translationsFromGlob({
			'./i18n/en.ts': async () => ({ default: { x: 'EN' } }),
		});
		const loader = getLazyTranslationLoader(out)!;
		expect(await loader('xx-YY')).toBeUndefined();
	});

	it('lazy loader returns undefined when the loader rejects', async () => {
		const out = translationsFromGlob({
			'./i18n/en.ts': async () => { throw new Error('chunk-load-failed'); },
		});
		const loader = getLazyTranslationLoader(out)!;
		expect(await loader('en')).toBeUndefined();
	});

	it('mixed eager + lazy entries — eager values are wrapped uniformly', async () => {
		const out = translationsFromGlob({
			'./i18n/en.ts': { default: { x: 'EN' } } as any,
			'./i18n/nl.ts': vi.fn(async () => ({ default: { x: 'NL' } })),
		});
		const loader = getLazyTranslationLoader(out)!;
		expect(await loader('en')).toEqual({ x: 'EN' });
		expect(await loader('nl')).toEqual({ x: 'NL' });
	});

	it('skips index.ts and unknown extensions even in lazy mode', async () => {
		const out = translationsFromGlob({
			'./i18n/index.ts': async () => ({ default: { x: 'IDX' } }),
			'./i18n/en.ts': async () => ({ default: { x: 'EN' } }),
		});
		const loader = getLazyTranslationLoader(out)!;
		expect(await loader('index')).toBeUndefined();
		expect(await loader('en')).toEqual({ x: 'EN' });
	});
});
