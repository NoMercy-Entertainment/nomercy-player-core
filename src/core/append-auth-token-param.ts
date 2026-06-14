// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Appends the raw JWT as `access_token=<token>` to a URL query string.
 *
 * The media server's `TokenParamAuthMiddleware` accepts `access_token` (or
 * `token`) and expects the raw JWT — no `Bearer ` prefix.
 *
 * `<audio>` / `<video>` element src cannot carry an Authorization header, so
 * non-HLS and native-HLS-fallback sources must embed the token in the URL
 * instead of the header.
 *
 * @param url          - The source URL to annotate.
 * @param headerValue  - The value returned by `_authHeaderProvider()`, e.g.
 *                       `"Bearer eyJ…"`. A `Bearer ` prefix (case-insensitive)
 *                       is stripped automatically. Pass `undefined` when no auth
 *                       provider is wired — the original URL is returned as-is.
 * @returns The URL with `access_token=<rawJwt>` appended, or the original URL
 *          when `headerValue` is absent.
 */
export function appendAuthTokenParam(url: string, headerValue: string | undefined): string {
	if (!headerValue) {
		return url;
	}

	const rawToken = headerValue.replace(/^Bearer\s+/i, '');

	const separator = url.includes('?') ? '&' : '?';

	return `${url}${separator}access_token=${encodeURIComponent(rawToken)}`;
}
