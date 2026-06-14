// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * DefaultTranslator tests — kit's i18n engine. Tested at every layer of the
 * resolution chain (bundle → onMissingTranslation → key fallback) plus
 * runtime mutation + async loader.
 */

import { describe, expect, it, vi } from 'vitest';
import { DefaultTranslator } from '../adapters/translator/translator';

describe('DefaultTranslator', () => {
	describe('construction', () => {
		it('defaults to language "en"', () => {
			expect(new DefaultTranslator().language()).toBe('en');
		});

		it('honors initial language', () => {
			expect(new DefaultTranslator({ language: 'nl' }).language()).toBe('nl');
		});

		it('seeds initial bundles', () => {
			const t = new DefaultTranslator({ translations: { en: { hello: 'Hi' } } });
			expect(t.t('hello')).toBe('Hi');
		});
	});

	describe('t() — translation lookup', () => {
		it('returns the bundle value when present', () => {
			const t = new DefaultTranslator({ translations: { en: { greeting: 'Hello' } } });
			expect(t.t('greeting')).toBe('Hello');
		});

		it('returns the key when no bundle entry exists (default fallback)', () => {
			const t = new DefaultTranslator();
			expect(t.t('missing.key')).toBe('missing.key');
		});

		it('uses onMissingTranslation when provided', () => {
			const t = new DefaultTranslator({
				onMissingTranslation: (key, lang) => `[MISSING ${lang}:${key}]`,
			});
			expect(t.t('missing')).toBe('[MISSING en:missing]');
		});

		it('onMissingTranslation does NOT run when key is present', () => {
			const handler = vi.fn(() => 'fallback');
			const t = new DefaultTranslator({
				translations: { en: { found: 'Hello' } },
				onMissingTranslation: handler,
			});
			t.t('found');
			expect(handler).not.toHaveBeenCalled();
		});

		describe('interpolation', () => {
			it('replaces {var} with the matching value', () => {
				const t = new DefaultTranslator({ translations: { en: { greet: 'Hello {name}' } } });
				expect(t.t('greet', { name: 'World' })).toBe('Hello World');
			});

			it('replaces multiple placeholders', () => {
				const t = new DefaultTranslator({ translations: { en: { greet: '{a}+{b}={c}' } } });
				expect(t.t('greet', { a: '1', b: '2', c: '3' })).toBe('1+2=3');
			});

			it('leaves {var} untouched when var is missing', () => {
				const t = new DefaultTranslator({ translations: { en: { greet: 'Hi {name}' } } });
				expect(t.t('greet', {})).toBe('Hi {name}');
			});

			it('no interpolation when no vars passed', () => {
				const t = new DefaultTranslator({ translations: { en: { greet: 'Hi {name}' } } });
				expect(t.t('greet')).toBe('Hi {name}');
			});

			it('interpolates after onMissingTranslation fallback', () => {
				const t = new DefaultTranslator({
					onMissingTranslation: key => `[${key} {name}]`,
				});
				expect(t.t('missing', { name: 'foo' })).toBe('[missing foo]');
			});
		});
	});

	describe('language()', () => {
		it('switches the active language', async () => {
			const t = new DefaultTranslator({
				translations: {
					en: { hi: 'Hello' },
					nl: { hi: 'Hallo' },
				},
			});
			await t.language('nl');
			expect(t.language()).toBe('nl');
			expect(t.t('hi')).toBe('Hallo');
		});

		it('returns a Promise', () => {
			const result = new DefaultTranslator().language('fr');
			expect(result).toBeInstanceOf(Promise);
		});

		it('invokes loadTranslations on first switch to a new language', async () => {
			const loader = vi.fn(async (_lang: string) => ({ hi: 'Bonjour' }));
			const t = new DefaultTranslator({ loadTranslations: loader });
			await t.language('fr');
			expect(loader).toHaveBeenCalledWith('fr');
			expect(t.t('hi')).toBe('Bonjour');
		});

		it('does NOT re-invoke loader when returning to a previously-loaded language', async () => {
			const loader = vi.fn(async (lang: string) => ({ hi: lang === 'fr' ? 'Bonjour' : 'Hello' }));
			const t = new DefaultTranslator({ loadTranslations: loader });
			await t.language('fr'); // 1st call (fr)
			await t.language('en'); // 2nd call (en)
			await t.language('fr'); // no call — already loaded
			expect(loader).toHaveBeenCalledTimes(2);
		});

		it('does NOT invoke loader for languages already in initial bundles', async () => {
			const loader = vi.fn(async () => ({ hi: 'X' }));
			const t = new DefaultTranslator({
				translations: { fr: { hi: 'Bonjour' } },
				loadTranslations: loader,
			});
			await t.language('fr');
			expect(loader).not.toHaveBeenCalled();
		});

		it('returning undefined from loader is treated as "no bundle available"', async () => {
			const loader = vi.fn(async () => undefined);
			const t = new DefaultTranslator({ loadTranslations: loader });
			await t.language('jp');
			// Falls through to key fallback
			expect(t.t('greeting')).toBe('greeting');
		});

		it('loader throw does NOT break language()', async () => {
			const loader = vi.fn(async () => {
				throw new Error('network');
			});
			const t = new DefaultTranslator({ loadTranslations: loader });
			await expect(t.language('fr')).resolves.not.toThrow();
			expect(t.language()).toBe('fr');
		});
	});

	describe('addTranslations()', () => {
		it('merges bundles into existing languages', () => {
			const t = new DefaultTranslator({ translations: { en: { a: '1' } } });
			t.addTranslations({ en: { b: '2' } });
			expect(t.t('a')).toBe('1');
			expect(t.t('b')).toBe('2');
		});

		it('overrides existing keys (last write wins)', () => {
			const t = new DefaultTranslator({ translations: { en: { x: 'old' } } });
			t.addTranslations({ en: { x: 'new' } });
			expect(t.t('x')).toBe('new');
		});

		it('seeds new languages', async () => {
			const t = new DefaultTranslator();
			t.addTranslations({ fr: { hi: 'Bonjour' } });
			await t.language('fr');
			expect(t.t('hi')).toBe('Bonjour');
		});

		it('addTranslations does not satisfy the loader — switch still loads and merges', async () => {
			// A plugin merging its static bundle at registration must not
			// suppress the consumer's loadTranslations for that language —
			// that conflation left the configured loader permanently unfired.
			const loader = vi.fn(async () => ({ bye: 'Au revoir' }));
			const t = new DefaultTranslator({ loadTranslations: loader });
			t.addTranslations({ fr: { hi: 'Bonjour' } });
			await t.language('fr');

			expect(loader).toHaveBeenCalledWith('fr');
			expect(t.t('hi')).toBe('Bonjour');
			expect(t.t('bye')).toBe('Au revoir');

			// Second switch to the same tag stays cached — loader fires once.
			await t.language('fr');
			expect(loader).toHaveBeenCalledTimes(1);
		});
	});

	describe('translation()', () => {
		it('sets a single key', () => {
			const t = new DefaultTranslator();
			t.translation('en', 'k', 'v');
			expect(t.t('k')).toBe('v');
		});

		it('overrides an existing value', () => {
			const t = new DefaultTranslator({ translations: { en: { k: 'old' } } });
			t.translation('en', 'k', 'new');
			expect(t.t('k')).toBe('new');
		});

		it('seeds a new language', async () => {
			const t = new DefaultTranslator();
			t.translation('fr', 'hi', 'Bonjour');
			await t.language('fr');
			expect(t.t('hi')).toBe('Bonjour');
		});
	});

	describe('removeTranslations()', () => {
		it('removes keys matching the prefix from every language by default', () => {
			const t = new DefaultTranslator({
				translations: {
					en: { 'plugin.lyrics.x': 'a', 'core.other': 'c' },
					nl: { 'plugin.lyrics.x': 'a-nl' },
				},
			});
			t.removeTranslations('plugin.lyrics.');
			expect(t.t('plugin.lyrics.x')).toBe('plugin.lyrics.x');
			expect(t.t('core.other')).toBe('c');
		});

		it('scoped to a single language when lang is given', () => {
			const t = new DefaultTranslator({
				translations: {
					en: { 'plugin.x': 'en-val' },
					nl: { 'plugin.x': 'nl-val' },
				},
			});
			t.removeTranslations('plugin.', 'nl');
			expect(t.t('plugin.x')).toBe('en-val');
		});

		it('no-op for non-matching prefix', () => {
			const t = new DefaultTranslator({ translations: { en: { keep: 'v' } } });
			t.removeTranslations('absent.');
			expect(t.t('keep')).toBe('v');
		});
	});

	describe('dispose()', () => {
		it('clears all bundles + loaded set', () => {
			const t = new DefaultTranslator({ translations: { en: { hi: 'Hello' } } });
			t.dispose();
			expect(t.t('hi')).toBe('hi'); // falls back to key
		});
	});
});
