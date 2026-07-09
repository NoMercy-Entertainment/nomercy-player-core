// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Structured plugin-throw primitives — `src/core/plugin/throw.ts`.
 *
 * Test groups:
 *  - PluginThrow — payload + pluginId carriage, Error.message derivation
 *  - PLUGIN_RECOVERY_ACTION — the frozen name → action-string mapping that
 *    `static onError` entries and `_applyRecoveryAction` share
 */

import type { ThrowPayload } from '../core/plugin/throw';
import { describe, expect, it } from 'vitest';
import { PLUGIN_RECOVERY_ACTION, PluginThrow } from '../core/plugin/throw';

describe('PluginThrow', () => {
	it('carries the payload by reference', () => {
		const payload: ThrowPayload = {
			code: 'lyrics:fetch/failed',
			severity: 'error',
			context: { url: 'https://x/lyrics.json' },
			suggestion: 'Retry in a moment',
		};
		const pluginThrow = new PluginThrow(payload, 'lyrics');

		expect(pluginThrow.payload).toBe(payload);
		expect(pluginThrow.payload.code).toBe('lyrics:fetch/failed');
		expect(pluginThrow.payload.context).toEqual({ url: 'https://x/lyrics.json' });
		expect(pluginThrow.payload.suggestion).toBe('Retry in a moment');
	});

	it('carries the plugin id that raised it', () => {
		const pluginThrow = new PluginThrow({ code: 'x:y/z' }, 'my-plugin');
		expect(pluginThrow.pluginId).toBe('my-plugin');
	});

	it('uses payload.message as the Error message when present', () => {
		const pluginThrow = new PluginThrow({
			code: 'x:y/z',
			message: 'human readable',
		}, 'my-plugin');
		expect(pluginThrow.message).toBe('human readable');
	});

	it('falls back to the code as the Error message', () => {
		const pluginThrow = new PluginThrow({ code: 'x:y/z' }, 'my-plugin');
		expect(pluginThrow.message).toBe('x:y/z');
	});

	it('carries cause and per-throw retry override through the payload', () => {
		const cause = new Error('inner');
		const pluginThrow = new PluginThrow({
			code: 'x:y/z',
			cause,
			retry: null,
		}, 'my-plugin');
		expect(pluginThrow.payload.cause).toBe(cause);
		expect(pluginThrow.payload.retry).toBeNull();
	});

	it('is an instanceof Error and PluginThrow so the kit can identify structured throws', () => {
		const pluginThrow = new PluginThrow({ code: 'x:y/z' }, 'my-plugin');
		expect(pluginThrow).toBeInstanceOf(PluginThrow);
		expect(pluginThrow).toBeInstanceOf(Error);
	});
});

describe('PLUGIN_RECOVERY_ACTION', () => {
	it('maps every recovery name to its action string', () => {
		expect(PLUGIN_RECOVERY_ACTION).toEqual({
			RETRY_ONCE: 'retry-once',
			FALLBACK: 'fallback',
			DISABLE: 'disable',
			IGNORE: 'ignore',
		});
	});

	it('values are valid entries for a plugin static onError map', () => {
		const actions = Object.values(PLUGIN_RECOVERY_ACTION);
		expect(actions).toContain('retry-once');
		expect(actions).toContain('fallback');
		expect(actions).toContain('disable');
		expect(actions).toContain('ignore');
		expect(actions).toHaveLength(4);
	});
});
