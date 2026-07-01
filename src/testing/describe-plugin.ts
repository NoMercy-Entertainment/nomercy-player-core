// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { Plugin } from '../core/plugin';
import type { IPlayer } from '../types';
import { LifecycleRegistry } from '../adapters/lifecycle-registry/default';
import { StateError } from '../errors';
import { assertNoListenerLeak } from './leak-harness';
import { StubPlayer } from './stub-player';

/**
 * Vitest globals (`describe`, `it`, `beforeEach`, `afterEach`) without taking a
 * direct dependency on Vitest from the kit. Tests using `describePlugin` are
 * run via Vitest, which injects these globals when `globals: true` is set in
 * the vitest config (default in our setup).
 */
type DescribeFn = (name: string, fn: () => void) => void;
type ItFn = (name: string, fn: () => void | Promise<void>) => void;
type HookFn = (fn: () => void | Promise<void>) => void;

interface VitestGlobals {
	describe: DescribeFn;
	it: ItFn;
	beforeEach: HookFn;
	afterEach: HookFn;
}

function getGlobals(): VitestGlobals {
	// Vitest injects test globals at runtime; not typed on globalThis — narrowed via local interface.
	const globals = globalThis as unknown as Partial<VitestGlobals>;
	if (!globals.describe || !globals.it || !globals.beforeEach || !globals.afterEach) {
		throw new StateError({
			code: 'core:test/vitest-globals-missing',
			severity: 'fatal',
			scope: { kind: 'core' },
			message: '[describePlugin] Vitest globals (describe / it / beforeEach / afterEach) not found.',
			suggestion: 'Ensure vitest.config has `test.globals: true` and the test runner is Vitest.',
		});
	}
	return globals as VitestGlobals;
}

/**
 * Plugin test context handed to the author's `fn`. `player` is the StubPlayer,
 * `plugin` is the freshly-instantiated subject. Both are reset between tests.
 */
export interface PluginTestContext<C extends typeof Plugin<any, any, any>> {
	player: StubPlayer;
	plugin: InstanceType<C>;
}

export interface DescribePluginOptions<C extends typeof Plugin<any, any, any>> {
	/**
	 * Plugin options passed to `initialize()`. Override per test by calling
	 * `plugin.setOptions(partial)` inside the test body.
	 */
	opts?: ConstructorParameters<C>[0] extends never ? unknown : InstanceType<C>['opts'];

	/**
	 * Skip the leak-harness assertion that runs after every test. Use sparingly —
	 * the default is to assert no leaks because that's the whole point of the
	 * test runner. Useful for tests that intentionally probe leak behavior.
	 */
	skipLeakAssertion?: boolean;

	/**
	 * Custom StubPlayer factory. Default creates a fresh player per test. Use
	 * this when the plugin needs a pre-configured player (e.g. specific
	 * translations seeded, specific phase, etc.).
	 */
	createPlayer?: () => StubPlayer;
}

/**
 * Plugin test wrapper. Wires a fresh `StubPlayer`, instantiates the plugin,
 * runs `use()`, hands `(player, plugin)` to the author's tests, then runs
 * `dispose()` and asserts the leak harness afterward.
 *
 * ```ts
 * import { describePlugin } from '@nomercy-entertainment/nomercy-player-core/testing';
 * import { LyricsPlugin } from '../lyrics';
 *
 * describePlugin(LyricsPlugin, ({ player, plugin }) => {
 *   describe('happy path', () => {
 *     it('emits plugin:lyrics:line on time tick', () => {
 *       // ...
 *     });
 *   });
 * });
 * ```
 *
 * Each `it` runs against a fresh player + plugin pair — there is no test
 * pollution. The leak harness asserts after every test that the plugin
 * cleaned up after itself; failure surfaces as a `[leak-harness]` error.
 */
export function describePlugin<C extends typeof Plugin<any, any, any>>(
	PluginClass: C,
	fn: (ctx: PluginTestContext<C>) => void,
	opts?: DescribePluginOptions<C>,
): void {
	const { describe, beforeEach, afterEach } = getGlobals();
	// Plugin class static `id` is not on the TS constructor type — accessed via structural narrowing.
	const id = (PluginClass as unknown as { id?: string }).id ?? 'plugin';

	describe(`Plugin: ${id}`, () => {
		const ctx: PluginTestContext<C> = {
			player: undefined as unknown as StubPlayer, // Populated in beforeEach; undefined is the pre-init sentinel.
			plugin: undefined as unknown as InstanceType<C>, // Populated in beforeEach; undefined is the pre-init sentinel.
		};

		let lifecycle: LifecycleRegistry;
		let listenerBaseline = 0;

		beforeEach(async () => {
			ctx.player = opts?.createPlayer?.() ?? new StubPlayer();
			// listenerCount is an internal diagnostic method; not on IPlayer — accessed via structural narrowing.
			listenerBaseline = (ctx.player as unknown as { listenerCount?: () => number }).listenerCount?.() ?? 0;

			lifecycle = new LifecycleRegistry();
			// Plugin constructor takes no args; options go through initialize() — type-erased to concrete base.
			ctx.plugin = new (PluginClass as unknown as new () => InstanceType<C>)();
			// StubPlayer satisfies IPlayer at runtime; cast required because StubPlayer is test-local.
			ctx.plugin.initialize(ctx.player as unknown as IPlayer, opts?.opts as InstanceType<C>['opts'], lifecycle);

			const useResult = ctx.plugin.use();
			if (useResult instanceof Promise)
				await useResult;
		});

		afterEach(async () => {
			ctx.plugin.dispose();
			lifecycle.dispose();

			if (!opts?.skipLeakAssertion) {
				// listenerCount is an internal diagnostic method; not on IPlayer — accessed via structural narrowing.
				const after = (ctx.player as unknown as { listenerCount?: () => number }).listenerCount?.() ?? 0;
				const leaked = after - listenerBaseline;
				if (leaked > 0) {
					throw new StateError({
						code: 'core:test/listener-leak',
						severity: 'error',
						scope: {
							kind: 'plugin',
							id,
						},
						message: `[describePlugin/${id}] leaked ${leaked} listener(s) after dispose. before=${listenerBaseline} after=${after}.`,
						suggestion: 'Register listeners via `this.on()` / `this.listen()`, or pair every manual `player.on()` with `off()` in dispose().',
						context: {
							leaked,
							before: listenerBaseline,
							after,
						},
					});
				}
			}

			ctx.player.reset();
		});

		fn(ctx);
	});

	// Suppress unused-import warnings; `assertNoListenerLeak` is exported for
	// authors who want to run leak assertions inside specific tests too.
	void assertNoListenerLeak;
}
