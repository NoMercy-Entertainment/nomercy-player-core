import type { AuthConfig } from './types';
import { authFetch } from './auth-fetch';

/**
 * Built-in network translation loader. Fetches a JSON bundle per language
 * via `authFetch` (so consumer auth, retries, transformUrl, abort and event
 * scoping all apply uniformly).
 *
 * Wire it into `setup({ loadTranslations })`:
 *
 * ```ts
 * setup({
 *   language: 'en',
 *   loadTranslations: createNetworkTranslationLoader({
 *     url: 'https://cdn.example.com/i18n/{lang}.json',
 *     auth: config.auth,
 *   }),
 * });
 * ```
 *
 * The `{lang}` placeholder is replaced per-call with the requested tag —
 * the BCP-47 fallback chain in `DefaultTranslator.setLanguage()` calls the
 * loader once for each tag (`pt-BR`, then `pt`), so the URL pattern only
 * needs to handle the exact tag form (e.g. `i18n/pt-BR.json`,
 * `i18n/pt.json`).
 *
 * Network failures (404 for a regional variant the CDN doesn't ship,
 * timeout, etc.) resolve to `undefined`, which `setLanguage` treats as
 * "no bundle available" and continues to the next tag in the chain. This
 * matches the kit-wide rule: missing i18n must never break playback.
 */
export interface NetworkTranslationLoaderOptions {
	/**
	 * URL pattern containing `{lang}`, replaced with the BCP-47 tag at fetch
	 * time. e.g. `https://cdn.example.com/i18n/{lang}.json`.
	 */
	url: string;

	/** Optional auth config — same pipeline `Plugin.fetch` uses. */
	auth?: AuthConfig;

	/**
	 * Custom parser. Defaults to `JSON.parse` returning the parsed object
	 * cast to `Record<string, string>`. Override to validate / strip / merge
	 * a wrapped envelope before the kit merges the result.
	 */
	parser?: (raw: string) => Record<string, string>;

	/**
	 * Per-call abort signal. Caller-controlled — useful to cancel in-flight
	 * loads when a navigation happens. Distinct from `authFetch`'s internal
	 * retry abort which is owned per-request.
	 */
	signal?: AbortSignal;
}

export type NetworkTranslationLoader = (lang: string) => Promise<Record<string, string> | undefined>;

/**
 * Create a `loadTranslations` function bound to a URL pattern. Returns
 * `undefined` on any network / parse failure so the BCP-47 chain falls
 * through naturally to the parent / fallback language.
 */
export function createNetworkTranslationLoader(opts: NetworkTranslationLoaderOptions): NetworkTranslationLoader {
	const parser = opts.parser ?? ((raw: string): Record<string, string> => {
		const parsed: unknown = JSON.parse(raw);
		return (parsed !== null && typeof parsed === 'object') ? parsed as Record<string, string> : {};
	});

	return async (lang: string) => {
		const url = opts.url.replace(/\{lang\}/g, encodeURIComponent(lang));
		// authFetch requires a non-optional signal — provide a fresh one when
		// the caller didn't supply one. Caller-provided signal still wins.
		const signal = opts.signal ?? new AbortController().signal;
		try {
			const result = await authFetch<Record<string, string>>({
				url,
				auth: opts.auth,
				parser,
				signal,
				scope: 'silent',
				emit: () => { /* silent loader — no event emission */ },
				pluginId: 'translator',
			});
			// Defensive: any non-object response (e.g. server returns a string
			// or an array) shouldn't crash the merge.
			if (!result || typeof result !== 'object' || Array.isArray(result))
				return undefined;
			return result;
		}
		catch {
			return undefined;
		}
	};
}
