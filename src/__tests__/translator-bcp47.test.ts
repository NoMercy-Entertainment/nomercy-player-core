/**
 * BCP-47 fallback chain tests for `DefaultTranslator` + `bcp47FallbackChain`.
 *
 * Coverage:
 *   - Helper produces the correct chain for every common shape.
 *   - `t()` walks the chain — `pt-BR` → `pt` → `en` (default).
 *   - Network loader fires for each tag in the chain so regional and parent
 *     bundles end up in memory.
 *   - `fallbackLanguage: null` opts out of the global default.
 */

import { describe, expect, it, vi } from 'vitest';
import { bcp47FallbackChain } from '../adapters/language-matcher/bcp47';
import { DefaultTranslator } from '../adapters/translator/translator';

describe('bcp47FallbackChain', () => {
	it('returns just the tag for a bare language', () => {
		expect(bcp47FallbackChain('en')).toEqual(['en']);
		expect(bcp47FallbackChain('nl')).toEqual(['nl']);
	});

	it('walks one parent for region variants', () => {
		expect(bcp47FallbackChain('pt-BR')).toEqual(['pt-BR', 'pt']);
		expect(bcp47FallbackChain('pt-PT')).toEqual(['pt-PT', 'pt']);
		expect(bcp47FallbackChain('en-US')).toEqual(['en-US', 'en']);
		expect(bcp47FallbackChain('zh-Hans')).toEqual(['zh-Hans', 'zh']);
	});

	it('walks each level for script + region tags', () => {
		expect(bcp47FallbackChain('zh-Hant-TW')).toEqual(['zh-Hant-TW', 'zh-Hant', 'zh']);
		expect(bcp47FallbackChain('sr-Cyrl-RS')).toEqual(['sr-Cyrl-RS', 'sr-Cyrl', 'sr']);
	});

	it('returns an empty list for an empty input', () => {
		expect(bcp47FallbackChain('')).toEqual([]);
	});
});

describe('DefaultTranslator BCP-47 fallback', () => {
	it('resolves a regional key from the regional bundle when present', () => {
		const t = new DefaultTranslator({
			language: 'pt-BR',
			translations: {
				'pt-BR': { greeting: 'Oi' },
				'pt': { greeting: 'Olá' },
			},
		});
		expect(t.t('greeting')).toBe('Oi');
	});

	it('falls back to the parent language when the regional bundle lacks the key', () => {
		const t = new DefaultTranslator({
			language: 'pt-BR',
			translations: {
				'pt-BR': {},
				'pt': { greeting: 'Olá' },
			},
		});
		expect(t.t('greeting')).toBe('Olá');
	});

	it('falls back to the global default (en) when neither variant has the key', () => {
		const t = new DefaultTranslator({
			language: 'pt-BR',
			translations: {
				'pt-BR': {},
				'pt': {},
				'en': { greeting: 'Hi' },
			},
		});
		expect(t.t('greeting')).toBe('Hi');
	});

	it('returns the key when no language in the chain has it', () => {
		const t = new DefaultTranslator({
			language: 'pt-BR',
			translations: { en: {} },
		});
		expect(t.t('greeting')).toBe('greeting');
	});

	it('uses onMissingTranslation when nothing in the chain matches', () => {
		const missing = vi.fn().mockReturnValue('FALLBACK');
		const t = new DefaultTranslator({
			language: 'pt-BR',
			translations: { en: {} },
			onMissingTranslation: missing,
		});
		expect(t.t('greeting')).toBe('FALLBACK');
		expect(missing).toHaveBeenCalledWith('greeting', 'pt-BR');
	});

	it('fallbackLanguage: null disables the global default', () => {
		const t = new DefaultTranslator({
			language: 'pt-BR',
			translations: {
				'pt-BR': {},
				'en': { greeting: 'Hi' },
			},
			fallbackLanguage: null,
		});
		// `en` is still in the bundles but NOT walked — chain ends at `pt`.
		expect(t.t('greeting')).toBe('greeting');
	});

	it('fallbackLanguage: "fr" replaces the default', () => {
		const t = new DefaultTranslator({
			language: 'pt-BR',
			translations: {
				'pt-BR': {},
				'fr': { greeting: 'Bonjour' },
			},
			fallbackLanguage: 'fr',
		});
		expect(t.t('greeting')).toBe('Bonjour');
	});

	it('walks interpolation through the fallback chain', () => {
		const t = new DefaultTranslator({
			language: 'pt-BR',
			translations: {
				'pt-BR': {},
				'pt': { 'cast.connecting': 'Conectando a {device}…' },
			},
		});
		expect(t.t('cast.connecting', { device: 'Sala' })).toBe('Conectando a Sala…');
	});
});

describe('DefaultTranslator language() with BCP-47', () => {
	it('loads each tag in the chain (regional first, then parent)', async () => {
		const calls: string[] = [];
		const loader = vi.fn(async (tag: string): Promise<Record<string, string> | undefined> => {
			calls.push(tag);
			if (tag === 'pt-BR')
				return { regional: 'BR-only' };
			if (tag === 'pt')
				return { greeting: 'Olá' };
			return undefined;
		});
		const t = new DefaultTranslator({
			language: 'en',
			translations: { en: { greeting: 'Hi' } },
			loadTranslations: loader,
		});

		await t.language('pt-BR');
		expect(calls).toEqual(['pt-BR', 'pt']);
		// Regional bundle wins for keys it ships
		expect(t.t('regional')).toBe('BR-only');
		// Parent fills in keys the regional doesn't override
		expect(t.t('greeting')).toBe('Olá');
	});

	it('does not re-load a tag that is already in the cache', async () => {
		const loader = vi.fn().mockResolvedValue({ a: 'b' });
		const t = new DefaultTranslator({
			language: 'en',
			translations: { 'pt-BR': { x: 'y' }, 'pt': { x: 'y' } },
			loadTranslations: loader,
		});
		await t.language('pt-BR');
		expect(loader).not.toHaveBeenCalled();
	});

	it('survives a loader rejection without crashing language()', async () => {
		const loader = vi.fn().mockRejectedValue(new Error('cdn down'));
		const t = new DefaultTranslator({
			language: 'en',
			loadTranslations: loader,
		});
		await expect(t.language('pt-BR')).resolves.toBeUndefined();
		// Both tags still get loader attempts.
		expect(loader).toHaveBeenCalledWith('pt-BR');
		expect(loader).toHaveBeenCalledWith('pt');
	});
});
