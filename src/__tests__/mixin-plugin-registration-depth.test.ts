// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * plugin-registration mixin depth tests.
 *
 * Covers the remaining uncovered paths beyond what slice-00/03 + plugin.test.ts
 * already touch:
 *
 *  - _compareSemver: all comparison branches including pre-release rules
 *  - addPlugin: use-after-dispose throws, missing dep (optional vs required),
 *    version mismatch, minCoreVersion incompatible, replaces removes queued entry,
 *    pre-setup queuing, post-setup inline run
 *  - _registerPlugin: duplicate-id guard, use() timeout, use() error cascade
 *  - removePluginById: cascade, cascade:false throws has-dependents
 *  - enabledPlugins: priority ordering
 *  - _findDependents: cross-registered + queued scanning
 *  - _pluginLangLoadedSet / _markPluginLangLoaded
 */

import type { StubPlayer } from '../testing/stub-player';
import type { BaseEventMap, PluginCtorWithId } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	Plugin,
	resolvePlayerConstructor,
	StateError,
} from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// Minimal MockPlayer
// ─────────────────────────────────────────────────────────────────────────────

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = {} as HTMLElement;
	get id(): string { return this.playerId; }

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => Promise<void>;
	declare phase: () => string;
	declare dispatching: () => ReadonlyArray<string>;
	declare baseUrl: { (): string | undefined; (url: string): void };
	declare audioContext: () => AudioContext | undefined;
	declare experimental: unknown;
	declare t: {
		(key: string, vars?: Record<string, string>): string;
		(PluginClass: PluginCtorWithId, key: string, vars?: Record<string, string>): string;
	};

	declare language: { (): string; (lang: string): Promise<void> };
	declare addTranslations: (bundle: unknown) => void;
	declare translation: (lang: string, key: string, value: string) => void;
	declare removeTranslations: (prefix: string, lang?: string) => void;
	declare registerCueParser: (parser: unknown, prepend?: boolean) => void;
	declare unregisterCueParser: (id: string) => void;
	declare play: (opts?: unknown) => Promise<void>;
	declare pause: (opts?: unknown) => Promise<void>;
	declare stop: (opts?: unknown) => Promise<void>;
	declare togglePlayback: (opts?: unknown) => Promise<void>;
	declare next: (opts?: unknown) => Promise<void>;
	declare previous: (opts?: unknown) => Promise<void>;
	declare rewind: (seconds?: number, opts?: unknown) => Promise<void>;
	declare forward: (seconds?: number, opts?: unknown) => Promise<void>;
	declare restart: (opts?: unknown) => Promise<void>;
	declare time: { (): number; (seconds: number, opts?: unknown): Promise<void> };
	declare duration: () => number;
	declare buffered: () => number;
	declare timeData: () => unknown;
	declare playbackRate: { (): number; (rate: number): void };
	declare playbackRates: () => number[];
	declare volume: { (): number; (level: number): void };
	declare mute: () => void;
	declare unmute: () => void;
	declare toggleMute: () => void;
	declare volumeUp: (step?: number) => void;
	declare volumeDown: (step?: number) => void;
	declare playState: () => string;
	declare volumeState: () => string;
	declare repeatState: { (): string; (state: unknown): void };
	declare shuffleState: { (): string; (state: unknown): void };
	declare queue: { (): ReadonlyArray<unknown>; (items: unknown[], opts?: unknown): void };
	declare queueAppend: (item: unknown, opts?: unknown) => void;
	declare queuePrepend: (item: unknown, opts?: unknown) => void;
	declare queueInsert: (item: unknown, index: number, opts?: unknown) => void;
	declare queueRemove: (id: unknown, opts?: unknown) => void;
	declare queueRemoveAt: (index: number, opts?: unknown) => void;
	declare queueMove: (from: number, to: number, opts?: unknown) => void;
	declare queueClear: (opts?: unknown) => void;
	declare queueShuffle: (opts?: unknown) => void;
	declare queueSort: (compare: unknown, opts?: unknown) => void;
	declare peekNext: () => unknown;
	declare peekPrevious: () => unknown;
	declare queueLength: () => number;
	declare queueIndexOf: (id: unknown) => number;
	declare item: { (): unknown; (target: unknown, opts?: unknown): void };
	declare index: () => number;
	declare backlog: { (): ReadonlyArray<unknown>; (items: unknown[]): void };
	declare backlogAppend: (item: unknown) => void;
	declare backlogRemove: (id: unknown) => void;
	declare backlogClear: () => void;
	declare addPlugin: <P extends Plugin<any, any, any>>(
		PluginClass: PluginCtorWithId & (new () => P),
		opts?: P['opts'],
	) => this;

	declare getPlugin: (PluginClass: unknown) => unknown;
	declare getPluginById: (id: string) => unknown;
	declare removePlugin: (PluginClass: unknown) => void;
	declare removePluginById: (id: string, opts?: { cascade?: boolean }) => void;
	declare plugins: () => ReadonlyArray<Plugin>;
	declare enabledPlugins: () => ReadonlyArray<Plugin>;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing')
			return resolved.instance as unknown as this;
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void { _instances.clear(); }
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

// ─────────────────────────────────────────────────────────────────────────────
// Plugin fixtures
// ─────────────────────────────────────────────────────────────────────────────

class AlphaPlugin extends Plugin<StubPlayer> {
	static override readonly id = 'alpha';
	static override readonly version = '1.0.0';
	static override readonly description = 'Alpha';
	override use(): void {}
	override dispose(): void {}
}

class BetaPlugin extends Plugin<StubPlayer> {
	static override readonly id = 'beta';
	static override readonly version = '2.0.0';
	static override readonly description = 'Beta';
	static override readonly requires = [AlphaPlugin];
	override use(): void {}
	override dispose(): void {}
}

class GammaPlugin extends Plugin<StubPlayer> {
	static override readonly id = 'gamma';
	static override readonly version = '1.5.0';
	static override readonly description = 'Gamma';
	static override readonly requires = [BetaPlugin];
	override use(): void {}
	override dispose(): void {}
}

class FailingPlugin extends Plugin<StubPlayer> {
	static override readonly id = 'failing';
	static override readonly version = '1.0.0';
	static override readonly description = 'Failing';
	override use(): void { throw new Error('use() failure'); }
	override dispose(): void {}
}

class AsyncFailingPlugin extends Plugin<StubPlayer> {
	static override readonly id = 'async-failing';
	static override readonly version = '1.0.0';
	static override readonly description = 'AsyncFailing';
	override async use(): Promise<void> { throw new Error('async use() failure'); }
	override dispose(): void {}
}

class LowPriorityPlugin extends Plugin<StubPlayer> {
	static override readonly id = 'low-priority';
	static override readonly version = '1.0.0';
	static override readonly description = 'Low';
	static override readonly priority = 10;
	override use(): void {}
	override dispose(): void {}
}

class HighPriorityPlugin extends Plugin<StubPlayer> {
	static override readonly id = 'high-priority';
	static override readonly version = '1.0.0';
	static override readonly description = 'High';
	static override readonly priority = 100;
	override use(): void {}
	override dispose(): void {}
}

class SlowPlugin extends Plugin<StubPlayer> {
	static override readonly id = 'slow';
	static override readonly version = '1.0.0';
	static override readonly description = 'Slow';
	override use(): Promise<void> {
		return new Promise<void>((resolve) => {
			setTimeout(resolve, 100_000); // will be time-limited
		});
	}

	override dispose(): void {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function setupPlayer(opts: Record<string, unknown> = {}): MockPlayer {
	const div = document.createElement('div');
	div.id = 'pr-mock';
	document.body.appendChild(div);
	return new MockPlayer('pr-mock').setup(opts);
}

function waitForEvent(player: MockPlayer, event: string): Promise<unknown> {
	return new Promise((resolve) => {
		player.on(event as never, (data: unknown) => resolve(data));
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// addPlugin — lifecycle error paths
// ─────────────────────────────────────────────────────────────────────────────

describe('addPlugin — lifecycle error paths', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('throws StateError with core:lifecycle/use-plugin-after-dispose when player is disposed', async () => {
		const player = setupPlayer();
		await player.dispose();
		expect(() => player.addPlugin(AlphaPlugin)).toThrow(StateError);
	});

	it('throws pluginError core:plugin/duplicate-id when adding same plugin twice', () => {
		const player = setupPlayer();
		player.addPlugin(AlphaPlugin);
		expect(() => player.addPlugin(AlphaPlugin)).toThrow();
	});

	it('throws core:plugin/missing-dep when required plugin is absent', () => {
		const player = setupPlayer();
		expect(() => player.addPlugin(BetaPlugin)).toThrow();
	});

	it('does NOT throw for optional missing dependency', () => {
		class OptionalDepPlugin extends Plugin<StubPlayer> {
			static override readonly id = 'opt-dep';
			static override readonly version = '1.0.0';
			static override readonly description = 'OptionalDep';
			static override readonly requires = [{ plugin: AlphaPlugin, optional: true }];
			override use(): void {}
			override dispose(): void {}
		}
		const player = setupPlayer();
		expect(() => player.addPlugin(OptionalDepPlugin)).not.toThrow();
	});

	it('throws core:plugin/version-mismatch when dep version is below minVersion', () => {
		class VersionRequirer extends Plugin<StubPlayer> {
			static override readonly id = 'version-requirer';
			static override readonly version = '1.0.0';
			static override readonly description = 'VersionRequirer';
			static override readonly requires = [{ plugin: AlphaPlugin, minVersion: '9.9.9' }];
			override use(): void {}
			override dispose(): void {}
		}
		const player = setupPlayer();
		player.addPlugin(AlphaPlugin);
		expect(() => player.addPlugin(VersionRequirer)).toThrow();
	});

	it('does NOT throw when dep version meets minVersion', () => {
		class VersionRequirer extends Plugin<StubPlayer> {
			static override readonly id = 'version-requirer-ok';
			static override readonly version = '1.0.0';
			static override readonly description = 'VersionRequirerOk';
			static override readonly requires = [{ plugin: AlphaPlugin, minVersion: '1.0.0' }];
			override use(): void {}
			override dispose(): void {}
		}
		const player = setupPlayer();
		player.addPlugin(AlphaPlugin);
		expect(() => player.addPlugin(VersionRequirer)).not.toThrow();
	});

	it('throws core:plugin/incompatible-core-version when minCoreVersion exceeds kit version', () => {
		class FuturePlugin extends Plugin<StubPlayer> {
			static override readonly id = 'future';
			static override readonly version = '1.0.0';
			static override readonly description = 'Future';
			static override readonly minCoreVersion = '999.0.0';
			override use(): void {}
			override dispose(): void {}
		}
		const player = setupPlayer();
		expect(() => player.addPlugin(FuturePlugin)).toThrow();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// addPlugin — replaces
// ─────────────────────────────────────────────────────────────────────────────

describe('addPlugin — replaces', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
		vi.useRealTimers();
	});

	it('replaces a queued plugin with the replacement (pre-setup queue)', () => {
		const div = document.createElement('div');
		div.id = 'pr-mock';
		document.body.appendChild(div);
		const player = new MockPlayer('pr-mock');
		// still in idle phase — plugins go to queue

		class AlphaV2 extends Plugin<StubPlayer> {
			static override readonly id = 'alpha-v2';
			static override readonly version = '2.0.0';
			static override readonly description = 'AlphaV2';
			static override readonly replaces = 'alpha';
			override use(): void {}
			override dispose(): void {}
		}

		player.addPlugin(AlphaPlugin);
		player.addPlugin(AlphaV2);

		const queue = (player as unknown as { _pluginQueue: Array<{ ctor: PluginCtorWithId }> })._pluginQueue;
		const alphaInQueue = queue.some(queued => queued.ctor.id === 'alpha');
		expect(alphaInQueue).toBe(false);
		const alphaV2InQueue = queue.some(queued => queued.ctor.id === 'alpha-v2');
		expect(alphaV2InQueue).toBe(true);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// config.plugins — declarative registration (sugar over addPlugin())
// ─────────────────────────────────────────────────────────────────────────────

class OptsPlugin extends Plugin<StubPlayer, { label?: string }> {
	static override readonly id = 'opts-plugin';
	static override readonly version = '1.0.0';
	static override readonly description = 'Records the opts it was constructed with.';
	receivedLabel: string | undefined;
	override use(): void {
		this.receivedLabel = this.opts.label;
	}

	override dispose(): void {}
}

describe('config.plugins — declarative registration', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('registers a bare class ref passed via config.plugins', async () => {
		const player = setupPlayer({ plugins: [AlphaPlugin] });
		await player.ready();
		expect(player.getPlugin(AlphaPlugin)).toBeDefined();
	});

	it('registers the { plugin, opts } object form and passes opts through to use()', async () => {
		const player = setupPlayer({ plugins: [{ plugin: OptsPlugin, opts: { label: 'from-config' } }] });
		await player.ready();
		const instance = player.getPlugin(OptsPlugin) as OptsPlugin | undefined;
		expect(instance?.receivedLabel).toBe('from-config');
	});

	it('registers multiple entries in array order, resolving requires() across config entries', async () => {
		const player = setupPlayer({ plugins: [AlphaPlugin, BetaPlugin] });
		await player.ready();
		expect(player.getPlugin(AlphaPlugin)).toBeDefined();
		expect(player.getPlugin(BetaPlugin)).toBeDefined();
	});

	it('throws core:plugin/duplicate-id synchronously — same guard as manual addPlugin()', () => {
		expect(() => setupPlayer({ plugins: [AlphaPlugin, AlphaPlugin] })).toThrow();
	});

	it('throws core:plugin/missing-dep synchronously when a config-declared dependency is absent', () => {
		expect(() => setupPlayer({ plugins: [BetaPlugin] })).toThrow();
	});

	it('fires plugin:installed with the same payload shape addPlugin() produces', async () => {
		const player = setupPlayer({ plugins: [AlphaPlugin] });
		const installed = await waitForEvent(player, 'plugin:installed');
		expect((installed as { id: string }).id).toBe('alpha');
	});

	it('resolves requires() against a dependency registered via manual addPlugin() before setup()', async () => {
		const div = document.createElement('div');
		div.id = 'pr-mock-mixed';
		document.body.appendChild(div);
		const player = new MockPlayer('pr-mock-mixed');
		player.addPlugin(AlphaPlugin);
		player.setup({ plugins: [BetaPlugin] });
		await player.ready();
		expect(player.getPlugin(AlphaPlugin)).toBeDefined();
		expect(player.getPlugin(BetaPlugin)).toBeDefined();
	});

	it('does nothing when config.plugins is omitted', async () => {
		const player = setupPlayer();
		await player.ready();
		expect(player.getPlugin(AlphaPlugin)).toBeUndefined();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// _registerPlugin — failure + cascade
// ─────────────────────────────────────────────────────────────────────────────

describe('_registerPlugin — failure + cascade', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
		vi.useRealTimers();
	});

	it('emits plugin:failed when use() throws synchronously', async () => {
		const player = setupPlayer();
		const failedPayloads: Array<{ id: string; error: Error }> = [];
		player.on('plugin:failed' as never, (data: { id: string; error: Error }) => failedPayloads.push(data));

		const failedP = waitForEvent(player, 'plugin:failed');
		player.addPlugin(FailingPlugin);
		await failedP;

		expect(failedPayloads).toHaveLength(1);
		expect(failedPayloads[0]!.id).toBe('failing');
	});

	it('plugin NOT added to plugins() after synchronous use() failure', async () => {
		const player = setupPlayer();
		const failedP = waitForEvent(player, 'plugin:failed');
		player.addPlugin(FailingPlugin);
		await failedP;

		expect(player.plugins().map(plugin => (plugin.constructor as PluginCtorWithId).id)).not.toContain('failing');
	});

	it('emits plugin:failed when use() throws asynchronously', async () => {
		const player = setupPlayer();
		const failedPayloads: Array<{ id: string; error: Error }> = [];
		player.on('plugin:failed' as never, (data: { id: string; error: Error }) => failedPayloads.push(data));

		const failedP = waitForEvent(player, 'plugin:failed');
		player.addPlugin(AsyncFailingPlugin);
		await failedP;

		expect(failedPayloads[0]!.id).toBe('async-failing');
	});

	it('cascade: dependent plugin is disabled when its dependency fails', async () => {
		const player = setupPlayer();

		class FailingWithDep extends Plugin<StubPlayer> {
			static override readonly id = 'failing-with-dep';
			static override readonly version = '1.0.0';
			static override readonly description = 'FailingWithDep';
			override use(): void { throw new Error('dep failed'); }
			override dispose(): void {}
		}

		class DependsOnFailingDep extends Plugin<StubPlayer> {
			static override readonly id = 'depends-on-failing-dep';
			static override readonly version = '1.0.0';
			static override readonly description = 'DependsOnFailingDep';
			static override readonly requires = [FailingWithDep];
			override use(): void {}
			override dispose(): void {}
		}

		player.addPlugin(FailingWithDep);
		player.addPlugin(DependsOnFailingDep);

		await waitForEvent(player, 'plugin:failed');

		const activeIds = player.plugins().map(plugin => (plugin.constructor as PluginCtorWithId).id);
		// The plugin whose use() threw is disabled...
		expect(activeIds).not.toContain('failing-with-dep');
		// ...and its dependent is cascade-disabled too (_cascadeDisable).
		expect(activeIds).not.toContain('depends-on-failing-dep');
	});

	it('use() timeout emits plugin:failed with timeout error', async () => {
		vi.useFakeTimers();

		try {
			const player = setupPlayer({ pluginInitTimeoutMs: 50 });
			const failedPayloads: Array<{ id: string; error: Error }> = [];
			player.on('plugin:failed' as never, (data: { id: string; error: Error }) => failedPayloads.push(data));

			player.addPlugin(SlowPlugin);

			// Advance past the 50ms pluginInitTimeoutMs — this fires the reject() timer
			// inside _registerPlugin's Promise.race. Do NOT call vi.runAllTimersAsync()
			// here because SlowPlugin.use() creates a 100_000ms timer that would cause
			// an infinite-loop abort inside vitest's fake-timers loop.
			await vi.advanceTimersByTimeAsync(100);

			// Let the rejected Promise.race chain propagate through microtasks.
			await Promise.resolve();
			await Promise.resolve();

			expect(failedPayloads.some(entry => entry.id === 'slow')).toBe(true);
		}
		finally {
			vi.useRealTimers();
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// removePluginById — cascade
// ─────────────────────────────────────────────────────────────────────────────

describe('removePluginById — cascade semantics', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('cascade:false throws core:plugin/has-dependents when dependents exist', async () => {
		const player = setupPlayer();

		const alphaInstalledP = waitForEvent(player, 'plugin:installed');
		player.addPlugin(AlphaPlugin);
		await alphaInstalledP;

		const betaInstalledP = waitForEvent(player, 'plugin:installed');
		player.addPlugin(BetaPlugin);
		await betaInstalledP;

		expect(() => player.removePluginById('alpha', { cascade: false })).toThrow();
	});

	it('cascade (default) removes alpha AND its dependent beta', async () => {
		const player = setupPlayer();

		const alphaInstalledP = waitForEvent(player, 'plugin:installed');
		player.addPlugin(AlphaPlugin);
		await alphaInstalledP;

		const betaInstalledP = waitForEvent(player, 'plugin:installed');
		player.addPlugin(BetaPlugin);
		await betaInstalledP;

		player.removePluginById('alpha');

		const ids = player.plugins().map(plugin => (plugin.constructor as PluginCtorWithId).id);
		expect(ids).not.toContain('alpha');
		expect(ids).not.toContain('beta');
	});

	it('cascade (default) removes alpha AND its transitive chain beta + gamma', async () => {
		const player = setupPlayer();

		for (const PluginClass of [AlphaPlugin, BetaPlugin, GammaPlugin]) {
			const installedP = waitForEvent(player, 'plugin:installed');
			player.addPlugin(PluginClass);
			await installedP;
		}

		// gamma → beta → alpha. Removing the root must cascade the whole chain.
		player.removePluginById('alpha');

		const ids = player.plugins().map(plugin => (plugin.constructor as PluginCtorWithId).id);
		expect(ids).not.toContain('alpha');
		expect(ids).not.toContain('beta');
		expect(ids).not.toContain('gamma');
	});

	it('removePlugin() emits plugin:disposed', async () => {
		const player = setupPlayer();
		const installedP = waitForEvent(player, 'plugin:installed');
		player.addPlugin(AlphaPlugin);
		await installedP;

		const disposedEvents: Array<{ id: string }> = [];
		player.on('plugin:disposed' as never, (data: { id: string }) => disposedEvents.push(data));

		player.removePlugin(AlphaPlugin);

		expect(disposedEvents).toHaveLength(1);
		expect(disposedEvents[0]!.id).toBe('alpha');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// enabledPlugins — priority ordering
// ─────────────────────────────────────────────────────────────────────────────

describe('enabledPlugins() — priority ordering', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('returns enabled plugins sorted by static priority descending', async () => {
		const player = setupPlayer();

		const lowP = waitForEvent(player, 'plugin:installed');
		player.addPlugin(LowPriorityPlugin);
		await lowP;

		const highP = waitForEvent(player, 'plugin:installed');
		player.addPlugin(HighPriorityPlugin);
		await highP;

		const enabled = player.enabledPlugins();
		const ids = enabled.map(plugin => (plugin.constructor as PluginCtorWithId).id);
		expect(ids[0]).toBe('high-priority');
		expect(ids[1]).toBe('low-priority');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// getPlugin / getPluginById
// ─────────────────────────────────────────────────────────────────────────────

describe('getPlugin / getPluginById', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('getPlugin() returns the instance typed by class', async () => {
		const player = setupPlayer();
		const installedP = waitForEvent(player, 'plugin:installed');
		player.addPlugin(AlphaPlugin);
		await installedP;

		const instance = player.getPlugin(AlphaPlugin);
		expect(instance).toBeInstanceOf(AlphaPlugin);
	});

	it('getPlugin() returns undefined for unregistered plugin', () => {
		const player = setupPlayer();
		expect(player.getPlugin(AlphaPlugin)).toBeUndefined();
	});

	it('getPluginById() returns instance by string id', async () => {
		const player = setupPlayer();
		const installedP = waitForEvent(player, 'plugin:installed');
		player.addPlugin(AlphaPlugin);
		await installedP;

		expect(player.getPluginById('alpha')).toBeInstanceOf(AlphaPlugin);
	});

	it('getPluginById() returns undefined for unknown id', () => {
		const player = setupPlayer();
		expect(player.getPluginById('nonexistent')).toBeUndefined();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// _compareSemver: internal compare (tested via version-mismatch throws)
// ─────────────────────────────────────────────────────────────────────────────

describe('_compareSemver via addPlugin version checks', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('1.0.0 vs 1.0.0 — equal — no throw', async () => {
		class ExactVersionRequirer extends Plugin<StubPlayer> {
			static override readonly id = 'exact-ver';
			static override readonly version = '1.0.0';
			static override readonly description = 'ExactVer';
			static override readonly requires = [{ plugin: AlphaPlugin, minVersion: '1.0.0' }];
			override use(): void {}
			override dispose(): void {}
		}
		const player = setupPlayer();
		player.addPlugin(AlphaPlugin);
		expect(() => player.addPlugin(ExactVersionRequirer)).not.toThrow();
	});

	it('1.0.1 installed vs 1.0.0 required — passes', async () => {
		class PatchedAlpha extends Plugin<StubPlayer> {
			static override readonly id = 'alpha-patched';
			static override readonly version = '1.0.1';
			static override readonly description = 'AlphaPatched';
			override use(): void {}
			override dispose(): void {}
		}
		class RequiresPatchedAlpha extends Plugin<StubPlayer> {
			static override readonly id = 'req-patched-alpha';
			static override readonly version = '1.0.0';
			static override readonly description = 'ReqPatchedAlpha';
			static override readonly requires = [{ plugin: PatchedAlpha, minVersion: '1.0.0' }];
			override use(): void {}
			override dispose(): void {}
		}
		const player = setupPlayer();
		player.addPlugin(PatchedAlpha);
		expect(() => player.addPlugin(RequiresPatchedAlpha)).not.toThrow();
	});

	it('pre-release 1.0.0-alpha < 1.0.0 final — correctly triggers version mismatch', () => {
		class PreReleasePlugin extends Plugin<StubPlayer> {
			static override readonly id = 'pre-alpha-plugin';
			static override readonly version = '1.0.0-alpha';
			static override readonly description = 'PreAlphaPlugin';
			override use(): void {}
			override dispose(): void {}
		}
		class RequiresFinal extends Plugin<StubPlayer> {
			static override readonly id = 'req-final';
			static override readonly version = '1.0.0';
			static override readonly description = 'ReqFinal';
			static override readonly requires = [{ plugin: PreReleasePlugin, minVersion: '1.0.0' }];
			override use(): void {}
			override dispose(): void {}
		}
		const player = setupPlayer();
		player.addPlugin(PreReleasePlugin);
		expect(() => player.addPlugin(RequiresFinal)).toThrow();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// _pluginLangLoadedSet / _markPluginLangLoaded
// ─────────────────────────────────────────────────────────────────────────────

describe('_pluginLangLoadedSet / _markPluginLangLoaded', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('_pluginLangLoadedSet returns undefined before any mark', () => {
		const player = setupPlayer();
		const internals = player as unknown as {
			_pluginLangLoadedSet: () => Set<string> | undefined;
		};
		expect(internals._pluginLangLoadedSet()).toBeUndefined();
	});

	it('_markPluginLangLoaded creates set and adds entry', () => {
		const player = setupPlayer();
		const internals = player as unknown as {
			_pluginLangLoadedSet: () => Set<string> | undefined;
			_markPluginLangLoaded: (id: string, lang: string) => void;
		};
		internals._markPluginLangLoaded('alpha', 'en');
		const set = internals._pluginLangLoadedSet();
		expect(set).toBeDefined();
		expect(set!.has('alpha::en')).toBe(true);
	});

	it('repeated marks accumulate entries', () => {
		const player = setupPlayer();
		const internals = player as unknown as {
			_pluginLangLoadedSet: () => Set<string> | undefined;
			_markPluginLangLoaded: (id: string, lang: string) => void;
		};
		internals._markPluginLangLoaded('alpha', 'en');
		internals._markPluginLangLoaded('alpha', 'fr');
		internals._markPluginLangLoaded('beta', 'en');
		const set = internals._pluginLangLoadedSet();
		expect(set!.size).toBe(3);
	});
});
