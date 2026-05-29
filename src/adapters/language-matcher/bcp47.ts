import type { ILanguageMatcher } from './ILanguageMatcher';

/**
 * Walk a BCP-47 tag down its parent chain. `'pt-BR'` → `['pt-BR', 'pt']`,
 * `'zh-Hant-TW'` → `['zh-Hant-TW', 'zh-Hant', 'zh']`, `'en'` → `['en']`.
 * Strips one trailing subtag at a time on the `-` separator. Whitespace and
 * casing are preserved — bundle keys are looked up byte-for-byte.
 */
export const bcp47FallbackChain: ILanguageMatcher = (tag) => {
	if (!tag)
		return [];
	const out: string[] = [tag];
	let cur = tag;
	while (cur.includes('-')) {
		cur = cur.slice(0, cur.lastIndexOf('-'));
		out.push(cur);
	}
	return out;
};
