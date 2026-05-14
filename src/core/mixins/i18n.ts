import type { Translations } from '../../types';
import { bcp47FallbackChain, DefaultTranslator } from '../../translator';
import type { ITranslator } from '../../translator';
import { getLazyTranslationLoader } from '../../translations-glob';

import type { Internals } from '../state';
import { markPluginLangLoaded, pluginLangLoadedSet } from '../util/register-plugin';


// ──────────────────────────────────────────────────────────────────────────
// Private helpers — only used by i18nMethods
// ──────────────────────────────────────────────────────────────────────────

function _ensureTranslator(self: Internals): ITranslator {
	if (!self._translator)
		self._translator = new DefaultTranslator();
	return self._translator;
}

function _hasPluginLangLoaded(self: Internals, pluginId: string, lang: string): boolean {
	return pluginLangLoadedSet(self)?.has(`${pluginId}::${lang}`) ?? false;
}

type _LoadTranslationsFn = (lang: string) => Promise<Record<string, string> | undefined>;

function _getLoadTranslations(instance: unknown): _LoadTranslationsFn | undefined {
	if (typeof instance !== 'object' || instance === null)
		return undefined;
	if (!('loadTranslations' in instance))
		return undefined;
	const fn: unknown = (instance as { loadTranslations: unknown }).loadTranslations;
	return typeof fn === 'function' ? (fn as _LoadTranslationsFn) : undefined;
}


// ──────────────────────────────────────────────────────────────────────────
// Mixin: i18n
// ──────────────────────────────────────────────────────────────────────────

export const i18nMethods = {
	t(this: Internals, key: string, vars?: Record<string, string>): string {
		return _ensureTranslator(this).t(key, vars);
	},
	language(this: Internals, lang?: string): string | Promise<void> {
		if (lang === undefined) return _ensureTranslator(this).language();
		return (async () => {
			await _ensureTranslator(this).language(lang);
			// Walk the BCP-47 chain on language switch — `pt-BR` triggers loads
			// for both `pt-BR` and `pt`, so regional variants get the parent
			// bundle in memory as natural fallback.
			const langChain = bcp47FallbackChain(lang);

			for (const { instance, ctor } of this._plugins) {
				const pluginId = ctor.id;

				// (1) Lazy `static translations` chain — pull bundles for every
				// tag in the BCP-47 chain that hasn't been loaded yet. Walks the
				// prototype chain so subclass + base lazy bundles both get hit.
				let cur: unknown = ctor;
				while (cur && cur !== Function.prototype) {
					if (Object.prototype.hasOwnProperty.call(cur, 'translations')) {
						const withT = cur as { translations?: Translations };
						const lazy = withT.translations ? getLazyTranslationLoader(withT.translations) : undefined;
						if (lazy) {
							for (const tag of langChain) {
								if (_hasPluginLangLoaded(this, pluginId, tag))
									continue;
								try {
									const bundle = await lazy(tag);
									markPluginLangLoaded(this, pluginId, tag);
									if (!bundle)
										continue;
									// Static bundles include the `plugin.<id>.` prefix already.
									this.addTranslations({ [tag]: bundle });
								}
								catch (err) {
									if (typeof console !== 'undefined' && console.error) {
										console.error(`[language] plugin "${pluginId}" lazy translations threw:`, err);
									}
								}
							}
						}
					}
					cur = Object.getPrototypeOf(cur);
				}

				// (2) Spec §U: instance-level `loadTranslations(lang)` hook —
				// runtime sources (CDN, dynamic JSON). Per-plugin+lang dedupe.
				// loadTranslations is protected — reflect via unknown to bypass visibility without widening to any.
				const hook = _getLoadTranslations(instance);
				if (typeof hook !== 'function')
					continue;
				if (_hasPluginLangLoaded(this, pluginId, lang))
					continue;
				try {
					const bundle = await hook.call(instance, lang);
					markPluginLangLoaded(this, pluginId, lang);
					if (!bundle)
						continue;
					const namespaced: Record<string, string> = {};
					for (const [key, value] of Object.entries(bundle)) {
						namespaced[`plugin.${pluginId}.${key}`] = value;
					}
					this.addTranslations({ [lang]: namespaced });
				}
				catch (err) {
					if (typeof console !== 'undefined' && console.error) {
						console.error(`[language] plugin "${pluginId}".loadTranslations threw:`, err);
					}
				}
			}
		})();
	},
	addTranslations(this: Internals, bundle: Translations): void {
		_ensureTranslator(this).addTranslations(bundle);
	},
	/**
	 * Read or write a single translation key.
	 *
	 * `translation(lang, key)` — returns the resolved translation string for
	 * the given language and key, or the key itself when no value is found.
	 *
	 * `translation(lang, key, value)` — set a single key under a single
	 * language. Persists for the player's lifetime.
	 */
	translation(this: Internals, lang: string, key: string, value?: string): string | undefined | void {
		if (value === undefined) {
			return _ensureTranslator(this).translation(lang, key);
		}
		_ensureTranslator(this).translation(lang, key, value);
	},
	removeTranslations(this: Internals, prefix: string, lang?: string): void {
		_ensureTranslator(this).removeTranslations(prefix, lang);
	},
} as const;
