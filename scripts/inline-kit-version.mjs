// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Post-build kit-version inliner.
 *
 * tsc emits `dist/core/kit-version.js` containing:
 *
 *   import pkg from '../../package.json';
 *   export const KIT_VERSION = pkg.version;
 *
 * That bare JSON import is valid for bundlers (Vite/esbuild/Rollup) but throws
 * under Node ≥ 20.10 strict ESM without an `{ type: 'json' }` import attribute:
 *
 *   TypeError: Module "…/package.json" needs an import attribute of "type: json"
 *
 * This script rewrites the emitted file to a fully inlined literal so the dist
 * is loader-attribute-free and works in every context:
 *
 *   export const KIT_VERSION = "2.0.0-rc.6";
 *
 * The version is read from package.json at build time — single-sourced, no
 * hand-maintained duplicate string. The source file is left unchanged so
 * dev/types/resolveJsonModule continue to work normally.
 *
 * Usage (from a package root):
 *   node scripts/inline-kit-version.mjs [distDir]
 *
 * distDir defaults to ./dist relative to cwd.
 */

import {
	readFileSync,
	writeFileSync,
} from 'node:fs';
import {
	join,
	resolve,
} from 'node:path';

const distArg = process.argv[2] ?? 'dist';
const distDir = resolve(process.cwd(), distArg);
const pkgPath = resolve(process.cwd(), 'package.json');
const targetPath = join(distDir, 'core', 'kit-version.js');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

if (!version || typeof version !== 'string') {
	console.error(`[inline-kit-version] Could not read version from ${pkgPath}`);
	process.exit(1);
}

let source;
try {
	source = readFileSync(targetPath, 'utf8');
}
catch {
	console.error(`[inline-kit-version] Target not found: ${targetPath} — run tsc first`);
	process.exit(1);
}

// The emitted file contains a JSON import and a pkg.version reference.
// We replace the entire file with a literal export — no import needed.
const hasJsonImport = source.includes('package.json');
const hasPkgRef = source.includes('pkg.version') || source.includes('pkg[');

if (!hasJsonImport && !hasPkgRef) {
	console.log(`[inline-kit-version] Already inlined or unexpected shape — skipping ${targetPath}`);
	process.exit(0);
}

const inlined = `// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Semver string for the currently running kit build.
 * Inlined at build time from package.json — no runtime JSON import needed.
 */
export const KIT_VERSION = ${JSON.stringify(version)};
`;

writeFileSync(targetPath, inlined, 'utf8');
console.log(`[inline-kit-version] Inlined KIT_VERSION = ${JSON.stringify(version)} into ${targetPath}`);
