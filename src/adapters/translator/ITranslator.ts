import type { Translations } from '../../types';

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
