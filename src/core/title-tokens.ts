// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { ITranslator } from '../adapters/translator/ITranslator';

/**
 * Registry mapping a single uppercase or lowercase letter to the translation
 * key that resolves the token's display text.
 *
 * Example (video player registers these):
 *   { S: 'plugin.desktop-ui.token.season', E: 'plugin.desktop-ui.token.episode' }
 *
 * Core ships with an empty default. Each per-library player calls
 * `registerTitleTokens()` to populate its own instance registry.
 */
export type TokenRegistry = Readonly<Record<string, string>>;

/**
 * A single compiled pattern covers every `%<LETTER><digits>` token.
 * Letters not in the registry are left verbatim, so an empty registry is
 * a guaranteed no-op.
 */
const TOKEN_RE = /%([A-Z])(\d+)/gi;

/**
 * Replace every `%<LETTER><digits>` token in `text` whose letter appears in
 * `registry` with the locale-aware string from `translator.t()`. Tokens whose
 * letter is absent from the registry, or any token when `translator` is
 * `undefined`, are left verbatim. Surrounding text is preserved exactly.
 *
 * Contract:
 *  - Idempotent: already-resolved text contains no `%<LETTER><digits>` tokens,
 *    so re-processing is safe.
 *  - No-throw: an absent translator or an empty registry both short-circuit
 *    without error.
 *  - Empty input returns the empty string unchanged.
 */
export function interpolateTitleTokens(
	text: string,
	translator: ITranslator | undefined,
	registry: TokenRegistry,
): string {
	if (!text)
		return text;

	const hasEntries = Object.keys(registry).length > 0;
	if (!hasEntries || !translator)
		return text;

	TOKEN_RE.lastIndex = 0;

	return text.replace(TOKEN_RE, (_match: string, letter: string, digits: string): string => {
		const key = registry[letter];
		if (!key)
			return _match;

		return translator.t(key, { number: digits });
	});
}
