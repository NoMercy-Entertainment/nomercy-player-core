import type { AuthConfig } from '../../types/config';

/**
 * Hint passed to a `IUrlResolver` so custom implementations can branch on
 * the *consumer* of the URL — for example, only signing media URLs with
 * a CDN-specific token while leaving poster URLs untouched. Always a
 * lowercase string. Built-in callers use:
 *
 *  - `'media'`       — main playable URL (audio / video)
 *  - `'subtitle'`    — subtitle / caption URL
 *  - `'font'`        — font asset for libass
 *  - `'poster'`      — artwork / thumbnail
 *  - `'sprite'`      — sprite-VTT preview thumbnail strip
 *  - `'lyrics'`      — lyrics / LRC URL
 *  - `'cast'`        — URL handed to a Cast / AirPlay receiver
 *  - `'license'`     — DRM license URL
 *
 * Custom plugins may pass any string they like; the resolver should treat
 * unknown categories as a passthrough.
 */
export type UrlCategory = 'media' | 'subtitle' | 'font' | 'poster' | 'sprite' | 'lyrics' | 'cast' | 'license' | (string & {});

/**
 * Structured URL returned by `player.resolveUrl(url)`. Contains the
 * post-`auth.transformUrl` form parsed into useful parts:
 *
 *  - `href` — the final URL string. Pass this to Workers / `<video>.src` /
 *    Cast receiver / etc.
 *  - `raw` — the unparsed input as supplied by the caller.
 *  - `scheme`, `origin`, `pathname`, `search`, `hash` — standard URL components.
 *  - `searchParams` — query-string accessor (`searchParams.get('token')`).
 *  - `ext` — lowercase file extension stripped of query/fragment, no leading
 *    dot. Empty string when the URL has no extension. **Use this** to gate
 *    on file type — `.split('.').pop()` smears across query strings.
 *  - `relative` — `true` when the input was relative and no `baseUrl` was
 *    available to absolutize against. `href` will be the relative form.
 *  - `toString()` — returns `href`, so template strings work transparently.
 */
export interface ResolvedUrl {
	readonly raw: string;
	readonly href: string;
	readonly scheme: string;
	readonly origin: string;
	readonly pathname: string;
	readonly ext: string;
	readonly search: string;
	readonly searchParams: URLSearchParams;
	readonly hash: string;
	readonly relative: boolean;
	toString(): string;
}

/**
 * Context handed to a custom `IUrlResolver`. Provides everything a custom
 * resolver might need to make a routing decision without reaching into
 * private player state — auth config, baseUrl, the category hint, and a
 * fallback to the built-in resolver so custom resolvers can short-circuit
 * for some categories and delegate the rest.
 */
export interface UrlResolverContext {
	readonly auth: AuthConfig | undefined;
	readonly baseUrl: string | undefined;
	readonly category: UrlCategory;
	/** Built-in resolver (auth.transformUrl + buildResolvedUrl). */
	readonly defaultResolve: (url: string) => Promise<ResolvedUrl>;
}

/**
 * Pluggable URL resolver. Consumer-supplied via `setup({ urlResolver })`
 * or `setUrlResolver(fn)` at runtime. Returns a `ResolvedUrl` describing
 * the final form to hand to a non-`fetch()` consumer (Worker, `<video>.src`,
 * Cast receiver, MediaSource, ...).
 *
 * The default implementation applies `auth.transformUrl` and parses the
 * result with `buildResolvedUrl`. Custom resolvers replace that logic
 * wholesale — to extend rather than replace, call `ctx.defaultResolve`.
 *
 * Modeled as an interface (not a function-type alias) so consumers can
 * declaration-merge custom resolver shapes and tooling can pick up doc
 * comments on the call signature.
 */
export interface IUrlResolver {
	(url: string, ctx: UrlResolverContext): Promise<ResolvedUrl> | ResolvedUrl;
}
