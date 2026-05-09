/**
 * Build a `ResolvedUrl` from a (possibly transformed) URL string.
 *
 * Handles three input shapes:
 *  - Absolute (`https://...`, `blob:...`, `data:...`) — parsed via `new URL`.
 *  - Relative with a `baseUrl` available — parsed via `new URL(url, baseUrl)`.
 *  - Relative with no base — falls back to a manual parse so plugins still
 *    get a usable `pathname`, `search`, `hash`, and `ext`. Marked
 *    `relative: true` so callers can decide what to do with it.
 *
 * Never throws. A genuinely malformed URL returns a best-effort form with
 * `relative: true` and `href === raw`.
 */

import type { ResolvedUrl } from './types';

const EXT_RE = /\.([a-z0-9]+)$/iu;

function extractExt(pathname: string): string {
	const match = EXT_RE.exec(pathname);
	return match ? match[1]!.toLowerCase() : '';
}

function fromURL(raw: string, parsed: URL): ResolvedUrl {
	const ext = extractExt(parsed.pathname);
	return {
		raw,
		href: parsed.href,
		scheme: parsed.protocol.replace(/:$/u, ''),
		origin: parsed.origin === 'null' ? '' : parsed.origin,
		pathname: parsed.pathname,
		ext,
		search: parsed.search,
		searchParams: parsed.searchParams,
		hash: parsed.hash,
		relative: false,
		toString: () => parsed.href,
	};
}

function fromManual(raw: string, transformed: string): ResolvedUrl {
	// Strip hash, then search, then keep the path.
	const hashIdx = transformed.indexOf('#');
	const hash = hashIdx >= 0 ? transformed.slice(hashIdx) : '';
	const noHash = hashIdx >= 0 ? transformed.slice(0, hashIdx) : transformed;

	const searchIdx = noHash.indexOf('?');
	const search = searchIdx >= 0 ? noHash.slice(searchIdx) : '';
	const pathname = searchIdx >= 0 ? noHash.slice(0, searchIdx) : noHash;

	const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
	const ext = extractExt(pathname);

	return {
		raw,
		href: transformed,
		scheme: '',
		origin: '',
		pathname,
		ext,
		search,
		searchParams: params,
		hash,
		relative: true,
		toString: () => transformed,
	};
}

export function buildResolvedUrl(raw: string, transformed: string, baseUrl?: string): ResolvedUrl {
	// Try parsing the transformed form directly first.
	try {
		const parsed = new URL(transformed);
		return fromURL(raw, parsed);
	}
	catch {
		// Fall through to base-relative.
	}

	if (baseUrl) {
		try {
			const parsed = new URL(transformed, baseUrl);
			return fromURL(raw, parsed);
		}
		catch {
			// Fall through to manual parse.
		}
	}

	return fromManual(raw, transformed);
}
