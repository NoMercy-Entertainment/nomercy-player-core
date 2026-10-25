// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Built-in plugin ids carry no vendor prefix (`base.ts`: "Vendored unless inside
 * our packages"). Walks every plugin entry point in `src/plugins` and fails on
 * any exported plugin class whose static id contains a `:`.
 */

import { describe, expect, it } from 'vitest';

const entryPoints = import.meta.glob('../../plugins/*/index.ts', { eager: true }) as Record<string, Record<string, unknown>>;

function builtInPlugins(): Array<{ entry: string; name: string; id: string }> {
	const found: Array<{ entry: string; name: string; id: string }> = [];
	for (const [entry, exports] of Object.entries(entryPoints)) {
		for (const [name, value] of Object.entries(exports)) {
			const id = typeof value === 'function' ? (value as { id?: unknown }).id : undefined;
			if (typeof id === 'string') {
				found.push({ entry, name, id });
			}
		}
	}
	return found;
}

const sources = import.meta.glob('../../**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const prefixedIdLiteral = /\bid\b(?:\s*:\s*string)?\s*[:=]\s*['"`][^'"`\n]*:[^'"`\n]*['"`]/;

describe('plugin id literals in src and tests', () => {
	it('scans the package sources', () => {
		expect(Object.keys(sources).length).toBeGreaterThan(200);
	});

	it('no id literal carries a vendor prefix', () => {
		const hits: string[] = [];
		for (const [file, text] of Object.entries(sources)) {
			if (file.endsWith('builtin-plugin-ids.test.ts')) {
				continue;
			}
			text.split('\n').forEach((line, index) => {
				if (prefixedIdLiteral.test(line)) {
					hits.push(`${file}:${index + 1}: ${line.trim()}`);
				}
			});
		}
		expect(hits).toEqual([]);
	});
});

describe('built-in plugin ids', () => {
	it('finds the plugin classes the package ships', () => {
		const names = builtInPlugins().map(plugin => plugin.name);
		expect(names).toContain('SpectrumPlugin');
		expect(names).toContain('WaveformVisualization');
		expect(Object.keys(entryPoints).length).toBeGreaterThanOrEqual(13);
	});

	it('no built-in plugin id carries a vendor prefix', () => {
		const prefixed = builtInPlugins().filter(plugin => plugin.id.includes(':'));
		expect(prefixed.map(plugin => `${plugin.name}: ${plugin.id}`)).toEqual([]);
	});
});
