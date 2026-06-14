import type { IPlayer } from '../types';
import { StateError } from '../errors';

/**
 * Result of a leak assertion. `leaked > 0` means the plugin retained
 * listeners / timers / observers after `dispose()` — test fails.
 */
export interface LeakAssertionResult {
	subjectId: string;
	listenersBefore: number;
	listenersAfterSetup: number;
	listenersAfterTeardown: number;
	leaked: number;
}

/**
 * Total live listener count across the player's event bus. Used as the leak
 * baseline. Both `NMMusicPlayer` and `NMVideoPlayer` extend `EventEmitter`,
 * which exposes `listenerCount()`. If the player object doesn't expose that
 * method, returns `0` and the harness reports zero leaks (no false positives).
 */
export function countAllListeners(player: IPlayer): number {
	const fn = (player as unknown as { listenerCount?: () => number }).listenerCount;
	return typeof fn === 'function' ? fn.call(player) : 0;
}

/**
 * Register / exercise / tear down a subject (plugin, sub-system, anything that
 * uses the player's event bus). Snapshot before + after, assert listener count
 * returns to the baseline.
 *
 * Caller wires the lifecycle so the harness stays decoupled from how plugins
 * are registered (which varies between players + over time):
 *
 * ```ts
 * await assertNoListenerLeak({
 *   subjectId: 'lyrics',
 *   player,
 *   setup: () => player.addPlugin(LyricsPlugin),
 *   exercise: async () => {
 *     await player.load(track);
 *     player.emit('time', { time: 5 });
 *   },
 *   teardown: () => player.removePlugin(LyricsPlugin),
 * });
 * ```
 *
 * The `exercise` step is optional — it lets the test trigger code paths that
 * register late listeners (e.g. handlers attached on first `play()`). Without
 * it the harness only catches leaks from `setup()`.
 *
 * Throws an `Error` with a structured message when `leaked > 0` so Vitest /
 * Jest surface a clear failure. Otherwise resolves with the result for any
 * tooling that wants to inspect the numbers.
 */
export async function assertNoListenerLeak(opts: {
	subjectId: string;
	player: IPlayer;
	setup: () => void | Promise<void>;
	exercise?: () => void | Promise<void>;
	teardown: () => void | Promise<void>;
}): Promise<LeakAssertionResult> {
	const listenersBefore = countAllListeners(opts.player);

	await opts.setup();
	const listenersAfterSetup = countAllListeners(opts.player);

	if (opts.exercise)
		await opts.exercise();

	await opts.teardown();
	const listenersAfterTeardown = countAllListeners(opts.player);

	const leaked = listenersAfterTeardown - listenersBefore;
	const result: LeakAssertionResult = {
		subjectId: opts.subjectId,
		listenersBefore,
		listenersAfterSetup,
		listenersAfterTeardown,
		leaked,
	};

	if (leaked > 0) {
		throw new StateError({
			code: 'core:test/listener-leak',
			severity: 'error',
			scope: {
				kind: 'plugin',
				id: opts.subjectId,
			},
			message: `[leak-harness] "${opts.subjectId}" leaked ${leaked} listener(s). before=${listenersBefore} afterSetup=${listenersAfterSetup} afterTeardown=${listenersAfterTeardown}.`,
			suggestion: 'Register listeners via `this.on()` / `this.listen()`, or pair every manual `player.on()` with `off()` in dispose().',
			context: {
				leaked,
				before: listenersBefore,
				afterSetup: listenersAfterSetup,
				afterTeardown: listenersAfterTeardown,
			},
		});
	}

	return result;
}

/**
 * Register / exercise / tear down repeatedly to catch state-sensitive leaks
 * (e.g. handlers added every nth `play()`). Default 5 iterations; bump for
 * suspicious subjects.
 */
export async function assertNoListenerLeakOverCycles(opts: {
	subjectId: string;
	player: IPlayer;
	setup: () => void | Promise<void>;
	exercise?: () => void | Promise<void>;
	teardown: () => void | Promise<void>;
	cycles?: number;
}): Promise<LeakAssertionResult[]> {
	const cycles = opts.cycles ?? 5;
	const results: LeakAssertionResult[] = [];
	for (let i = 0; i < cycles; i++) {
		results.push(await assertNoListenerLeak({
			subjectId: `${opts.subjectId}#${i + 1}`,
			player: opts.player,
			setup: opts.setup,
			exercise: opts.exercise,
			teardown: opts.teardown,
		}));
	}
	return results;
}
