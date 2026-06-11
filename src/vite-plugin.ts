/**
 * Options for `nomercyTranslationsPlugin()`.
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
 * Source shapes this plugin rewrites:
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

/**
 * Vite plugin that rewrites the clean `translationsFromGlob` call form into
 * the form Vite's static analyser requires at build time.
 *
 * **Why this exists.** `import.meta.glob` must appear as a string literal at
 * the call site — Vite scans source files for that exact pattern. A helper
 * that accepts a path string cannot lift the literal through a normal function
 * call. This plugin does the lifting ahead-of-time so consumers write the
 * clean form and Vite sees the expanded form.
 *
 * **Lazy by design.** The rewrite omits `{ eager: true }`. The glob produces
 * `Record<path, () => Promise<module>>` lazy loaders. The runtime helper
 * detects this and only fetches the bundle for the active language and its
 * BCP-47 parents — Chinese never loads when the user wants Dutch.
 *
 * **Wire it in** `vite.config.ts` and `vitest.config.ts` when building from source:
 *
 * ```ts
 * import { defineConfig } from 'vitest/config';
 * import { nomercyTranslationsPlugin } from '@nomercy-entertainment/nomercy-player-core/vite-plugin';
 *
 * export default defineConfig({
 *   plugins: [nomercyTranslationsPlugin()],
 * });
 * ```
 *
 * **Published dists are self-contained.** The post-build resolver
 * (`scripts/resolve-translation-globs.mjs`) rewrites all literal glob calls
 * to static lazy import maps before the tarball is packed. Consumers of the
 * published packages do NOT need this plugin, and do NOT need to exclude the
 * packages from `optimizeDeps` — esbuild pre-bundling works without it.
 *
 * The plugin only touches files that call `translationsFromGlob` with a
 * literal string — every other file passes through untouched.
 *
 * @param opts  Optional overrides for the file filter and helper name.
 */
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
		// `'pre'` so the rewrite runs before Vite's import.meta.glob analyser —
		// otherwise the analyser sees the clean form and skips the file.
		enforce: 'pre' as const,

		transform(code: string, id: string) {
			// Dev-served dep modules carry ?v=<hash> / #fragment suffixes; strip
			// them or the extension-anchored filter skips node_modules dists.
			const cleanId = id.replace(/[?#].*$/u, '');
			if (!include.test(cleanId))
				return null;
			if (!code.includes(`${helperName}(`))
				return null;

			pattern.lastIndex = 0;
			const next = code.replace(pattern, (_, quote: string, glob: string) => {
				// Widen *.ts to *.{ts,js}: the same literal survives into package
				// dists where the bundle files are .js — a bare .ts glob there
				// silently matches nothing.
				const widened = glob.endsWith('.ts')
					? `${glob.slice(0, -3)}.{ts,js}`
					: glob;
				// No `eager: true` — the runtime helper stamps lazy markers so only
				// the active language bundle is fetched.
				return `${helperName}(import.meta.glob(${quote}${widened}${quote}))`;
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
