/**
 * Post-build static-asset copier.
 *
 * tsc only emits JavaScript — plugin stylesheets referenced at runtime via
 * `new URL('./styles.css', import.meta.url)` never reach dist, so published
 * tarballs 404 on them (the dev server then answers with the SPA fallback
 * and the browser refuses the text/html MIME).
 *
 * Copies every static asset under src/ into dist/ at the same relative path.
 *
 * Usage (from a package root):
 *   node ../nomercy-player-kit/scripts/copy-dist-assets.mjs [srcDir] [distDir]
 *
 * srcDir defaults to ./src, distDir to ./dist relative to cwd.
 */

import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ASSET_EXTENSIONS = [
	'.css',
	'.svg',
	'.woff2',
];

/**
 * Walk a directory tree and return all asset file paths.
 * @param {string} dir
 * @returns {string[]}
 */
function walkAssets(dir) {
	const results = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			results.push(...walkAssets(full));
		}
		else if (ASSET_EXTENSIONS.some(extension => entry.endsWith(extension))) {
			results.push(full);
		}
	}
	return results;
}

const srcDir = resolve(process.cwd(), process.argv[2] ?? 'src');
const distDir = resolve(process.cwd(), process.argv[3] ?? 'dist');

const assets = walkAssets(srcDir);
for (const asset of assets) {
	const target = join(distDir, relative(srcDir, asset));
	mkdirSync(dirname(target), { recursive: true });
	copyFileSync(asset, target);
}

console.log(`[copy-dist-assets] copied ${assets.length} asset(s) into ${relative(process.cwd(), distDir)}`);
