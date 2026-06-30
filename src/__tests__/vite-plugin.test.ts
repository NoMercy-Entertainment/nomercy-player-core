// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { nomercyTranslationsPlugin } from '../vite-plugin';

// The kit's own vitest config registers the plugin, so a literal helper call
// written in this file would be rewritten before the test executes. Building
// the inputs from a split name keeps the fixtures out of the plugin's reach.
const HELPER = ['translations', 'FromGlob'].join('');

function runTransform(code: string, id = 'src/plugins/desktop-ui/index.ts'): string | null {
	const plugin = nomercyTranslationsPlugin();
	const result = plugin.transform(code, id);
	return result ? result.code : null;
}

describe('nomercyTranslationsPlugin', () => {
	it('lifts a literal pattern into import.meta.glob', () => {
		const out = runTransform(`const t = ${HELPER}('./i18n/*.ts');`);
		expect(out).toContain(`import.meta.glob('./i18n/*.{ts,js}')`);
	});

	it('widens a .ts suffix to {ts,js} so built dist .js bundles still match', () => {
		// Package dists carry the same literal call but their i18n files are .js;
		// a bare *.ts glob would silently match nothing in node_modules.
		const out = runTransform(
			`const t = ${HELPER}('./i18n/*.ts');`,
			'node_modules/@nomercy-entertainment/nomercy-video-player/dist/plugins/desktop-ui/index.js',
		);
		expect(out).toContain(`import.meta.glob('./i18n/*.{ts,js}')`);
		expect(out).not.toContain(`'./i18n/*.ts'`);
	});

	it('leaves non-.ts patterns untouched in shape', () => {
		const out = runTransform(`const t = ${HELPER}('./locales/*.json');`);
		expect(out).toContain(`import.meta.glob('./locales/*.json')`);
	});

	it('rewrites every call in a file', () => {
		const out = runTransform(
			`const a = ${HELPER}('./i18n/*.ts');\nconst b = ${HELPER}("./more/*.ts");`,
		);
		expect(out).toContain(`import.meta.glob('./i18n/*.{ts,js}')`);
		expect(out).toContain(`import.meta.glob("./more/*.{ts,js}")`);
	});

	it('transforms ids carrying vite dev queries (?v=hash)', () => {
		// Dev-served dep modules get cache-busting queries; an extension-anchored
		// filter must strip them or node_modules dists are silently skipped.
		const out = runTransform(
			`const t = ${HELPER}('./i18n/*.ts');`,
			'node_modules/@nomercy-entertainment/nomercy-video-player/dist/plugins/desktop-ui/index.js?v=1a2b3c4d',
		);
		expect(out).toContain(`import.meta.glob('./i18n/*.{ts,js}')`);
	});

	it('ignores files without the helper and already-lifted calls', () => {
		expect(runTransform(`const x = 1;`)).toBeNull();
		expect(
			runTransform(`const t = ${HELPER}(import.meta.glob('./i18n/*.ts'));`),
		).toBeNull();
	});
});
