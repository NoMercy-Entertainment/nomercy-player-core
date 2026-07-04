// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Tests for `describePlugin` — the plugin test-DSL helper in ./testing.
 *
 * `describePlugin` is a function that CALLS `describe` / `beforeEach` /
 * `afterEach` from Vitest globals when invoked inside a running Vitest context.
 * We verify:
 *  1. It executes successfully against a minimal Plugin subclass.
 *  2. The `fn` callback receives { player, plugin } context.
 *  3. The `getGlobals` path throws `StateError` when Vitest globals are absent.
 *  4. `describePluginAgainst` throws `StateError` when Vitest globals are absent.
 *
 * For the globals-missing case we temporarily remove vitest globals from
 * `globalThis` to trigger the guard path inside `getGlobals`.
 *
 * The describe-plugin / describe-plugin-against functions are also exercised
 * indirectly by ALL other plugin tests in this repo — every test that calls
 * `describePlugin(SomePlugin, fn)` exercises the beforeEach/afterEach wiring.
 * This file focuses on the contract of the DSL itself.
 */

import type { BaseEventMap, IPlayer } from '../../types';
import { describe, expect, it, vi } from 'vitest';
import { translationsFromGlob } from '../../adapters/translator/loaders/translations-glob';
import { Plugin } from '../../core/plugin';
import { StateError } from '../../errors';
import { describePlugin } from '../../testing/describe-plugin';
import { describePluginAgainst } from '../../testing/describe-plugin-against';
import { StubPlayer } from '../../testing/stub-player';

// ── Minimal plugin for testing the DSL ────────────────────────────────────────

class NoopPlugin extends Plugin<IPlayer<BaseEventMap>> {
	static override readonly id = 'noop-dsl-test';
	static override readonly version = '1.0.0';
	static override readonly description = 'Minimal no-op plugin for DSL tests';

	override use(): void {}
	override dispose(): void {}
}

// ── describePlugin executed inside Vitest — happy path ────────────────────────
//
// IMPORTANT: fn receives a MUTABLE ctx object populated by beforeEach.
// Destructuring in the fn signature is fine for the outer closure, but the
// individual it() bodies must read from ctx AT EXECUTION TIME — ctx.player
// etc. are undefined when fn() is first called (describe phase), but populated
// by the time each it() executes.

describePlugin(NoopPlugin, (ctx) => {
	it('player is a StubPlayer instance', () => {
		expect(ctx.player).toBeInstanceOf(StubPlayer);
	});

	it('plugin is an instance of the plugin class', () => {
		expect(ctx.plugin).toBeInstanceOf(NoopPlugin);
	});

	it('player.phase() is defined', () => {
		expect(typeof ctx.player.phase()).toBe('string');
	});
});

// ── describePlugin with opts.skipLeakAssertion ────────────────────────────────

describePlugin(NoopPlugin, (ctx) => {
	it('player is accessible even with skipLeakAssertion', () => {
		expect(ctx.player).toBeDefined();
	});
}, { skipLeakAssertion: true });

// ── describePlugin with custom createPlayer factory ───────────────────────────

describePlugin(NoopPlugin, (ctx) => {
	it('player.playerId is "custom-factory-player" as set by createPlayer', () => {
		expect(ctx.player.playerId).toBe('custom-factory-player');
	});
}, {
	createPlayer: () => new StubPlayer({ id: 'custom-factory-player' }),
});

// ── describePlugin loads static translations before use() ────────────────────
//
// Conformance-harness parity: `_registerPlugin` (production) merges a
// plugin's `static translations` into the player's table BEFORE `use()`
// resolves. Before this fix, `describePlugin`'s StubPlayer skipped that merge
// entirely, so `this.t()` inside a plugin method returned the raw
// `plugin.<id>.<key>` key under `describePlugin` even though the real player
// resolved it correctly — exactly what bit MediaSessionPlugin's conformance
// test (`getMetadata()` returned the raw key instead of `'Season 2'`).

const i18nGreetingLoader = vi.fn(async () => ({ default: { 'plugin.i18n-dsl-test.greeting': 'Hello' } }));

class I18nPlugin extends Plugin<IPlayer<BaseEventMap>> {
	static override readonly id = 'i18n-dsl-test';
	static override readonly version = '1.0.0';
	static override readonly description = 'Plugin whose t() must resolve under describePlugin, same as production.';
	static override readonly translations = translationsFromGlob({
		'./i18n/en.ts': i18nGreetingLoader,
	});

	override use(): void {}
	override dispose(): void {}

	greeting(): string {
		return this.t('greeting');
	}
}

describePlugin(I18nPlugin, (ctx) => {
	it('this.t() resolves the plugin-namespaced key via the lazy static bundle, not the raw key', () => {
		expect(ctx.plugin.greeting()).toBe('Hello');
	});

	it('did not resolve to the raw fully-qualified key (the pre-fix regression)', () => {
		expect(ctx.plugin.greeting()).not.toBe('plugin.i18n-dsl-test.greeting');
	});
});

// ── getGlobals throws when Vitest globals are absent ─────────────────────────

describe('describePlugin getGlobals guard', () => {
	it('throws StateError when Vitest globals are absent', () => {
		const saved = {
			describe: (globalThis as any).describe,
			it: (globalThis as any).it,
			beforeEach: (globalThis as any).beforeEach,
			afterEach: (globalThis as any).afterEach,
		};

		try {
			(globalThis as any).describe = undefined;

			expect(() =>
				describePlugin(NoopPlugin, () => {})).toThrow(StateError);
		}
		finally {
			Object.assign(globalThis, saved);
		}
	});

	it('thrown StateError has code core:test/vitest-globals-missing', () => {
		const saved = { describe: (globalThis as any).describe };
		try {
			(globalThis as any).describe = undefined;
			try {
				describePlugin(NoopPlugin, () => {});
			}
			catch (err) {
				expect(err).toBeInstanceOf(StateError);
				expect((err as StateError).code).toBe('core:test/vitest-globals-missing');
			}
		}
		finally {
			(globalThis as any).describe = saved.describe;
		}
	});
});

// ── describePluginAgainst getGlobals guard ────────────────────────────────────

describe('describePluginAgainst getGlobals guard', () => {
	it('throws StateError when Vitest globals are absent', () => {
		const saved = { describe: (globalThis as any).describe };
		try {
			(globalThis as any).describe = undefined;

			expect(() =>
				describePluginAgainst(NoopPlugin, () => {}, {
					player: () => new StubPlayer() as unknown as IPlayer,
				} as any)).toThrow(StateError);
		}
		finally {
			(globalThis as any).describe = saved.describe;
		}
	});
});
