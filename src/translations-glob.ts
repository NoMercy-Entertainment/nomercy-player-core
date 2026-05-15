import type { Translations } from './types';
import { StateError } from './errors';

/**
 * Internal marker stamped on the object returned by `translationsFromGlob`
 * when the input modules are lazy (function loaders). The kit's plugin
 * registration / language switch paths read this marker to invoke the
 * loader on demand instead of pulling every language into memory.
 *
 * Exported for the kit's own use; plugin authors never reference it.
 */
export const LAZY_TRANSLATIONS_MARKER = Symbol.for('nomercy.translations.lazy');

/**
 * Module shape produced by `import.meta.glob('./i18n/*.ts', { eager: true })`.
 * Each module either default-exports the bundle (preferred) OR exports it
 * as a named export — both shapes are accepted.
 */
export type GlobModule
	= | { default?: Record<string, string> }
		| Record<string, unknown>;

export type GlobLazyLoader = () => Promise<GlobModule>;

/**
 * The lazy loader stamped on a `Translations` object — given a language
 * tag, returns the bundle for that language (or `undefined` if no file
 * exists for that tag). Wired by the kit's plugin chain registration so
 * we only fetch what the active language needs.
 */
export type LazyTranslationLoader = (lang: string) => Promise<Record<string, string> | undefined>;

/**
 * Convention-driven translation discovery. Plugin authors organise their
 * i18n as one file per language under `i18n/<tag>.ts`:
 *
 * ```text
 * plugins/my-plugin/
 *   index.ts
 *   i18n/
 *     en.ts          # export default { 'plugin.my-plugin.foo': 'Foo' }
 *     nl.ts          # export default { 'plugin.my-plugin.foo': 'Foo NL' }
 *     pt-BR.ts       # export default { 'plugin.my-plugin.foo': 'Foo BR' }
 * ```
 *
 * In the plugin file:
 *
 * ```ts
 * static override readonly translations = translationsFromGlob('./i18n/*.ts');
 * ```
 *
 * The kit's Vite plugin (`nomercyTranslationsPlugin`) lifts the literal
 * pattern into Vite's static `import.meta.glob` analyser at build time, so
 * the call above is rewritten to:
 *
 * ```ts
 * translationsFromGlob(import.meta.glob('./i18n/*.ts'))
 * ```
 *
 * before Vite scans for globs. Note the absence of `{ eager: true }` —
 * lazy by default. The runtime helper detects function-valued module maps
 * and stamps a `LAZY_TRANSLATIONS_MARKER` on the result so the kit only
 * fetches the bundle for the active language (and its BCP-47 parents).
 * Chinese never gets loaded when the user wants Dutch.
 *
 * The eager form (modules pre-resolved at import time) is also accepted —
 * useful for tests or for translations that are tiny and always-needed.
 */
export function translationsFromGlob(input: string): Translations;
export function translationsFromGlob(modules: Record<string, GlobModule | GlobLazyLoader>): Translations;
export function translationsFromGlob(
	input: string | Record<string, GlobModule | GlobLazyLoader>,
): Translations {
	if (typeof input === 'string') {
		throw new StateError({
			code: 'core:state/vite-plugin-not-configured',
			severity: 'fatal',
			scope: { kind: 'core' },
			message: `translationsFromGlob('${input}') was called with a literal string — the kit's Vite plugin (\`nomercyTranslationsPlugin\`) is not configured.`,
			suggestion: 'Add it to your vite.config / vitest.config: import { nomercyTranslationsPlugin } from \'@nomercy-entertainment/nomercy-player-core/vite-plugin\'; plugins: [nomercyTranslationsPlugin()].',
			context: { pattern: input },
		});
	}

	const entries = Object.entries(input);
	const isLazy = entries.some(([, mod]) => typeof mod === 'function');

	if (isLazy) {
		return buildLazy(entries as Array<[string, GlobLazyLoader | GlobModule]>);
	}
	return buildEager(entries as Array<[string, GlobModule]>);
}

/** Eager path — every module is already imported; extract and merge bundles directly. */
function buildEager(entries: Array<[string, GlobModule]>): Translations {
	const out: Translations = {};
	for (const [path, mod] of entries) {
		const tag = pathToTag(path);
		if (!tag)
			continue;
		const bundle = extractBundle(mod, tag);
		if (!bundle)
			continue;
		out[tag] = {
			...(out[tag] ?? {}),
			...bundle,
		};
	}
	return out;
}

/**
 * Lazy path — modules are `() => Promise<bundle>` loaders. Returns an
 * empty `Translations` object stamped with the lazy marker so the kit's
 * plugin registration and language-switch paths invoke the loader on demand
 * rather than pulling every language into memory up front.
 */
function buildLazy(entries: Array<[string, GlobLazyLoader | GlobModule]>): Translations {
	// Map tag → loader so lookup is O(1) at runtime.
	const tagToLoader = new Map<string, GlobLazyLoader>();
	for (const [path, mod] of entries) {
		const tag = pathToTag(path);
		if (!tag)
			continue;
		// Eager entries in a mixed map are wrapped so the lazy loader can
		// await them uniformly — avoids a branch at lookup time.
		if (typeof mod === 'function')
			tagToLoader.set(tag, mod as GlobLazyLoader);
		else tagToLoader.set(tag, () => Promise.resolve(mod as GlobModule));
	}

	const loader: LazyTranslationLoader = async (lang: string) => {
		const fn = tagToLoader.get(lang);
		if (!fn)
			return undefined;
		try {
			const mod = await fn();
			return extractBundle(mod, lang) ?? undefined;
		}
		catch {
			return undefined;
		}
	};

	const out: Translations = {};
	Object.defineProperty(out, LAZY_TRANSLATIONS_MARKER, {
		value: loader,
		enumerable: false,
		configurable: false,
		writable: false,
	});
	// Also expose the list of available tags so consumers / debug tooling
	// can know what's shippable without invoking every loader.
	Object.defineProperty(out, '__nomercyAvailableTags', {
		value: Array.from(tagToLoader.keys()),
		enumerable: false,
		configurable: false,
		writable: false,
	});
	return out;
}

/** `./i18n/pt-BR.ts` → `pt-BR`. `i18n/index.ts` → null (skipped). */
function pathToTag(path: string): string | null {
	const match = path.match(/([^/\\]+)\.[a-z0-9]+$/iu);
	if (!match)
		return null;
	const tag = match[1]!;
	if (tag === 'index')
		return null;
	return tag;
}

/**
 * Pull a flat `Record<string, string>` out of a module. Default export
 * wins; falls back to a named export matching the language tag (older
 * convention). Drops non-string values so a malformed file can't poison
 * the table.
 */
function extractBundle(mod: GlobModule, tag: string): Record<string, string> | null {
	if (!mod || typeof mod !== 'object')
		return null;
	const candidate = (mod as { default?: unknown }).default
		?? (mod as Record<string, unknown>)[tag];
	if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
		return null;

	const bundle: Record<string, string> = {};
	for (const [k, v] of Object.entries(candidate as Record<string, unknown>)) {
		if (typeof v === 'string')
			bundle[k] = v;
	}
	return bundle;
}

/**
 * Read the lazy loader off a `Translations`-shaped object. Returns null
 * for eager bundles. Used by the kit's plugin chain registration — plugin
 * authors don't call this.
 */
export function getLazyTranslationLoader(t: Translations): LazyTranslationLoader | null {
	const v = (t as unknown as { [k: symbol]: unknown })[LAZY_TRANSLATIONS_MARKER];
	return typeof v === 'function' ? (v as LazyTranslationLoader) : null;
}
