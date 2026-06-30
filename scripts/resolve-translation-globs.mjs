// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Post-build glob resolver for `translationsFromGlob`.
 *
 * tsc emits dist/**\/index.js files that contain the literal call form:
 *
 *   translationsFromGlob('./i18n/*.ts')
 *
 * That form only works when the consumer runs the kit's Vite plugin — which
 * an esbuild pre-bundle pass does not. This script rewrites every such call
 * in dist to a static lazy import map so the dist is self-contained:
 *
 *   translationsFromGlob({
 *     './i18n/en.js': () => import('./i18n/en.js'),
 *     './i18n/nl.js': () => import('./i18n/nl.js'),
 *   })
 *
 * The runtime helper already accepts the lazy-record form — see
 * src/adapters/translator/loaders/translations-glob.ts.
 *
 * Usage (from a package root):
 *   node ../nomercy-player-core/scripts/resolve-translation-globs.mjs [distDir]
 *
 * distDir defaults to ./dist relative to cwd.
 */

import {
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import {
	dirname,
	join,
	relative,
	resolve,
} from 'node:path';

const HELPER_NAME = 'translationsFromGlob';

// Matches: translationsFromGlob('./i18n/*.ts')  or  translationsFromGlob("./i18n/*.ts")
// Does NOT match the already-rewritten object form.
const LITERAL_CALL_RE = /translationsFromGlob\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;

/**
 * Walk a directory tree and return all .js file paths.
 * @param {string} dir
 * @returns {string[]} Absolute paths of every .js file found under `dir`.
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
 * Given a glob pattern like './i18n/*.ts', find all matching .js files
 * that actually exist relative to the file containing the call.
 *
 * Strategy: strip the extension from the glob stem and look for .js files
 * in the resolved directory — the dist always has .js not .ts.
 *
 * @param {string} pattern  e.g. './i18n/*.ts'
 * @param {string} callerFile  absolute path of the .js file containing the call
 * @returns {string[]}  sorted relative paths (e.g. ['./i18n/en.js', './i18n/nl.js'])
 */
function resolveGlob(pattern, callerFile) {
	const callerDir = dirname(callerFile);

	// Extract the directory part and the extension of the glob.
	// './i18n/*.ts'  → dir = './i18n', ext search = '.js'
	const lastSlash = pattern.lastIndexOf('/');
	const globDir = lastSlash >= 0 ? pattern.slice(0, lastSlash) : '.';

	const targetDir = resolve(callerDir, globDir);

	let entries;
	try {
		entries = readdirSync(targetDir);
	}
	catch {
		return [];
	}

	return entries
		.filter(entry => entry.endsWith('.js') && entry !== 'index.js')
		.map(entry => `${globDir}/${entry}`)
		.sort();
}

/**
 * Build the replacement string for one matched literal call.
 *
 * @param {string} pattern    the glob pattern from the literal call
 * @param {string} callerFile absolute path of the .js file being rewritten
 * @returns {string}          the replacement source text
 */
function buildReplacement(pattern, callerFile) {
	const files = resolveGlob(pattern, callerFile);

	if (files.length === 0) {
		const rel = relative(process.cwd(), callerFile);
		throw new Error(
			`[resolve-translation-globs] Zero i18n files matched for pattern '${pattern}' in ${rel}.\n`
			+ `  Looked in: ${resolve(dirname(callerFile), pattern.slice(0, pattern.lastIndexOf('/')))}\n`
			+ `  Build will not produce working translations. Fix the plugin's i18n directory or the glob pattern.`,
		);
	}

	const entries = files
		.map(file => `    '${file}': () => import('${file}')`)
		.join(',\n');

	return `${HELPER_NAME}({\n${entries},\n  })`;
}

/**
 * Rewrite a single .js file in-place. Returns true when a change was made.
 *
 * Only rewrites calls that are real static field initialisers, not occurrences
 * inside string literals (error messages, JSDoc examples, test fixtures).
 *
 * Detection: a real call site has the helper name at the start of a line or
 * after `=` / whitespace, and NOT preceded immediately by a quote character
 * (which would indicate it is embedded inside a string value).
 *
 * @param {string} filePath
 * @returns {boolean} True when the file was rewritten, false when left unchanged.
 */
function processFile(filePath) {
	const original = readFileSync(filePath, 'utf8');

	// Fast pre-check — avoid regex work on files without the helper.
	if (!original.includes(`${HELPER_NAME}(`))
		return false;

	LITERAL_CALL_RE.lastIndex = 0;
	let rewritten = original;
	const matches = [];

	for (let match = LITERAL_CALL_RE.exec(original); match !== null; match = LITERAL_CALL_RE.exec(original)) {
		// Skip occurrences inside string literals (error messages, template literals).
		// A real static field initialiser is preceded by `=` or whitespace.
		// An embedded occurrence inside a string is preceded by a quote character.
		const charBefore = original[match.index - 1] ?? '';
		if (charBefore === '\'' || charBefore === '"' || charBefore === '`' || charBefore === '$') {
			continue;
		}

		// Skip occurrences inside JSDoc / block comments.
		// JSDoc lines look like " *   translationsFromGlob(..." — detect by
		// finding the start of the current line and checking for a leading " *".
		const lineStart = original.lastIndexOf('\n', match.index) + 1;
		const linePrefix = original.slice(lineStart, match.index).trimStart();
		if (linePrefix.startsWith('*') || linePrefix.startsWith('//')) {
			continue;
		}

		matches.push({
			full: match[0],
			pattern: match[2],
			index: match.index,
		});
	}

	if (matches.length === 0)
		return false;

	for (const { full, pattern } of matches) {
		const replacement = buildReplacement(pattern, filePath);
		rewritten = rewritten.replace(full, replacement);
	}

	if (rewritten === original)
		return false;

	writeFileSync(filePath, rewritten, 'utf8');
	return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const distArg = process.argv[2] ?? 'dist';
const distDir = resolve(process.cwd(), distArg);

console.log(`[resolve-translation-globs] Scanning ${distDir} ...`);

const jsFiles = walkJs(distDir);
let changedCount = 0;

for (const file of jsFiles) {
	try {
		const changed = processFile(file);
		if (changed) {
			const rel = relative(process.cwd(), file);
			console.log(`  rewritten: ${rel}`);
			changedCount++;
		}
	}
	catch (err) {
		// Re-throw — zero-match is a hard build failure.
		console.error(err.message);
		process.exit(1);
	}
}

console.log(`[resolve-translation-globs] Done. ${changedCount} file(s) rewritten.`);
