/**
 * Unit tests for scripts/resolve-translation-globs.mjs
 *
 * Tests run in the Node environment so real fs operations work.
 *
 * @vitest-environment node
 */

import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// ── Import the resolver logic under test ──────────────────────────────────────
// The script is a plain .mjs with a `main` block that runs on import.
// We extract the pure functions by re-implementing them here so we can unit-
// test each stage in isolation without spawning a subprocess and without the
// `process.exit(1)` path running in the test process.
//
// The functions are extracted by reading + evaluating the pure parts — but
// since we cannot import a side-effectful .mjs safely in vitest, we duplicate
// the logic under test here and keep them in sync via the contract tests below.
// The integration test at the bottom spawns the script as a child process to
// verify the real entry point works end-to-end.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFixtureTree(root: string, files: Record<string, string>): void {
	for (const [relPath, content] of Object.entries(files)) {
		const full = join(root, relPath);
		mkdirSync(join(full, '..'), { recursive: true });
		writeFileSync(full, content, 'utf8');
	}
}

function read(filePath: string): string {
	return readFileSync(filePath, 'utf8');
}

// Invoke the resolver script as a child process against a fixture dist tree.
function runResolver(distDir: string): { stdout: string; stderr: string; exitCode: number } {
	const scriptPath = resolve(import.meta.dirname, '../../scripts/resolve-translation-globs.mjs');
	try {
		const stdout = execSync(`node "${scriptPath}" "${distDir}"`, { encoding: 'utf8', cwd: distDir });
		return { stdout, stderr: '', exitCode: 0 };
	}
	catch (err: unknown) {
		const execError = err as { stdout?: string; stderr?: string; status?: number };
		return {
			stdout: execError.stdout ?? '',
			stderr: execError.stderr ?? '',
			exitCode: execError.status ?? 1,
		};
	}
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Split the helper name and call pattern so the kit's Vite plugin (which
// rewrites translationsFromGlob string literals during test transform) does
// not mutate these fixture strings before the test runs. Same technique as
// vite-plugin.test.ts.
const HELPER = ['translations', 'FromGlob'].join('');
const LITERAL_CALL = `${HELPER}('./i18n/*.ts')`;

const PLUGIN_SOURCE = `import { ${HELPER} } from '@nomercy-entertainment/nomercy-player-core';
class MyPlugin {
  static translations = ${HELPER}('./i18n/*.ts');
}
export { MyPlugin };
`;

const ALREADY_REWRITTEN = `import { translationsFromGlob } from '@nomercy-entertainment/nomercy-player-core';
class MyPlugin {
  static translations = translationsFromGlob({
    './i18n/en.js': () => import('./i18n/en.js'),
    './i18n/nl.js': () => import('./i18n/nl.js'),
  });
}
export { MyPlugin };
`;

const EN_JS = `export default { 'plugin.foo': 'Foo' };`;
const NL_JS = `export default { 'plugin.foo': 'Foo NL' };`;

// ── Test suite ────────────────────────────────────────────────────────────────

let tmpDir = '';

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), 'resolve-glob-test-'));
});

afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe('resolve-translation-globs integration', () => {
	it('rewrites a literal translationsFromGlob call to a static lazy map', () => {
		buildFixtureTree(tmpDir, {
			'plugins/my-plugin/index.js': PLUGIN_SOURCE,
			'plugins/my-plugin/i18n/en.js': EN_JS,
			'plugins/my-plugin/i18n/nl.js': NL_JS,
		});

		const result = runResolver(tmpDir);
		expect(result.exitCode).toBe(0);

		const rewritten = read(join(tmpDir, 'plugins/my-plugin/index.js'));
		expect(rewritten).toContain(`'./i18n/en.js': () => import('./i18n/en.js')`);
		expect(rewritten).toContain(`'./i18n/nl.js': () => import('./i18n/nl.js')`);
		expect(rewritten).not.toContain(LITERAL_CALL);
	});

	it('lists all actual .js files found in the i18n directory', () => {
		buildFixtureTree(tmpDir, {
			'plugins/my-plugin/index.js': PLUGIN_SOURCE,
			'plugins/my-plugin/i18n/en.js': EN_JS,
			'plugins/my-plugin/i18n/nl.js': NL_JS,
			'plugins/my-plugin/i18n/pt-BR.js': `export default { 'plugin.foo': 'Foo BR' };`,
		});

		const result = runResolver(tmpDir);
		expect(result.exitCode).toBe(0);

		const rewritten = read(join(tmpDir, 'plugins/my-plugin/index.js'));
		expect(rewritten).toContain(`'./i18n/en.js'`);
		expect(rewritten).toContain(`'./i18n/nl.js'`);
		expect(rewritten).toContain(`'./i18n/pt-BR.js'`);
	});

	it('fails loudly (exit code 1) when the glob resolves to zero files', () => {
		buildFixtureTree(tmpDir, {
			'plugins/my-plugin/index.js': PLUGIN_SOURCE,
			// intentionally no i18n/*.js files
		});

		const result = runResolver(tmpDir);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('Zero i18n files matched');
	});

	it('leaves already-rewritten files untouched (idempotent)', () => {
		buildFixtureTree(tmpDir, {
			'plugins/my-plugin/index.js': ALREADY_REWRITTEN,
			'plugins/my-plugin/i18n/en.js': EN_JS,
			'plugins/my-plugin/i18n/nl.js': NL_JS,
		});

		const before = read(join(tmpDir, 'plugins/my-plugin/index.js'));
		const result = runResolver(tmpDir);
		expect(result.exitCode).toBe(0);
		const after = read(join(tmpDir, 'plugins/my-plugin/index.js'));

		expect(after).toBe(before);
		expect(result.stdout).toContain('0 file(s) rewritten');
	});

	it('rewrites every plugin in a multi-plugin dist tree', () => {
		buildFixtureTree(tmpDir, {
			'plugins/plugin-a/index.js': PLUGIN_SOURCE,
			'plugins/plugin-a/i18n/en.js': EN_JS,
			'plugins/plugin-a/i18n/nl.js': NL_JS,
			'plugins/plugin-b/index.js': PLUGIN_SOURCE,
			'plugins/plugin-b/i18n/en.js': EN_JS,
			'plugins/plugin-b/i18n/nl.js': NL_JS,
		});

		const result = runResolver(tmpDir);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('2 file(s) rewritten');

		for (const plugin of ['plugin-a', 'plugin-b']) {
			const rewritten = read(join(tmpDir, `plugins/${plugin}/index.js`));
			expect(rewritten).toContain(`'./i18n/en.js': () => import('./i18n/en.js')`);
			expect(rewritten).not.toContain(LITERAL_CALL);
		}
	});

	it('does not touch files without the helper call', () => {
		const noHelper = `export const x = 1;`;
		buildFixtureTree(tmpDir, {
			'index.js': noHelper,
		});

		const result = runResolver(tmpDir);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('0 file(s) rewritten');
		expect(read(join(tmpDir, 'index.js'))).toBe(noHelper);
	});
});
