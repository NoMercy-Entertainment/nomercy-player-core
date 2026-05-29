/**
 * An `Authorization` header value — accepted as a static string, a sync
 * getter, or an async getter so Vue refs, signals, and reactive stores all
 * plug in naturally: `bearerToken: () => myStore.token`.
 */
export type AuthHeaderValue = string | (() => string) | (() => Promise<string>);

/**
 * Unified auth pipeline applied to every kit-internal fetch — playlist URLs
 * at setup, lyrics, subtitles, sprite previews, and all `Plugin.fetch` calls.
 *
 * Hard rules baked in:
 *  - **401 (unauthenticated) → may invoke `refreshOnUnauthenticated`, retry once.**
 *  - **403 (unauthorized / forbidden) → propagates immediately. Never refreshed, never retried.**
 *  - The lint pack flags any code that handles 401 and 403 in the same branch.
 */
export interface AuthConfig {
	/**
	 * Convenience for the most common case — value goes into `Authorization: Bearer {value}`.
	 * Accepts a static string, a sync getter, or an async getter so Vue refs, signals, and
	 * reactive stores all work: `auth: { bearerToken: () => myRef.value }`.
	 */
	bearerToken?: AuthHeaderValue;

	/**
	 * Alias for `bearerToken`. Lets consumers use the field name they already know
	 * from the top-level deprecated `accessToken` config: `auth: { accessToken: () => store.token }`.
	 * When both are set, `bearerToken` wins.
	 *
	 * @deprecated Prefer `bearerToken`. This alias exists to ease migration from the
	 * top-level `BasePlayerConfig.accessToken` field.
	 */
	accessToken?: AuthHeaderValue;

	/** Arbitrary headers — static, sync getter, or async getter. */
	headers?: Record<string, AuthHeaderValue>;

	/** `credentials` mode for fetch. Use `'include'` for cookie/session-based auth. */
	credentials?: 'omit' | 'same-origin' | 'include';

	/**
	 * URL rewriter. Runs before fetch. Use this for custom-scheme URLs
	 * (`nmsync://...`), pre-signed URL generation, or any scheme-translation
	 * the consumer needs.
	 */
	transformUrl?: (url: string) => string | Promise<string>;

	/**
	 * Escape hatch — receives the live Request, returns a modified Request.
	 * For HMAC payload signing, AWS Signature v4, custom challenge-response,
	 * anything that doesn't fit the simpler fields above.
	 */
	signRequest?: (request: Request) => Request | Promise<Request>;

	/**
	 * Called ONLY on 401 responses. Implementer refreshes the token. After
	 * this resolves, the kit retries the original request once with the new
	 * `bearerToken` / `headers` values resolved fresh. Never invoked on 403.
	 */
	refreshOnUnauthenticated?: () => Promise<void>;

	/** Default 1. Set to 0 to disable retry-after-refresh entirely. */
	retryAfterRefresh?: number;
}
