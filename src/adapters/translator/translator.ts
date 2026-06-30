// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { Translations } from '../../types';
import type { DefaultTranslatorOptions, ITranslator } from './ITranslator';

import { bcp47FallbackChain } from '../language-matcher/bcp47';

export type { DefaultTranslatorOptions, ITranslator } from './ITranslator';

const VAR_RE = /\{(\w+)\}/g;

/**
 * Default kit translator. Resolves a translation key by walking the BCP-47
 * fallback chain (`pt-BR` → `pt` → `en`) over the in-memory bundle table,
 * then substituting `{var}` placeholders from the `vars` map.
 *
 * Resolution order for `t(key)`:
 *  1. Each tag in the active language's BCP-47 chain (most specific first)
 *  2. `onMissingTranslation(key, lang)` callback, if configured
 *  3. The key itself
 *
 * Each language is loaded at most once: `language(lang)` consults
 * `loadTranslations` the first time a tag is needed, then caches the result.
 * Swap the whole engine via `setup({ translator })` when you need pluralisation,
 * ICU MessageFormat, or any feature the built-in lookup doesn't cover.
 */
export class DefaultTranslator implements ITranslator {
	private currentLanguage: string;
	private readonly bundles: Translations;
	private readonly loaded = new Set<string>();
	private readonly loader?: (lang: string) => Promise<Record<string, string> | undefined>;
	private readonly missingHandler?: (key: string, lang: string) => string;
	private readonly fallbackLanguage: string | null;

	constructor(opts?: DefaultTranslatorOptions) {
		this.currentLanguage = opts?.language ?? 'en';
		this.bundles = {};
		if (opts?.translations) {
			for (const [lang, bundle] of Object.entries(opts.translations)) {
				this.bundles[lang] = { ...bundle };
				this.loaded.add(lang);
			}
		}
		this.loader = opts?.loadTranslations;
		this.missingHandler = opts?.onMissingTranslation;
		// `null` opts out of the global default; `undefined` keeps `'en'`.
		this.fallbackLanguage = opts?.fallbackLanguage === null
			? null
			: (opts?.fallbackLanguage ?? 'en');
	}

	t(key: string, vars?: Record<string, string>): string {
		const chain = bcp47FallbackChain(this.currentLanguage);
		if (this.fallbackLanguage && !chain.includes(this.fallbackLanguage)) {
			chain.push(this.fallbackLanguage);
		}

		let raw: string | undefined;
		for (const lang of chain) {
			const bundle = this.bundles[lang];
			const value = bundle?.[key];
			if (typeof value === 'string') {
				raw = value;
				break;
			}
		}

		const resolved = raw
			?? this.missingHandler?.(key, this.currentLanguage)
			?? key;

		if (!vars)
			return resolved;
		return resolved.replace(VAR_RE, (_, name: string) => vars[name] ?? `{${name}}`);
	}

	/**
	 * Read or write the active language tag.
	 *
	 * `language()` — returns the current BCP-47 tag.
	 * `language(lang)` — switches to `lang`, loading bundles via the configured
	 * loader if the tag hasn't been fetched yet. Resolves once all tags in the
	 * BCP-47 chain are loaded.
	 */
	language(): string;
	language(lang: string): Promise<void>;
	language(lang?: string): string | Promise<void> {
		if (lang === undefined) {
			return this.currentLanguage;
		}
		return this.switchLanguage(lang);
	}

	private async switchLanguage(lang: string): Promise<void> {
		this.currentLanguage = lang;

		// Walk the full BCP-47 chain so regional variants (`pt-BR`) also have
		// the parent bundle (`pt`) in memory as a natural fallback for keys
		// the regional file doesn't override.
		const chain = bcp47FallbackChain(lang);
		for (const tag of chain) {
			if (this.loaded.has(tag))
				continue;
			this.loaded.add(tag); // mark BEFORE loader so re-entrant language() doesn't double-fire

			if (!this.loader) {
				if (!this.bundles[tag])
					this.bundles[tag] = {};
				continue;
			}

			try {
				const loaded = await this.loader(tag);
				if (loaded) {
					this.bundles[tag] = {
						...(this.bundles[tag] ?? {}),
						...loaded,
					};
				}
			}
			catch (err) {
				// Loader failure must not break language() — fall through to
				// whatever bundle is already loaded (or the missing-key fallback).
				void err;
			}

			if (!this.bundles[tag])
				this.bundles[tag] = {};
		}
	}

	addTranslations(bundle: Translations): void {
		for (const [lang, keys] of Object.entries(bundle)) {
			this.bundles[lang] = {
				...(this.bundles[lang] ?? {}),
				...keys,
			};
			// Deliberately NOT marked in `loaded`: merging keys (e.g. a plugin's
			// static bundle at registration) must not satisfy the loader
			// contract — `language(lang)` still owes the configured
			// `loadTranslations` a call for this tag.
		}
	}

	/**
	 * Read or write a single translation key.
	 *
	 * `translation(lang, key)` — returns the stored value or `undefined`.
	 * `translation(lang, key, value)` — sets the key. Persists for the
	 * player's lifetime.
	 */
	translation(lang: string, key: string): string | undefined;
	translation(lang: string, key: string, value: string): void;
	translation(lang: string, key: string, value?: string): string | undefined | void {
		if (value === undefined) {
			return this.bundles[lang]?.[key];
		}
		if (!this.bundles[lang]) {
			this.bundles[lang] = {};
			this.loaded.add(lang);
		}
		this.bundles[lang]![key] = value;
	}

	removeTranslations(prefix: string, lang?: string): void {
		const langs = lang ? [lang] : Object.keys(this.bundles);
		for (const l of langs) {
			const bundle = this.bundles[l];
			if (!bundle)
				continue;
			for (const k of Object.keys(bundle)) {
				if (k.startsWith(prefix))
					delete bundle[k];
			}
		}
	}

	dispose(): void {
		for (const lang of Object.keys(this.bundles)) {
			delete this.bundles[lang];
		}
		this.loaded.clear();
	}
}
