import type { ITranslator } from '../../adapters/translator/translator';
import type { PluginCtorWithId, Translations } from '../../types';
import type { Internals } from '../state';
import { bcp47FallbackChain } from '../../adapters/language-matcher/bcp47';
import { getLazyTranslationLoader } from '../../adapters/translator/loaders/translations-glob';

import { DefaultTranslator } from '../../adapters/translator/translator';

/**
 * The i18n mixin's slice of player state — composed into `PlayerCoreState`.
 * Declared here, beside the methods that write the active translator (the
 * setup-stage seed in `lifecycle.ts` is the i18n concern too).
 */
export interface I18nState {
	/**
	 * Active translator instance. Written by `i18nMethods` during `setup()` and
	 * whenever `language()` triggers a bundle load. `undefined` until the first
	 * translation bundle resolves; kit code that calls `this.t(...)` guards on
	 * this before forwarding.
	 */
	_translator: ITranslator | undefined;
}

// ──────────────────────────────────────────────────────────────────────────
// Private helpers — only used by i18nMethods
// ──────────────────────────────────────────────────────────────────────────

function _ensureTranslator(self: Internals): ITranslator {
	if (!self._translator)
		self._translator = new DefaultTranslator();
	return self._translator;
}

function _hasPluginLangLoaded(self: Internals, pluginId: string, lang: string): boolean {
	return self._pluginLangLoadedSet()?.has(`${pluginId}::${lang}`) ?? false;
}

type _LoadTranslationsFn = (lang: string) => Promise<Record<string, string> | undefined>;

function _getLoadTranslations(instance: unknown): _LoadTranslationsFn | undefined {
	if (typeof instance !== 'object' || instance === null)
		return undefined;
	if (!('loadTranslations' in instance))
		return undefined;
	// loadTranslations is protected — reflect via unknown to avoid widening to any.
	const fn: unknown = (instance as { loadTranslations: unknown }).loadTranslations;
	return typeof fn === 'function' ? (fn as _LoadTranslationsFn) : undefined;
}

// ──────────────────────────────────────────────────────────────────────────
// Mixin: i18n
// ──────────────────────────────────────────────────────────────────────────

export const i18nMethods = {
	/**
	 * Translate a key using the active language.
	 *
	 * `t(key, vars?)` — bare-key form. `key` is looked up verbatim; `{var}`
	 * placeholders in the template are replaced from `vars` when provided.
	 * Returns `key` itself when no translation is registered for it.
	 *
	 * `t(PluginClass, key, vars?)` — class-typed form. Prepends `plugin.<id>.`
	 * to `key` automatically so plugins never hand-roll the namespace prefix.
	 * `PluginClass.id` is the canonical id read from the static field.
	 *
	 * Both forms delegate to `_ensureTranslator(this).t(...)` and share the
	 * same fallback behaviour (return the fully-qualified key on miss).
	 */
	t(this: Internals, keyOrClass: string | PluginCtorWithId, keyOrVars?: string | Record<string, string>, vars?: Record<string, string>): string {
		if (typeof keyOrClass === 'string') {
			return _ensureTranslator(this).t(keyOrClass, keyOrVars as Record<string, string> | undefined);
		}

		const pluginId = keyOrClass.id;
		const key = keyOrVars as string;
		const namespacedKey = `plugin.${pluginId}.${key}`;
		return _ensureTranslator(this).t(namespacedKey, vars);
	},

	/**
	 * Read or set the active language.
	 *
	 * `language()` — returns the current BCP-47 language tag (e.g. `'en'`,
	 * `'pt-BR'`).
	 *
	 * `language(tag)` — switch to `tag`. Returns a `Promise<void>` that
	 * resolves once all plugin translation bundles for the tag (and its BCP-47
	 * parent chain) have been loaded. `pt-BR` triggers loads for both `pt-BR`
	 * and `pt` so regional variants get the parent bundle as natural fallback.
	 *
	 * Plugin bundles are loaded in two passes per language switch:
	 *
	 * 1. Static `translations` — lazy-loaded bundle files declared on the
	 *    plugin class (walks the prototype chain so subclass + base bundles
	 *    both get hit). Bundles include the `plugin.<id>.` key prefix already.
	 *
	 * 2. Instance `loadTranslations(lang)` — runtime hook for CDN / dynamic
	 *    JSON sources. Bundles returned here are namespaced automatically under
	 *    `plugin.<id>.`. Each plugin+lang pair is loaded at most once per
	 *    player lifetime.
	 */
	language(this: Internals, lang?: string): string | Promise<void> {
		if (lang === undefined)
			return _ensureTranslator(this).language();
		return (async () => {
			await _ensureTranslator(this).language(lang);
			const langChain = bcp47FallbackChain(lang);

			for (const { instance, ctor } of this._plugins) {
				const pluginId = ctor.id;

				// (1) Lazy `static translations` chain — pull bundles for every
				// tag in the BCP-47 chain that hasn't been loaded yet.
				let cur: unknown = ctor;
				while (cur && cur !== Function.prototype) {
					if (Object.hasOwn(cur, 'translations')) {
						const withT = cur as { translations?: Translations };
						const lazy = withT.translations ? getLazyTranslationLoader(withT.translations) : undefined;
						if (lazy) {
							for (const tag of langChain) {
								if (_hasPluginLangLoaded(this, pluginId, tag))
									continue;
								try {
									const bundle = await lazy(tag);
									this._markPluginLangLoaded(pluginId, tag);
									if (!bundle)
										continue;
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

				// (2) Instance-level `loadTranslations(lang)` hook — runtime
				// sources (CDN, dynamic JSON). Per-plugin+lang dedupe.
				const hook = _getLoadTranslations(instance);
				if (typeof hook !== 'function')
					continue;
				if (_hasPluginLangLoaded(this, pluginId, lang))
					continue;
				try {
					const bundle = await hook.call(instance, lang);
					this._markPluginLangLoaded(pluginId, lang);
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

			this.emit('language', { lang });
		})();
	},

	/**
	 * Merge `bundle` into the translator's in-memory store. `bundle` is a map
	 * of BCP-47 tag → key/value translation pairs. Existing keys are
	 * overwritten; keys not present in `bundle` are retained.
	 */
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

	/**
	 * Remove all translation keys matching `prefix` from the in-memory store.
	 * Pass `lang` to restrict removal to one language; omit to remove across
	 * all languages.
	 */
	removeTranslations(this: Internals, prefix: string, lang?: string): void {
		_ensureTranslator(this).removeTranslations(prefix, lang);
	},
} as const;
