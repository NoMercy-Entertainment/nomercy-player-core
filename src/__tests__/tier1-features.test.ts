// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

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
	declare time: { (): number; (t: number, opts?: any): Promise<void> };
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
			const mockPlayer = makePlayer('a-swap-1').setup({});
			mockPlayer.addPlugin(FooV1);
			await mockPlayer.ready();

			const order: string[] = [];
			let disposedPayload: { id: string } | undefined;
			let installedPayload: { id: string; version: string } | undefined;

			mockPlayer.on('plugin:disposed' as any, (data: any) => {
				order.push('disposed');
				disposedPayload = data;
			});
			mockPlayer.on('plugin:installed' as any, (data: any) => {
				order.push('installed');
				installedPayload = data;
			});

			mockPlayer.addPlugin(FooV2);
			await mockPlayer.ready();

			expect(order).toEqual(['disposed', 'installed']);
			expect(disposedPayload).toEqual({ id: 'foo' });
			expect(installedPayload).toEqual({ id: 'foo-v2', version: '2.0.0' });
		});

		it('installs V2 cleanly when no V1 is present (no-match is not an error)', async () => {
			const mockPlayer = makePlayer('a-swap-2').setup({});
			let installedPayload: { id: string; version: string } | undefined;
			let disposedFired = false;
			mockPlayer.on('plugin:installed' as any, (data: any) => {
				installedPayload = data;
			});
			mockPlayer.on('plugin:disposed' as any, () => {
				disposedFired = true;
			});

			expect(() => mockPlayer.addPlugin(FooV2)).not.toThrow();
			await mockPlayer.ready();

			expect(disposedFired).toBe(false);
			expect(installedPayload).toEqual({ id: 'foo-v2', version: '2.0.0' });
			expect(mockPlayer.getPluginById('foo-v2')).toBeDefined();
		});

		it('removes a queued swap target without firing plugin:disposed', async () => {
			const mockPlayer = makePlayer('a-swap-3');
			mockPlayer.addPlugin(FooV1);
			mockPlayer.addPlugin(FooV2);

			let disposedFired = false;
			const installedIds: string[] = [];
			mockPlayer.on('plugin:disposed' as any, () => {
				disposedFired = true;
			});
			mockPlayer.on('plugin:installed' as any, (data: any) => {
				installedIds.push(data.id);
			});

			mockPlayer.setup({});
			await mockPlayer.ready();

			expect(disposedFired).toBe(false);
			expect(installedIds).toEqual(['foo-v2']);
			expect(mockPlayer.getPluginById('foo')).toBeUndefined();
			expect(mockPlayer.getPluginById('foo-v2')).toBeDefined();
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
			const mockPlayer = makePlayer('b-ver-1').setup({});
			mockPlayer.addPlugin(Lib);
			await mockPlayer.ready();

			let err: any;
			try { mockPlayer.addPlugin(NeedsV3); }
			catch (error) { err = error; }
			expect(err).toBeDefined();
			expect(err.code).toBe('core:plugin/version-mismatch');
		});

		it('succeeds when installed == required minVersion', async () => {
			const mockPlayer = makePlayer('b-ver-2').setup({});
			expect(() => mockPlayer.addPlugin(Lib).addPlugin(NeedsV2)).not.toThrow();
			await mockPlayer.ready();
			expect(mockPlayer.getPluginById('needs-v2')).toBeDefined();
		});

		it('error context carries installedVersion / requiredVersion / requires', async () => {
			const mockPlayer = makePlayer('b-ver-3').setup({});
			mockPlayer.addPlugin(Lib);
			await mockPlayer.ready();

			let err: any;
			try { mockPlayer.addPlugin(NeedsV3); }
			catch (error) { err = error; }
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
			const mockPlayer = makePlayer('c-core').setup({});
			let err: any;
			try { mockPlayer.addPlugin(NeedsHighCore); }
			catch (error) { err = error; }
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
			const mockPlayer = makePlayer('d-prio-1').setup({});
			// Register out-of-order: Reg, Low, High, Mid
			mockPlayer.addPlugin(Reg).addPlugin(Low).addPlugin(High).addPlugin(Mid);
			await mockPlayer.ready();

			const ids = mockPlayer.enabledPlugins().map((pl: any) => (pl.constructor as typeof Plugin).id);
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
			const mockPlayer = makePlayer('d-prio-2').setup({});
			mockPlayer.addPlugin(A).addPlugin(B);
			await mockPlayer.ready();

			const ids = mockPlayer.enabledPlugins().map((pl: any) => (pl.constructor as typeof Plugin).id);
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
			const mockPlayer = makePlayer('e-install').setup({});
			let global: { id: string; version: string } | undefined;
			let scoped: { id: string; version: string } | undefined;
			mockPlayer.on('plugin:installed' as any, (data: any) => {
				global = data;
			});
			mockPlayer.on('plugin:hello:installed' as any, (data: any) => {
				scoped = data;
			});

			mockPlayer.addPlugin(Hello);
			await mockPlayer.ready();

			expect(global).toEqual({ id: 'hello', version: '1.0.0' });
			expect(scoped).toEqual({ id: 'hello', version: '1.0.0' });
		});

		it('fires plugin:hello:enabled and plugin:hello:disabled alongside the global events', async () => {
			const mockPlayer = makePlayer('e-toggle').setup({});
			mockPlayer.addPlugin(Hello);
			await mockPlayer.ready();
			const inst = mockPlayer.getPluginById('hello');
			expect(inst).toBeDefined();
			inst.disable('test-reason'); // start disabled so enable() is non-noop

			let scopedEnabled: { id: string } | undefined;
			let globalEnabled: { id: string } | undefined;
			let scopedDisabled: { id: string; reason?: string } | undefined;
			let globalDisabled: { id: string; reason?: string } | undefined;
			mockPlayer.on('plugin:enabled' as any, (data: any) => {
				globalEnabled = data;
			});
			mockPlayer.on('plugin:hello:enabled' as any, (data: any) => {
				scopedEnabled = data;
			});
			mockPlayer.on('plugin:disabled' as any, (data: any) => {
				globalDisabled = data;
			});
			mockPlayer.on('plugin:hello:disabled' as any, (data: any) => {
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
			const mockPlayer = makePlayer('e-dispose').setup({});
			mockPlayer.addPlugin(Hello);
			await mockPlayer.ready();

			let global: { id: string } | undefined;
			let scoped: { id: string } | undefined;
			mockPlayer.on('plugin:disposed' as any, (data: any) => {
				global = data;
			});
			mockPlayer.on('plugin:hello:disposed' as any, (data: any) => {
				scoped = data;
			});

			mockPlayer.removePlugin(Hello);

			expect(global).toEqual({ id: 'hello' });
			expect(scoped).toEqual({ id: 'hello' });
		});

		it('fires plugin:hello:opts:changed alongside plugin:opts:changed on options()', async () => {
			const mockPlayer = makePlayer('e-opts').setup({});
			mockPlayer.addPlugin(Hello);
			await mockPlayer.ready();
			const inst = mockPlayer.getPluginById('hello');

			let global: { id: string; opts: any } | undefined;
			let scopedSeen = 0;
			mockPlayer.on('plugin:opts:changed' as any, (data: any) => {
				global = data;
			});
			mockPlayer.on('plugin:hello:opts:changed' as any, () => {
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
			const mockPlayer = makePlayer('g-override-1').setup({});
			await mockPlayer.ready();
			expect(mockPlayer.volume()).toBe(100);
			const unbind = mockPlayer.experimental.override('volume', () => 42);
			expect(mockPlayer.volume()).toBe(42);
			unbind();
			expect(mockPlayer.volume()).toBe(100);
		});

		it('override records caller in overrides()', async () => {
			const mockPlayer = makePlayer('g-override-2').setup({});
			await mockPlayer.ready();
			const unbind = mockPlayer.experimental.override('volume', () => 0);
			const list = mockPlayer.experimental.overrides();
			expect(list.find(o => o.method === 'volume')?.by).toBe('consumer');
			unbind();
		});

		it('restore() removes the override', async () => {
			const mockPlayer = makePlayer('g-override-3').setup({});
			await mockPlayer.ready();
			mockPlayer.experimental.override('volume', () => 0);
			mockPlayer.experimental.restore('volume');
			expect(mockPlayer.volume()).toBe(100);
		});
	});

	// ── F. Phase transitions (spec §D — partial) ────────────────────────────

	describe('phase transitions (spec §D)', () => {
		it('walks idle → setup → ready → starting → paused → stopped', async () => {
			const mockPlayer = makePlayer('f-phase');
			const transitions: Array<{ from: string; to: string }> = [];
			mockPlayer.on('phase' as any, ({ from, to }: any) => {
				transitions.push({ from, to });
			});
			expect(mockPlayer.phase()).toBe('idle');

			mockPlayer.setup({});
			await mockPlayer.ready();
			expect(mockPlayer.phase()).toBe('ready');

			await mockPlayer.play();
			// firstFrame is not emitted by anything yet, so phase sits at 'starting'.
			expect(mockPlayer.phase()).toBe('starting');

			await mockPlayer.pause();
			expect(mockPlayer.phase()).toBe('paused');

			await mockPlayer.stop();
			expect(mockPlayer.phase()).toBe('stopped');

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
