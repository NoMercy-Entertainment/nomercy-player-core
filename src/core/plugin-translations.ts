// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { PluginCtorWithId, Translations } from '../types';

import { bcp47FallbackChain } from '../adapters/language-matcher/bcp47';
import { getLazyTranslationLoader } from '../adapters/translator/loaders/translations-glob';

/**
 * Walk a plugin constructor's prototype chain and merge every ancestor's
 * `static translations` for the given language's BCP-47 fallback chain. Eager
 * bundles are merged directly; lazy bundles (stamped by `translationsFromGlob`)
 * are fetched tag-by-tag so only the active language and its parents ever
 * enter memory — Chinese never loads when the user wants Dutch.
 *
 * Single source of truth for this walk: `_registerPlugin`
 * (`plugin-registration.ts`) calls this on the real registration path, and the
 * `describePlugin` conformance harness (`testing/describe-plugin.ts`) calls it
 * too, so `this.t()` behaves identically in tests and production. Before this
 * was extracted, the harness skipped the merge entirely and plugin methods
 * using `this.t()` returned the raw key under `describePlugin`.
 *
 * Returns synchronously (`undefined`) — no ancestor in the chain declares a
 * lazy bundle, so every merge already ran before this returns. Returns a
 * `Promise<void>` only when at least one ancestor's bundle needs a real fetch.
 * Same `void | Promise<void>` shape as `Plugin.use()` — callers check
 * `instanceof Promise` the same way. This split matters: always returning a
 * `Promise` (even an already-resolved one) would force an extra microtask
 * tick onto EVERY plugin registration, turning fully-synchronous plugins
 * (no lazy translations, synchronous `use()`) into ones that no longer finish
 * registering within the same tick as `addPlugin()` — breaking every test
 * that calls `addPlugin()` then immediately asserts a synchronous side effect.
 */
export function loadPluginStaticTranslations(
	ctor: PluginCtorWithId,
	language: string,
	addTranslations: (bundle: Translations) => void,
	onLangLoaded?: (tag: string) => void,
): void | Promise<void> {
	const stack: Translations[] = [];
	let cur: unknown = ctor;
	while (cur && cur !== Function.prototype) {
		if (Object.hasOwn(cur, 'translations')) {
			const withTranslations = cur as { translations?: Translations };
			if (withTranslations.translations)
				stack.unshift(withTranslations.translations);
		}
		cur = Object.getPrototypeOf(cur);
	}

	if (stack.every(bundle => !getLazyTranslationLoader(bundle))) {
		for (const translationBundle of stack) {
			addTranslations(translationBundle);
		}
		return undefined;
	}

	return _loadSequentially(stack, language, addTranslations, onLangLoaded);
}

/**
 * The genuinely-async path — at least one ancestor bundle is lazy. Walks the
 * stack STRICTLY in order (base first, most-derived last) so a lazy
 * ancestor's fetch and an eager descendant's merge land in the same relative
 * order they would have in the all-eager case — the descendant still wins a
 * same-key collision regardless of which ancestors are lazy.
 */
async function _loadSequentially(
	stack: Translations[],
	language: string,
	addTranslations: (bundle: Translations) => void,
	onLangLoaded?: (tag: string) => void,
): Promise<void> {
	const langChain = bcp47FallbackChain(language);

	for (const translationBundle of stack) {
		const lazy = getLazyTranslationLoader(translationBundle);
		if (!lazy) {
			addTranslations(translationBundle);
			continue;
		}

		for (const tag of langChain) {
			const bundle = await lazy(tag);
			if (!bundle)
				continue;
			addTranslations({ [tag]: bundle });
			onLangLoaded?.(tag);
		}
	}
}
