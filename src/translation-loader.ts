import type { AuthConfig } from './types';
import { authFetch } from './auth-fetch';

/**
 * Options for the built-in network translation loader. Wire it into
 * `setup({ loadTranslations })`:
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
 * The `{lang}` placeholder in `url` is replaced per-call with the
 * BCP-47 tag being fetched. `DefaultTranslator` calls the loader once per
 * tag in the fallback chain (`pt-BR` then `pt`), so the URL template only
 * needs to handle the exact tag form — e.g. `i18n/pt-BR.json`,
 * `i18n/pt.json`.
 *
 * Network failures (404 for a regional variant the CDN doesn't ship,
 * timeout, parse error) resolve to `undefined`. The translator treats
 * `undefined` as "no bundle for this tag" and continues to the next tag
 * in the chain. Missing i18n must never break playback.
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
	 * Custom parser applied to the raw response text before the kit merges
	 * the result. Defaults to `JSON.parse`. Override to validate, strip
	 * envelope wrappers, or coerce non-flat shapes your CDN returns.
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
 * Build a `loadTranslations` callback bound to the given URL pattern and
 * optional auth config. The returned function fetches one JSON bundle per
 * language tag and returns `undefined` on any network or parse failure so
 * the BCP-47 chain continues to the parent tag without interruption.
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
				emit: () => { },
				pluginId: 'translator',
			});
			if (!result || typeof result !== 'object' || Array.isArray(result))
				return undefined;
			return result;
		}
		catch {
			return undefined;
		}
	};
}
