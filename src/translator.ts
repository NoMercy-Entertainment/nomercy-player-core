import type { Translations } from './types';

/**
 * Pluggable translation engine. Default impl is a simple key+`{vars}` lookup
 * over a merged bundle table. Consumers needing pluralization, gender, ordinal,
 * ICU MessageFormat, RTL handling, or any heavier i18n feature swap this for
 * an i18next / FormatJS / custom adapter via `setup({ translator })`.
 *
 * Adapters live outside the kit (`@nomercy/translator-i18next`,
 * `@nomercy/translator-formatjs`) so consumers only pull the engine they want.
 */
export interface ITranslator {
	/** Translate `key` into the active language. `vars` is the interpolation map. */
	t(key: string, vars?: Record<string, string>): string;

	/**
	 * Read or write the active language tag.
	 *
	 * `language()` — returns the current language tag.
	 * `language(lang)` — switches language. May trigger async loaders; resolves
	 * once every loader settles.
	 */
	language(): string;
	language(lang: string): Promise<void>;

	/** Merge a bundle into the live table. Last-write-wins per key. */
	addTranslations(bundle: Translations): void;

	/**
	 * Read or write a single translation key.
	 *
	 * `translation(lang, key)` — returns the value for that key in `lang`, or
	 * `undefined` if absent.
	 * `translation(lang, key, value)` — sets the key. Persists for the player's
	 * lifetime.
	 */
	translation(lang: string, key: string): string | undefined;
	translation(lang: string, key: string, value: string): void;

	/**
	 * Remove keys matching a prefix. `lang` scopes the removal to one
	 * language; omit to remove from every language. Auto-invoked on plugin
	 * dispose for `plugin.<id>.` prefixes.
	 */
	removeTranslations(prefix: string, lang?: string): void;

	/** Dispose any resources the engine owns (subscriptions, observers). */
	dispose(): void;
}

export interface DefaultTranslatorOptions {
	/** Initial language tag. Defaults to `'en'`. */
	language?: string;

	/** Initial bundles. Merged on construction. */
	translations?: Translations;

	/**
	 * Async loader invoked by `language(lang)` when a tag's bundle hasn't been
	 * fetched yet. Return `undefined` to skip and fall through to existing bundles.
	 */
	loadTranslations?: (lang: string) => Promise<Record<string, string> | undefined>;

	/** Fallback when a key has no value. Default returns the key itself. */
	onMissingTranslation?: (key: string, lang: string) => string;

	/**
	 * Final-fallback language tag walked when neither the active language nor
	 * its parent (e.g. `pt-BR` → `pt`) has the key. Default `'en'` — pass
	 * `null` to disable the global default and rely solely on the parent
	 * fallback + `onMissingTranslation`.
	 */
	fallbackLanguage?: string | null;
}

/**
 * Walk a BCP-47 tag down its parent chain. `'pt-BR'` → `['pt-BR', 'pt']`,
 * `'zh-Hant-TW'` → `['zh-Hant-TW', 'zh-Hant', 'zh']`, `'en'` → `['en']`.
 * Strips one trailing subtag at a time on the `-` separator. Whitespace and
 * casing are preserved — bundle keys are looked up byte-for-byte.
 */
export function bcp47FallbackChain(tag: string): string[] {
	if (!tag)
		return [];
	const out: string[] = [tag];
	let cur = tag;
	while (cur.includes('-')) {
		cur = cur.slice(0, cur.lastIndexOf('-'));
		out.push(cur);
	}
	return out;
}

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
			const v = bundle?.[key];
			if (typeof v === 'string') {
				raw = v;
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
			this.loaded.add(lang);
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
