import type { Plugin } from '../core/plugin';
import type { IPlayer } from '../types';
import { StateError } from '../errors';

/**
 * Vitest globals — see `describe-plugin.ts` for why we resolve from the
 * runtime instead of importing from Vitest directly.
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
	const g = globalThis as unknown as Partial<VitestGlobals>;
	if (!g.describe || !g.it || !g.beforeEach || !g.afterEach) {
		throw new StateError({
			code: 'core:test/vitest-globals-missing',
			severity: 'fatal',
			scope: { kind: 'core' },
			message: '[describePluginAgainst] Vitest globals not found.',
			suggestion: 'Ensure vitest.config has `test.globals: true`.',
		});
	}
	return g as VitestGlobals;
}

export interface PluginAgainstTestContext<C extends typeof Plugin<any, any, any>, P extends IPlayer> {
	player: P;
	plugin: InstanceType<C>;
}

export interface DescribePluginAgainstOptions<C extends typeof Plugin<any, any, any>, P extends IPlayer> {
	/** Factory producing a fresh real player per test. Required — there is no default. */
	player: () => P | Promise<P>;

	/** Optional teardown — most players self-clean via `dispose()`. */
	teardown?: (player: P) => void | Promise<void>;

	/** Plugin options passed to `addPlugin`. */
	opts?: ConstructorParameters<C>[0] extends never ? unknown : InstanceType<C>['opts'];

	/** Skip the leak-harness assertion that runs after every test. Use sparingly. */
	skipLeakAssertion?: boolean;
}

/**
 * Layer-3 plugin test wrapper. Runs the same author tests as `describePlugin`
 * but against a **real** player (`NMMusicPlayer`, `NMVideoPlayer`, or any
 * other `IPlayer` impl) — not the lightweight `StubPlayer`.
 *
 * Use this to catch:
 *  - StubPlayer drift from real player behaviour
 *  - Plugin assumptions about real-player event timing / order
 *  - Real-player setup ordering bugs that StubPlayer can't surface
 *
 * ```ts
 * import { describePluginAgainst } from '@nomercy-entertainment/nomercy-player-core/testing';
 * import { LyricsPlugin } from '../lyrics';
 * import { nmMPlayer } from '../../index';
 *
 * describePluginAgainst(LyricsPlugin, ({ player, plugin }) => {
 *   it('emits plugin:lyrics:line on real time event', async () => {
 *     // ...
 *   });
 * }, {
 *   player: () => nmMPlayer('test').setup({}),
 * });
 * ```
 *
 * Recommended: write each plugin's tests once with `describePlugin`, then
 * import the same suite into a `describePluginAgainst` block to run it
 * against the real player. Watch mode runs only the layer-1 (StubPlayer)
 * pass; CI runs both.
 */
export function describePluginAgainst<C extends typeof Plugin<any, any, any>, P extends IPlayer>(
	PluginClass: C,
	fn: (ctx: PluginAgainstTestContext<C, P>) => void,
	opts: DescribePluginAgainstOptions<C, P>,
): void {
	const { describe, beforeEach, afterEach } = getGlobals();
	const id = (PluginClass as unknown as { id?: string }).id ?? 'plugin';

	describe(`Plugin (real-player): ${id}`, () => {
		const ctx: PluginAgainstTestContext<C, P> = {
			player: undefined as unknown as P,
			plugin: undefined as unknown as InstanceType<C>,
		};

		let listenerBaseline = 0;

		beforeEach(async () => {
			ctx.player = await opts.player();
			listenerBaseline = (ctx.player as unknown as { listenerCount?: () => number }).listenerCount?.() ?? 0;

			// Real player owns plugin registration. Caller's player factory is expected
			// to return a player ready for plugin registration (post-setup).
			const playerWithAddPlugin = ctx.player as unknown as {
				addPlugin?: (P: C, opts?: unknown) => unknown;
				getPlugin?: (P: C) => InstanceType<C>;
			};
			if (typeof playerWithAddPlugin.addPlugin !== 'function') {
				throw new StateError({
					code: 'core:test/player-missing-addplugin',
					severity: 'fatal',
					scope: {
						kind: 'plugin',
						id,
					},
					message: `[describePluginAgainst/${id}] player from factory does not expose addPlugin().`,
					suggestion: 'Ensure the real player class implements plugin registration before running these tests.',
				});
			}
			playerWithAddPlugin.addPlugin(PluginClass, opts.opts);
			const pluginInstance = playerWithAddPlugin.getPlugin?.(PluginClass);
			if (!pluginInstance) {
				throw new StateError({
					code: 'core:test/getplugin-returned-undefined',
					severity: 'fatal',
					scope: {
						kind: 'plugin',
						id,
					},
					message: `[describePluginAgainst/${id}] addPlugin succeeded but getPlugin returned undefined.`,
					suggestion: 'Ensure the real player class registers plugins via getPlugin() lookup.',
				});
			}
			ctx.plugin = pluginInstance;
		});

		afterEach(async () => {
			const playerWithRemove = ctx.player as unknown as { removePlugin?: (P: C) => void; dispose?: () => void };
			if (typeof playerWithRemove.removePlugin === 'function') {
				playerWithRemove.removePlugin(PluginClass);
			}

			if (opts.teardown)
				await opts.teardown(ctx.player);
			else if (typeof playerWithRemove.dispose === 'function')
				playerWithRemove.dispose();

			if (!opts.skipLeakAssertion) {
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
						message: `[describePluginAgainst/${id}] leaked ${leaked} listener(s) after dispose. before=${listenerBaseline} after=${after}.`,
						context: {
							leaked,
							before: listenerBaseline,
							after,
						},
					});
				}
			}
		});

		fn(ctx);
	});
}
