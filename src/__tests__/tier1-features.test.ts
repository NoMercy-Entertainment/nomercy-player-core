/**
 * Tier 1 plugin-spec features. Locks the just-landed kit behaviour so a
 * future regression on:
 *  - `static replaces` swap (spec §3.1)
 *  - `requires.minVersion` enforcement
 *  - `static minCoreVersion` enforcement
 *  - `static priority` ordering in `enabledPlugins()`
 *  - per-plugin namespaced lifecycle events (spec §1.5)
 *  - phase machine transitions (spec §D — partial: play / pause / stop)
 *
 * Mirrors the conventions in `base-player.test.ts`: a self-contained MockPlayer
 * built on the kit's shared mixins so we exercise the real spine, not a stub.
 */

import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KIT_VERSION } from '../base-player';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	Plugin,
	resolvePlayerConstructor,
} from '../index';

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = <HTMLElement>{};

	get id(): string {
		return this.playerId;
	}

	declare options: any;
	declare setup: (config: any) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare phase: () => string;
	declare addPlugin: (PluginClass: any, opts?: any) => this;
	declare getPlugin: (PluginClass: any) => any;
	declare getPluginById: (id: string) => any;
	declare removePlugin: (PluginClass: any) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<any>;
	declare enabledPlugins: () => ReadonlyArray<any>;
	declare play: (opts?: any) => Promise<void>;
	declare pause: (opts?: any) => Promise<void>;
	declare stop: (opts?: any) => Promise<void>;
	declare t: (key: string, vars?: Record<string, string>) => string;
	declare currentTime: { (): number; (t: number, opts?: any): Promise<void> };
	declare volume: { (): number; (v: number): void };
	declare experimental: {
		override: (method: string, fn: (...args: any[]) => any) => () => void;
		restore: (method: string) => void;
		overrides: () => Array<{ method: string; by: string }>;
	};

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayer' });

		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing') {
			return resolved.instance as unknown as this;
		}
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void {
		_instances.clear();
	}
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

describe('Tier 1 plugin features', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	// ── A. static `replaces` swap (spec §3.1) ───────────────────────────────

	describe('static replaces swap', () => {
		class FooV1 extends Plugin {
			static override readonly id = 'foo';
			static override readonly version = '1.0.0';
		}
		class FooV2 extends Plugin {
			static override readonly id = 'foo-v2';
			static override readonly replaces = 'foo';
			static override readonly version = '2.0.0';
		}

		it('disposes V1 BEFORE installing V2 when V1 is already registered', async () => {
			const p = makePlayer('a-swap-1').setup({});
			p.addPlugin(FooV1);
			await p.ready();

			const order: string[] = [];
			let disposedPayload: { id: string } | undefined;
			let installedPayload: { id: string; version: string } | undefined;

			p.on('plugin:disposed' as any, (data: any) => {
				order.push('disposed');
				disposedPayload = data;
			});
			p.on('plugin:installed' as any, (data: any) => {
				order.push('installed');
				installedPayload = data;
			});

			p.addPlugin(FooV2);
			await p.ready();

			expect(order).toEqual(['disposed', 'installed']);
			expect(disposedPayload).toEqual({ id: 'foo' });
			expect(installedPayload).toEqual({ id: 'foo-v2', version: '2.0.0' });
		});

		it('installs V2 cleanly when no V1 is present (no-match is not an error)', async () => {
			const p = makePlayer('a-swap-2').setup({});
			let installedPayload: { id: string; version: string } | undefined;
			let disposedFired = false;
			p.on('plugin:installed' as any, (data: any) => {
				installedPayload = data;
			});
			p.on('plugin:disposed' as any, () => {
				disposedFired = true;
			});

			expect(() => p.addPlugin(FooV2)).not.toThrow();
			await p.ready();

			expect(disposedFired).toBe(false);
			expect(installedPayload).toEqual({ id: 'foo-v2', version: '2.0.0' });
			expect(p.getPluginById('foo-v2')).toBeDefined();
		});

		it('removes a queued swap target without firing plugin:disposed', async () => {
			const p = makePlayer('a-swap-3');
			p.addPlugin(FooV1);
			p.addPlugin(FooV2);

			let disposedFired = false;
			const installedIds: string[] = [];
			p.on('plugin:disposed' as any, () => {
				disposedFired = true;
			});
			p.on('plugin:installed' as any, (data: any) => {
				installedIds.push(data.id);
			});

			p.setup({});
			await p.ready();

			expect(disposedFired).toBe(false);
			expect(installedIds).toEqual(['foo-v2']);
			expect(p.getPluginById('foo')).toBeUndefined();
			expect(p.getPluginById('foo-v2')).toBeDefined();
		});
	});

	// ── B. requires.minVersion check ────────────────────────────────────────

	describe('requires.minVersion', () => {
		class Lib extends Plugin {
			static override readonly id = 'lib';
			static override readonly version = '2.0.0';
		}
		class NeedsV3 extends Plugin {
			static override readonly id = 'needs-v3';
			static override readonly requires = [{ plugin: Lib, minVersion: '3.0.0' }];
		}
		class NeedsV2 extends Plugin {
			static override readonly id = 'needs-v2';
			static override readonly requires = [{ plugin: Lib, minVersion: '2.0.0' }];
		}

		it('throws core:plugin/version-mismatch when installed < required', async () => {
			const p = makePlayer('b-ver-1').setup({});
			p.addPlugin(Lib);
			await p.ready();

			let err: any;
			try { p.addPlugin(NeedsV3); }
			catch (e) { err = e; }
			expect(err).toBeDefined();
			expect(err.code).toBe('core:plugin/version-mismatch');
		});

		it('succeeds when installed == required minVersion', async () => {
			const p = makePlayer('b-ver-2').setup({});
			expect(() => p.addPlugin(Lib).addPlugin(NeedsV2)).not.toThrow();
			await p.ready();
			expect(p.getPluginById('needs-v2')).toBeDefined();
		});

		it('error context carries installedVersion / requiredVersion / requires', async () => {
			const p = makePlayer('b-ver-3').setup({});
			p.addPlugin(Lib);
			await p.ready();

			let err: any;
			try { p.addPlugin(NeedsV3); }
			catch (e) { err = e; }
			expect(err).toBeDefined();
			expect(err.context).toMatchObject({
				id: 'needs-v3',
				requires: 'lib',
				requiredVersion: '3.0.0',
				installedVersion: '2.0.0',
			});
		});
	});

	// ── C. static minCoreVersion check ──────────────────────────────────────

	describe('static minCoreVersion', () => {
		class NeedsHighCore extends Plugin {
			static override readonly id = 'needs-high';
			static override readonly minCoreVersion = '99.0.0';
		}

		it('throws core:plugin/incompatible-core-version with kitVersion + requiredCoreVersion context', () => {
			const p = makePlayer('c-core').setup({});
			let err: any;
			try { p.addPlugin(NeedsHighCore); }
			catch (e) { err = e; }
			expect(err).toBeDefined();
			expect(err.code).toBe('core:plugin/incompatible-core-version');
			expect(err.context).toMatchObject({
				id: 'needs-high',
				requiredCoreVersion: '99.0.0',
				kitVersion: KIT_VERSION,
			});
		});
	});

	// ── D. static priority ordering in enabledPlugins() ─────────────────────

	describe('static priority ordering', () => {
		class High extends Plugin {
			static override readonly id = 'high';
			static override readonly priority = 100;
		}
		class Mid extends Plugin {
			static override readonly id = 'mid';
			static override readonly priority = 50;
		}
		class Reg extends Plugin {
			static override readonly id = 'reg';
		}
		class Low extends Plugin {
			static override readonly id = 'low';
			static override readonly priority = -10;
		}

		it('orders by priority descending regardless of registration order', async () => {
			const p = makePlayer('d-prio-1').setup({});
			// Register out-of-order: Reg, Low, High, Mid
			p.addPlugin(Reg).addPlugin(Low).addPlugin(High).addPlugin(Mid);
			await p.ready();

			const ids = p.enabledPlugins().map((pl: any) => (pl.constructor as typeof Plugin).id);
			expect(ids).toEqual(['high', 'mid', 'reg', 'low']);
		});

		it('breaks ties on equal priority by registration order', async () => {
			class A extends Plugin {
				static override readonly id = 'tie-a';
				static override readonly priority = 0;
			}
			class B extends Plugin {
				static override readonly id = 'tie-b';
				static override readonly priority = 0;
			}
			const p = makePlayer('d-prio-2').setup({});
			p.addPlugin(A).addPlugin(B);
			await p.ready();

			const ids = p.enabledPlugins().map((pl: any) => (pl.constructor as typeof Plugin).id);
			expect(ids).toEqual(['tie-a', 'tie-b']);
		});
	});

	// ── E. Per-plugin namespaced lifecycle events (spec §1.5) ───────────────

	describe('per-plugin namespaced lifecycle events', () => {
		class Hello extends Plugin {
			static override readonly id = 'hello';
			static override readonly version = '1.0.0';
		}

		it('fires plugin:hello:installed alongside plugin:installed with matching payload', async () => {
			const p = makePlayer('e-install').setup({});
			let global: { id: string; version: string } | undefined;
			let scoped: { id: string; version: string } | undefined;
			p.on('plugin:installed' as any, (data: any) => {
				global = data;
			});
			p.on('plugin:hello:installed' as any, (data: any) => {
				scoped = data;
			});

			p.addPlugin(Hello);
			await p.ready();

			expect(global).toEqual({ id: 'hello', version: '1.0.0' });
			expect(scoped).toEqual({ id: 'hello', version: '1.0.0' });
		});

		it('fires plugin:hello:enabled and plugin:hello:disabled alongside the global events', async () => {
			const p = makePlayer('e-toggle').setup({});
			p.addPlugin(Hello);
			await p.ready();
			const inst = p.getPluginById('hello');
			expect(inst).toBeDefined();
			inst.disable('test-reason'); // start disabled so enable() is non-noop

			let scopedEnabled: { id: string } | undefined;
			let globalEnabled: { id: string } | undefined;
			let scopedDisabled: { id: string; reason?: string } | undefined;
			let globalDisabled: { id: string; reason?: string } | undefined;
			p.on('plugin:enabled' as any, (data: any) => {
				globalEnabled = data;
			});
			p.on('plugin:hello:enabled' as any, (data: any) => {
				scopedEnabled = data;
			});
			p.on('plugin:disabled' as any, (data: any) => {
				globalDisabled = data;
			});
			p.on('plugin:hello:disabled' as any, (data: any) => {
				scopedDisabled = data;
			});

			inst.enable();
			expect(globalEnabled).toEqual({ id: 'hello' });
			expect(scopedEnabled).toEqual({ id: 'hello' });

			inst.disable('shut-down');
			expect(globalDisabled).toEqual({ id: 'hello', reason: 'shut-down' });
			expect(scopedDisabled).toEqual({ id: 'hello', reason: 'shut-down' });
		});

		it('fires plugin:hello:disposed alongside plugin:disposed on removePlugin', async () => {
			const p = makePlayer('e-dispose').setup({});
			p.addPlugin(Hello);
			await p.ready();

			let global: { id: string } | undefined;
			let scoped: { id: string } | undefined;
			p.on('plugin:disposed' as any, (data: any) => {
				global = data;
			});
			p.on('plugin:hello:disposed' as any, (data: any) => {
				scoped = data;
			});

			p.removePlugin(Hello);

			expect(global).toEqual({ id: 'hello' });
			expect(scoped).toEqual({ id: 'hello' });
		});

		it('fires plugin:hello:opts:changed alongside plugin:opts:changed on options()', async () => {
			const p = makePlayer('e-opts').setup({});
			p.addPlugin(Hello);
			await p.ready();
			const inst = p.getPluginById('hello');

			let global: { id: string; opts: any } | undefined;
			let scopedSeen = 0;
			p.on('plugin:opts:changed' as any, (data: any) => {
				global = data;
			});
			p.on('plugin:hello:opts:changed' as any, () => {
				scopedSeen += 1;
			});

			inst.options({ foo: 'bar' });

			expect(global).toBeDefined();
			expect(global!.id).toBe('hello');
			expect(global!.opts).toMatchObject({ foo: 'bar' });
			// Spec §1.5 requires the namespaced channel to fire; the kit also
			// echoes via the plugin's own emit() (see plugin.ts setOptions),
			// so accept >= 1.
			expect(scopedSeen).toBeGreaterThanOrEqual(1);
		});
	});

	// ── G. experimental.override (real interception) ────────────────────────

	describe('experimental.override (real interception)', () => {
		it('override replaces method; restore returns original', async () => {
			const p = makePlayer('g-override-1').setup({});
			await p.ready();
			expect(p.volume()).toBe(1);
			const unbind = p.experimental.override('volume', () => 0.42);
			expect(p.volume()).toBe(0.42);
			unbind();
			expect(p.volume()).toBe(1);
		});

		it('override records caller in overrides()', async () => {
			const p = makePlayer('g-override-2').setup({});
			await p.ready();
			const unbind = p.experimental.override('volume', () => 0);
			const list = p.experimental.overrides();
			expect(list.find(o => o.method === 'volume')?.by).toBe('consumer');
			unbind();
		});

		it('restore() removes the override', async () => {
			const p = makePlayer('g-override-3').setup({});
			await p.ready();
			p.experimental.override('volume', () => 0);
			p.experimental.restore('volume');
			expect(p.volume()).toBe(1);
		});
	});

	// ── F. Phase transitions (spec §D — partial) ────────────────────────────

	describe('phase transitions (spec §D)', () => {
		it('walks idle → setup → ready → starting → paused → stopped', async () => {
			const p = makePlayer('f-phase');
			const transitions: Array<{ from: string; to: string }> = [];
			p.on('phase' as any, ({ from, to }: any) => {
				transitions.push({ from, to });
			});
			expect(p.phase()).toBe('idle');

			p.setup({});
			await p.ready();
			expect(p.phase()).toBe('ready');

			await p.play();
			// firstFrame is not emitted by anything yet, so phase sits at 'starting'.
			expect(p.phase()).toBe('starting');

			await p.pause();
			expect(p.phase()).toBe('paused');

			await p.stop();
			expect(p.phase()).toBe('stopped');

			expect(transitions).toEqual([
				{ from: 'idle', to: 'setup' },
				{ from: 'setup', to: 'ready' },
				{ from: 'ready', to: 'starting' },
				{ from: 'starting', to: 'paused' },
				{ from: 'paused', to: 'stopped' },
			]);
		});
	});
});
