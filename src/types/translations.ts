/**
 * Translation bundle map. Outer key is a BCP-47 language tag; inner map is
 * key → translated string. Example: `{ en: { 'core.network.timeout': 'Connection timed out' }, nl: { ... } }`.
 */
export type Translations = Record<string, Record<string, string>>;

/**
 * Async loader for translation bundles. Receives a language tag, resolves to
 * a key→value map for that language. Player calls this on `setLanguage(lang)`
 * when no bundle is already loaded for `lang`. Return `undefined` when the
 * language isn't available so the player falls through to the existing
 * `translations` config (and ultimately the kit defaults).
 *
 * Use cases:
 *  - fetch from API (`return await player.fetch(`/i18n/${lang}.json`, JSON.parse)`)
 *  - dynamic import of bundled JSON (`return (await import(`./i18n/${lang}.json`)).default`)
 *  - hard-coded switch over included bundles
 */
export type TranslationLoader = (lang: string) => Promise<Record<string, string> | undefined>;
