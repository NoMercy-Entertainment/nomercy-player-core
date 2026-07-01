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
			const defaultTranslator = new DefaultTranslator({ translations: { en: { hello: 'Hi' } } });
			expect(defaultTranslator.t('hello')).toBe('Hi');
		});
	});

	describe('t() — translation lookup', () => {
		it('returns the bundle value when present', () => {
			const defaultTranslator = new DefaultTranslator({ translations: { en: { greeting: 'Hello' } } });
			expect(defaultTranslator.t('greeting')).toBe('Hello');
		});

		it('returns the key when no bundle entry exists (default fallback)', () => {
			const defaultTranslator = new DefaultTranslator();
			expect(defaultTranslator.t('missing.key')).toBe('missing.key');
		});

		it('uses onMissingTranslation when provided', () => {
			const defaultTranslator = new DefaultTranslator({
				onMissingTranslation: (key, lang) => `[MISSING ${lang}:${key}]`,
			});
			expect(defaultTranslator.t('missing')).toBe('[MISSING en:missing]');
		});

		it('onMissingTranslation does NOT run when key is present', () => {
			const handler = vi.fn(() => 'fallback');
			const defaultTranslator = new DefaultTranslator({
				translations: { en: { found: 'Hello' } },
				onMissingTranslation: handler,
			});
			defaultTranslator.t('found');
			expect(handler).not.toHaveBeenCalled();
		});

		describe('interpolation', () => {
			it('replaces {var} with the matching value', () => {
				const defaultTranslator = new DefaultTranslator({ translations: { en: { greet: 'Hello {name}' } } });
				expect(defaultTranslator.t('greet', { name: 'World' })).toBe('Hello World');
			});

			it('replaces multiple placeholders', () => {
				const defaultTranslator = new DefaultTranslator({ translations: { en: { greet: '{a}+{b}={c}' } } });
				expect(defaultTranslator.t('greet', { a: '1', b: '2', c: '3' })).toBe('1+2=3');
			});

			it('leaves {var} untouched when var is missing', () => {
				const defaultTranslator = new DefaultTranslator({ translations: { en: { greet: 'Hi {name}' } } });
				expect(defaultTranslator.t('greet', {})).toBe('Hi {name}');
			});

			it('no interpolation when no vars passed', () => {
				const defaultTranslator = new DefaultTranslator({ translations: { en: { greet: 'Hi {name}' } } });
				expect(defaultTranslator.t('greet')).toBe('Hi {name}');
			});

			it('interpolates after onMissingTranslation fallback', () => {
				const defaultTranslator = new DefaultTranslator({
					onMissingTranslation: key => `[${key} {name}]`,
				});
				expect(defaultTranslator.t('missing', { name: 'foo' })).toBe('[missing foo]');
			});
		});
	});

	describe('language()', () => {
		it('switches the active language', async () => {
			const defaultTranslator = new DefaultTranslator({
				translations: {
					en: { hi: 'Hello' },
					nl: { hi: 'Hallo' },
				},
			});
			await defaultTranslator.language('nl');
			expect(defaultTranslator.language()).toBe('nl');
			expect(defaultTranslator.t('hi')).toBe('Hallo');
		});

		it('returns a Promise', () => {
			const result = new DefaultTranslator().language('fr');
			expect(result).toBeInstanceOf(Promise);
		});

		it('invokes loadTranslations on first switch to a new language', async () => {
			const loader = vi.fn(async (_lang: string) => ({ hi: 'Bonjour' }));
			const defaultTranslator = new DefaultTranslator({ loadTranslations: loader });
			await defaultTranslator.language('fr');
			expect(loader).toHaveBeenCalledWith('fr');
			expect(defaultTranslator.t('hi')).toBe('Bonjour');
		});

		it('does NOT re-invoke loader when returning to a previously-loaded language', async () => {
			const loader = vi.fn(async (lang: string) => ({ hi: lang === 'fr' ? 'Bonjour' : 'Hello' }));
			const defaultTranslator = new DefaultTranslator({ loadTranslations: loader });
			await defaultTranslator.language('fr'); // 1st call (fr)
			await defaultTranslator.language('en'); // 2nd call (en)
			await defaultTranslator.language('fr'); // no call — already loaded
			expect(loader).toHaveBeenCalledTimes(2);
		});

		it('does NOT invoke loader for languages already in initial bundles', async () => {
			const loader = vi.fn(async () => ({ hi: 'X' }));
			const defaultTranslator = new DefaultTranslator({
				translations: { fr: { hi: 'Bonjour' } },
				loadTranslations: loader,
			});
			await defaultTranslator.language('fr');
			expect(loader).not.toHaveBeenCalled();
		});

		it('returning undefined from loader is treated as "no bundle available"', async () => {
			const loader = vi.fn(async () => undefined);
			const defaultTranslator = new DefaultTranslator({ loadTranslations: loader });
			await defaultTranslator.language('jp');
			// Falls through to key fallback
			expect(defaultTranslator.t('greeting')).toBe('greeting');
		});

		it('loader throw does NOT break language()', async () => {
			const loader = vi.fn(async () => {
				throw new Error('network');
			});
			const defaultTranslator = new DefaultTranslator({ loadTranslations: loader });
			await expect(defaultTranslator.language('fr')).resolves.not.toThrow();
			expect(defaultTranslator.language()).toBe('fr');
		});
	});

	describe('addTranslations()', () => {
		it('merges bundles into existing languages', () => {
			const defaultTranslator = new DefaultTranslator({ translations: { en: { a: '1' } } });
			defaultTranslator.addTranslations({ en: { b: '2' } });
			expect(defaultTranslator.t('a')).toBe('1');
			expect(defaultTranslator.t('b')).toBe('2');
		});

		it('overrides existing keys (last write wins)', () => {
			const defaultTranslator = new DefaultTranslator({ translations: { en: { x: 'old' } } });
			defaultTranslator.addTranslations({ en: { x: 'new' } });
			expect(defaultTranslator.t('x')).toBe('new');
		});

		it('seeds new languages', async () => {
			const defaultTranslator = new DefaultTranslator();
			defaultTranslator.addTranslations({ fr: { hi: 'Bonjour' } });
			await defaultTranslator.language('fr');
			expect(defaultTranslator.t('hi')).toBe('Bonjour');
		});

		it('addTranslations does not satisfy the loader — switch still loads and merges', async () => {
			// A plugin merging its static bundle at registration must not
			// suppress the consumer's loadTranslations for that language —
			// that conflation left the configured loader permanently unfired.
			const loader = vi.fn(async () => ({ bye: 'Au revoir' }));
			const defaultTranslator = new DefaultTranslator({ loadTranslations: loader });
			defaultTranslator.addTranslations({ fr: { hi: 'Bonjour' } });
			await defaultTranslator.language('fr');

			expect(loader).toHaveBeenCalledWith('fr');
			expect(defaultTranslator.t('hi')).toBe('Bonjour');
			expect(defaultTranslator.t('bye')).toBe('Au revoir');

			// Second switch to the same tag stays cached — loader fires once.
			await defaultTranslator.language('fr');
			expect(loader).toHaveBeenCalledTimes(1);
		});
	});

	describe('translation()', () => {
		it('sets a single key', () => {
			const defaultTranslator = new DefaultTranslator();
			defaultTranslator.translation('en', 'k', 'v');
			expect(defaultTranslator.t('k')).toBe('v');
		});

		it('overrides an existing value', () => {
			const defaultTranslator = new DefaultTranslator({ translations: { en: { k: 'old' } } });
			defaultTranslator.translation('en', 'k', 'new');
			expect(defaultTranslator.t('k')).toBe('new');
		});

		it('seeds a new language', async () => {
			const defaultTranslator = new DefaultTranslator();
			defaultTranslator.translation('fr', 'hi', 'Bonjour');
			await defaultTranslator.language('fr');
			expect(defaultTranslator.t('hi')).toBe('Bonjour');
		});
	});

	describe('removeTranslations()', () => {
		it('removes keys matching the prefix from every language by default', () => {
			const defaultTranslator = new DefaultTranslator({
				translations: {
					en: { 'plugin.lyrics.x': 'a', 'core.other': 'c' },
					nl: { 'plugin.lyrics.x': 'a-nl' },
				},
			});
			defaultTranslator.removeTranslations('plugin.lyrics.');
			expect(defaultTranslator.t('plugin.lyrics.x')).toBe('plugin.lyrics.x');
			expect(defaultTranslator.t('core.other')).toBe('c');
		});

		it('scoped to a single language when lang is given', () => {
			const defaultTranslator = new DefaultTranslator({
				translations: {
					en: { 'plugin.x': 'en-val' },
					nl: { 'plugin.x': 'nl-val' },
				},
			});
			defaultTranslator.removeTranslations('plugin.', 'nl');
			expect(defaultTranslator.t('plugin.x')).toBe('en-val');
		});

		it('no-op for non-matching prefix', () => {
			const defaultTranslator = new DefaultTranslator({ translations: { en: { keep: 'v' } } });
			defaultTranslator.removeTranslations('absent.');
			expect(defaultTranslator.t('keep')).toBe('v');
		});
	});

	describe('dispose()', () => {
		it('clears all bundles + loaded set', () => {
			const defaultTranslator = new DefaultTranslator({ translations: { en: { hi: 'Hello' } } });
			defaultTranslator.dispose();
			expect(defaultTranslator.t('hi')).toBe('hi'); // falls back to key
		});
	});
});
