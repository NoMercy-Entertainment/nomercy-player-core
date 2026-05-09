/**
 * Vite plugin shipped by the kit. Rewrites the clean form
 *
 * ```ts
 * static translations = translationsFromGlob('./i18n/*.ts');
 * ```
 *
 * into the form Vite's static analyser can process at build time:
 *
 * ```ts
 * static translations = translationsFromGlob(
 *   import.meta.glob('./i18n/*.ts'),
 * );
 * ```
 *
 * Note: NO `{ eager: true }`. The glob produces a `Record<path, () => Promise<module>>`
 * of lazy loaders. The runtime helper detects this and stamps a marker on
 * the result so the kit's plugin registration only fetches the bundle for
 * the active language (and its BCP-47 parents). Chinese never gets loaded
 * when the user wants Dutch.
 *
 * Why a transform plugin? `import.meta.glob` requires a string literal at
 * the call site — Vite scans the source tree for that exact pattern. A
 * helper that takes a path string can't lift it through a normal call. So
 * this plugin lifts it for us, AOT, leaving consumers with the clean API.
 *
 * Wire it into your `vite.config.ts` / `vitest.config.ts`:
 *
 * ```ts
 * import { defineConfig } from 'vitest/config';
 * import { nomercyTranslationsPlugin } from '@nomercy-entertainment/nomercy-player-core/vite-plugin';
 *
 * export default defineConfig({
 *   plugins: [nomercyTranslationsPlugin()],
 *   …
 * });
 * ```
 *
 * The plugin only touches files that actually call `translationsFromGlob`
 * with a literal string — every other file passes through untouched.
 */

export interface NomercyTranslationsPluginOptions {
	/**
	 * File patterns to scan. Defaults to TS / TSX / JS / JSX / MJS / CJS.
	 * Override only if your project uses different extensions.
	 */
	include?: RegExp;

	/**
	 * Helper-name override. Defaults to `translationsFromGlob`. Useful when a
	 * project has shadowed the helper or imports it under an alias.
	 */
	helperName?: string;
}

/**
 * Source-shape this plugin rewrites:
 *
 *   translationsFromGlob('./i18n/*.ts')
 *   translationsFromGlob("./i18n/*.ts")
 *   translationsFromGlob(`./i18n/*.ts`)
 *   translationsFromGlob(  '<pattern>'  )       // any whitespace
 *
 * Multiple calls in the same file are all rewritten. Calls already in the
 * lifted form (`translationsFromGlob(import.meta.glob(...))`) are left alone.
 */
function buildPattern(helperName: string): RegExp {
	// Escape any regex metacharacters in the helper name.
	const safe = helperName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(
		`${safe}\\s*\\(\\s*(['"\`])([^'"\`]+)\\1\\s*\\)`,
		'g',
	);
}

export function nomercyTranslationsPlugin(opts: NomercyTranslationsPluginOptions = {}): {
	name: string;
	enforce: 'pre';
	transform: (code: string, id: string) => { code: string; map: null } | null;
} {
	const include = opts.include ?? /\.(?:tsx?|jsx?|mjs|cjs)$/u;
	const helperName = opts.helperName ?? 'translationsFromGlob';
	const pattern = buildPattern(helperName);

	return {
		name: 'nomercy:translations-from-glob',
		// `'pre'` so the rewrite runs BEFORE Vite's import.meta.glob analyser
		// — otherwise the analyser sees the clean form and skips the file.
		enforce: 'pre' as const,

		transform(code: string, id: string) {
			if (!include.test(id))
				return null;
			if (!code.includes(`${helperName}(`))
				return null;

			pattern.lastIndex = 0;
			const next = code.replace(pattern, (_, quote: string, glob: string) => {
				// NO `eager: true` — let the runtime helper stamp lazy markers
				// so only the active language's bundle is fetched.
				return `${helperName}(import.meta.glob(${quote}${glob}${quote}))`;
			});

			if (next === code)
				return null;
			return {
				code: next,
				map: null,
			};
		},
	};
}
