/**
 * A language matcher takes a BCP-47 tag and returns the ordered fallback
 * chain to walk when looking up a translation key.
 *
 * `'pt-BR'` → `['pt-BR', 'pt']`
 * `'zh-Hant-TW'` → `['zh-Hant-TW', 'zh-Hant', 'zh']`
 */
export interface ILanguageMatcher {
	(tag: string): string[];
}
