import type { AuthConfig, ResolvedUrl, UrlCategory, UrlResolver, UrlResolverContext } from '../../types';
import { buildResolvedUrl } from '../../resolved-url';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: auth runtime — `auth` / `urlResolver` / `refreshAuth`.
// Spec §H. Single source of truth shared by both libraries; the per-library
// stubs that previously lived in `music/index.ts` and `video/index.ts` are
// removed once this mixin is wired into `playerCoreMethods`.
// ──────────────────────────────────────────────────────────────────────────

export const authMethods = {
	/**
	 * Read or write the auth config.
	 *
	 * `auth()` — returns a read-only frozen snapshot of the current auth
	 * config, or `undefined` when none has been set.
	 *
	 * `auth(config)` — replace the auth config wholesale; old fields are gone.
	 * Emits `auth:refreshed` so listeners (cached fetchers, telemetry) re-resolve.
	 *
	 * `auth(partial)` — shallow-merge updates onto the current auth config;
	 * fields not specified are retained. Emits `auth:refreshed`.
	 */
	auth(this: Internals, configOrPartial?: AuthConfig | Partial<AuthConfig>): Readonly<AuthConfig> | undefined | void {
		if (configOrPartial === undefined) {
			if (!this._authConfig)
				return undefined;
			return Object.freeze({ ...this._authConfig });
		}
		const next: AuthConfig = {
			...(this._authConfig ?? {}),
			...configOrPartial,
		};
		this._authConfig = next;
		this.emit('auth:refreshed', { tokenAcquiredAt: Date.now() });
	},

	/** Returns `true` when an auth config is present, `false` otherwise. Does not expose the token. */
	hasAuth(this: Internals): boolean {
		return this._authConfig !== undefined;
	},

	/**
	 * Replace the active auth config wholesale, or pass `null` to clear it.
	 * Emits `auth:refreshed` so listeners re-resolve. Prefer `auth(config)` for
	 * partial updates; use `setAuth` when you need an explicit `null` clear.
	 */
	setAuth(this: Internals, config: AuthConfig | null): void {
		this._authConfig = config ?? undefined;
		this.emit('auth:refreshed', { tokenAcquiredAt: Date.now() });
	},

	/**
	 * Resolve a URL through the configured `urlResolver` (custom-supplied
	 * via `setup({ urlResolver })` / `urlResolver(fn)`) or fall back to
	 * the built-in pipeline (`auth.transformUrl` + `buildResolvedUrl`).
	 *
	 * `category` lets custom resolvers route per consumer ('media',
	 * 'subtitle', 'cast', 'license', ...). Defaults to `'media'`.
	 *
	 * Returned `ResolvedUrl` carries the post-transform `href` plus parsed
	 * parts (origin, pathname, ext, searchParams, ...). Pass `.href` (or
	 * interpolate the object — `toString()` returns `href`) to the consumer.
	 */
	async resolveUrl(this: Internals, url: string, category?: UrlCategory): Promise<ResolvedUrl> {
		const base = this._baseUrl ?? this.options?.baseUrl;
		const auth = this._authConfig;

		const defaultResolve = async (rawUrl: string) => {
			const transformer = auth?.transformUrl;
			const transformed = transformer ? await transformer(rawUrl) : rawUrl;
			return buildResolvedUrl(rawUrl, transformed, base);
		};

		const resolver = this._urlResolver;
		if (!resolver)
			return defaultResolve(url);

		const ctx: UrlResolverContext = {
			auth,
			baseUrl: base,
			category: category ?? 'media',
			defaultResolve,
		};
		const out = await resolver(url, ctx);
		// Defensive: a custom resolver returning a falsy / non-object value
		// shouldn't blow up downstream consumers. Fall back to default.
		if (!out || typeof out !== 'object' || typeof out.href !== 'string') {
			return defaultResolve(url);
		}
		return out;
	},

	/**
	 * Read or write the URL resolver.
	 *
	 * `urlResolver()` — returns the current custom resolver, or `undefined`
	 * when the built-in auth pipeline (`auth.transformUrl` + `buildResolvedUrl`)
	 * is active.
	 *
	 * `urlResolver(fn)` — replace the resolver at runtime. Pass `undefined`
	 * to revert to the built-in default. Takes effect on the next `resolveUrl`
	 * call; fires no event.
	 */
	urlResolver(this: Internals, resolver?: UrlResolver | undefined): UrlResolver | undefined | void {
		if (arguments.length === 0) {
			return this._urlResolver;
		}
		this._urlResolver = resolver;
	},

	/**
	 * Invoke `auth.refreshOnUnauthenticated` if present, then emit
	 * `auth:refreshed { tokenAcquiredAt }`. On failure emits `auth:failed`
	 * (does NOT throw — callers wire to the event for error UI).
	 */
	async refreshAuth(this: Internals): Promise<void> {
		const cfg = this._authConfig;
		const handler = cfg?.refreshOnUnauthenticated;
		if (!handler) {
			this.emit('auth:refreshed', { tokenAcquiredAt: Date.now() });
			return;
		}
		try {
			await handler();
			this.emit('auth:refreshed', { tokenAcquiredAt: Date.now() });
		}
		catch (err) {
			this.emit('auth:failed', { error: err });
		}
	},
} as const;
