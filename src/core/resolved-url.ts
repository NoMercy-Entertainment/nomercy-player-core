// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { ResolvedUrl } from '../types';

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

/**
 * Build a `ResolvedUrl` from a raw URL string and its (possibly transformed)
 * form, optionally resolved against a base.
 *
 * Three input shapes are handled, tried in order:
 *
 * 1. **Absolute** — `transformed` is parseable by `new URL` alone
 *    (e.g. `https://…`, `blob:…`, `data:…`). `relative` is `false`.
 * 2. **Base-relative** — `transformed` is relative but `baseUrl` is supplied,
 *    so `new URL(transformed, baseUrl)` succeeds. `relative` is `false`.
 * 3. **Bare relative** — no base is available. The path, search, hash, and
 *    extension are extracted with a manual string parse so plugins still get
 *    usable fields. `relative` is `true` and `scheme`/`origin` are empty
 *    strings. Callers should inspect `relative` before making decisions that
 *    require an absolute URL.
 *
 * Never throws. A genuinely malformed input returns a best-effort result
 * with `relative: true` and `href === transformed`.
 *
 * @param raw         The URL as it appeared before any transformation
 *                    (e.g. before auth tokens were injected). Stored on the
 *                    result as `raw` for logging and caching purposes.
 * @param transformed The URL actually passed to the backend. May equal `raw`
 *                    when no transformation is applied.
 * @param baseUrl     Optional base for resolving relative `transformed` strings.
 */
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
