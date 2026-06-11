/**
 * Post-build CSS inliner for plugin stylesheets.
 *
 * tsc emits dist plugin files that load their stylesheet at runtime:
 *
 *   this.appendStyles(new URL('./styles.css', import.meta.url).href, 'my-styles');
 *
 * That is a network round-trip issued at plugin init — the plugin's DOM is
 * built immediately, so consumers see an unstyled flash until the CSS lands
 * (painfully visible through a tunnel). This script rewrites every such call
 * in dist to the synchronous inline form, embedding the CSS text:
 *
 *   this.appendInlineStyles("<css>", 'my-styles');
 *
 * The CSS is read from the dist sibling the URL points at, so run this AFTER
 * copy-dist-assets has placed the .css files into dist. Source builds (dev
 * server, testbed, vitest) keep the URL form, which Vite serves directly.
 *
 * Usage (from a package root):
 *   node ../nomercy-player-kit/scripts/inline-css-assets.mjs [distDir]
 *
 * distDir defaults to ./dist relative to cwd.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

// Matches: this.appendStyles(new URL('./styles.css', import.meta.url).href, 'style-id')
const CALL_RE = /this\.appendStyles\(\s*new URL\(\s*(['"])([^'"]+\.css)\1\s*,\s*import\.meta\.url\s*\)\.href\s*,\s*(['"])([^'"]+)\3\s*\)/g;

/**
 * Walk a directory tree and return all .js file paths.
 * @param {string} dir
 * @returns {string[]}
 */
function walkJs(dir) {
	const results = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			results.push(...walkJs(full));
		}
		else if (entry.endsWith('.js')) {
			results.push(full);
		}
	}
	return results;
}

/**
 * Rewrite a single .js file in-place. Returns true when a change was made.
 * @param {string} filePath
 * @returns {boolean}
 */
function processFile(filePath) {
	const original = readFileSync(filePath, 'utf8');

	if (!original.includes('appendStyles('))
		return false;

	CALL_RE.lastIndex = 0;
	let rewritten = original;
	let match;
	const matches = [];

	while ((match = CALL_RE.exec(original)) !== null) {
		matches.push({ full: match[0], cssPath: match[2], styleId: match[4] });
	}

	if (matches.length === 0)
		return false;

	for (const { full, cssPath, styleId } of matches) {
		const cssFile = resolve(dirname(filePath), cssPath);
		let cssText;
		try {
			cssText = readFileSync(cssFile, 'utf8');
		}
		catch {
			const rel = relative(process.cwd(), filePath);
			throw new Error(
				`[inline-css-assets] CSS file not found for '${cssPath}' referenced in ${rel}.\n`
				+ `  Looked at: ${cssFile}\n`
				+ `  Run copy-dist-assets before this script so the .css sits beside the .js.`,
			);
		}
		rewritten = rewritten.replace(full, `this.appendInlineStyles(${JSON.stringify(cssText)}, '${styleId}')`);
	}

	if (rewritten === original)
		return false;

	writeFileSync(filePath, rewritten, 'utf8');
	return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const distArg = process.argv[2] ?? 'dist';
const distDir = resolve(process.cwd(), distArg);

console.log(`[inline-css-assets] Scanning ${distDir} ...`);

const jsFiles = walkJs(distDir);
let changedCount = 0;

for (const file of jsFiles) {
	try {
		const changed = processFile(file);
		if (changed) {
			const rel = relative(process.cwd(), file);
			console.log(`  inlined: ${rel}`);
			changedCount++;
		}
	}
	catch (err) {
		console.error(err.message);
		process.exit(1);
	}
}

console.log(`[inline-css-assets] Done. ${changedCount} file(s) rewritten.`);
