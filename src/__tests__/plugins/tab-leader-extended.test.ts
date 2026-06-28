// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended coverage for `TabLeaderPlugin` — targets the uncovered functions:
 *  - requestLock() — returns existing pending promise when already pending
 *  - requestLock() — emits 'unsupported' when locks API is absent
 *  - requestLock() — calls navigator.locks.request and sets _isLeader
 *  - requestLeadership() — backward-compat alias
 *  - releaseLock() — leader-released emit + mute action
 *  - releaseLock() — no-op when not leader and no _release
 *  - getLockKey() — default key
 *  - dispose() delegates to releaseLock()
 */

import type { BaseEventMap } from '../../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../../index';
import { TabLeaderPlugin } from '../../plugins/tab-leader';
import { LifecycleRegistry } from '../../adapters/lifecycle-registry/default';

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
	declare addPlugin: (PluginClass: any, opts?: any) => this;
	declare getPlugin: (PluginClass: any) => any;
	declare pause: (opts?: any) => Promise<void>;
	declare mute: () => void;

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
	const p = new MockPlayer(divId);
	(p as any).pause = vi.fn().mockResolvedValue(undefined);
	(p as any).mute = vi.fn();
	return p;
}

function makePlugin(player: MockPlayer, opts?: ConstructorParameters<typeof TabLeaderPlugin>[0]): TabLeaderPlugin {
	const plugin = new TabLeaderPlugin();
	plugin.initialize(player as any, opts, new LifecycleRegistry());
	return plugin;
}

type NavWithLocks = typeof navigator & {
	locks?: {
		request: (key: string, cb: (lock: unknown) => Promise<void>) => Promise<void>;
	};
};

const originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');

function stubLocks(fn: NavWithLocks['locks']): void {
	Object.defineProperty(navigator, 'locks', {
		configurable: true,
		get: () => fn,
	});
}

function removeLocks(): void {
	Object.defineProperty(navigator, 'locks', {
		configurable: true,
		get: () => undefined,
	});
}

function restoreLocks(): void {
	if (originalLocksDescriptor) {
		Object.defineProperty(navigator, 'locks', originalLocksDescriptor);
	}
	else {
		removeLocks();
	}
}

describe('TabLeaderPlugin extended', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		restoreLocks();
		document.body.innerHTML = '';
	});

	describe('requestLock() — unsupported environment', () => {
		it('emits unsupported and resolves when navigator.locks is absent', async () => {
			removeLocks();
			const p = makePlayer('tl-1');
			const plugin = makePlugin(p);
			const events: string[] = [];
			p.on('plugin:tab-leader:unsupported' as any, () => events.push('unsupported'));
			const result = await plugin.requestLock();
			expect(result).toBeUndefined();
			expect(events).toContain('unsupported');
		});
	});

	describe('requestLock() — Web Locks available', () => {
		it('returns the existing pending promise when called while already pending', () => {
			// Create a lock that we can control manually via _release
			let innerRelease!: () => void;
			const lockRequest = vi.fn((_key: string, cb: (lock: unknown) => Promise<void>) => {
				// Simulate the lock being granted: cb runs immediately, its inner promise
				// only resolves when _release() is called later.
				const inner = new Promise<void>((res) => { innerRelease = res; });
				void cb({});
				return inner;
			});
			stubLocks({ request: lockRequest });
			const p = makePlayer('tl-2');
			const plugin = makePlugin(p);

			const p1 = plugin.requestLock();
			const p2 = plugin.requestLock();
			expect(p1).toBe(p2);

			// Clean up — let the inner promise settle so no dangling timers.
			innerRelease?.();
		});

		it('sets _isLeader to true and emits leader-acquired when lock granted', async () => {
			let innerRelease!: () => void;
			const lockRequest = vi.fn((_key: string, cb: (lock: unknown) => Promise<void>) => {
				const inner = new Promise<void>((res) => { innerRelease = res; });
				// cb is called synchronously — sets _isLeader inside it
				const cbResult = cb({});
				// Resolve the outer locks.request promise immediately after cb returns
				void cbResult;
				// The outer locks.request resolves when cb's returned promise resolves.
				// We simulate immediate resolution so requestLock()'s .then() fires.
				innerRelease();
				return Promise.resolve();
			});
			stubLocks({ request: lockRequest });
			const p = makePlayer('tl-3');
			const plugin = makePlugin(p);
			const events: string[] = [];
			p.on('plugin:tab-leader:leader-acquired' as any, () => events.push('acquired'));

			await plugin.requestLock();

			expect(plugin.isLeader()).toBe(true);
			expect(events).toContain('acquired');
		});

		it('clears _pending to null after lock resolves', async () => {
			const lockRequest = vi.fn((_key: string, cb: (lock: unknown) => Promise<void>) => {
				void cb({});
				return Promise.resolve();
			});
			stubLocks({ request: lockRequest });
			const p = makePlayer('tl-4');
			const plugin = makePlugin(p);

			await plugin.requestLock();

			expect((plugin as any)._pending).toBeNull();
		});

		it('clears _pending to null when lock.request rejects', async () => {
			const lockRequest = vi.fn(() => Promise.reject(new Error('lock failed')));
			stubLocks({ request: lockRequest });
			const p = makePlayer('tl-5');
			const plugin = makePlugin(p);

			await plugin.requestLock();

			expect((plugin as any)._pending).toBeNull();
		});
	});

	describe('requestLeadership()', () => {
		it('resolves to a boolean (isLeader state after lock attempt)', async () => {
			const lockRequest = vi.fn((_key: string, cb: (lock: unknown) => Promise<void>) => {
				void cb({});
				return Promise.resolve();
			});
			stubLocks({ request: lockRequest });
			const p = makePlayer('tl-6');
			const plugin = makePlugin(p);

			const result = await plugin.requestLeadership();

			expect(typeof result).toBe('boolean');
		});
	});

	describe('releaseLock()', () => {
		it('is a no-op when not leader and no _release', () => {
			removeLocks();
			const p = makePlayer('tl-7');
			const plugin = makePlugin(p);
			expect(() => plugin.releaseLock()).not.toThrow();
		});

		it('emits leader-released and calls pause (onLost: "pause" default)', () => {
			removeLocks();
			const p = makePlayer('tl-8');
			const plugin = makePlugin(p, { onLost: 'pause' });

			const events: string[] = [];
			p.on('plugin:tab-leader:leader-released' as any, () => events.push('released'));

			(plugin as any)._isLeader = true;
			(plugin as any)._release = (): void => {};

			plugin.releaseLock();

			expect(events).toContain('released');
			expect((p as any).pause).toHaveBeenCalled();
		});

		it('calls mute when onLost is "mute"', () => {
			removeLocks();
			const p = makePlayer('tl-9');
			const plugin = makePlugin(p, { onLost: 'mute' });

			(plugin as any)._isLeader = true;
			(plugin as any)._release = (): void => {};

			plugin.releaseLock();

			expect((p as any).mute).toHaveBeenCalled();
			expect((p as any).pause).not.toHaveBeenCalled();
		});

		it('does not emit leader-released when _isLeader was false but _release exists', () => {
			removeLocks();
			const p = makePlayer('tl-10');
			const plugin = makePlugin(p);
			const events: string[] = [];
			p.on('plugin:tab-leader:leader-released' as any, () => events.push('released'));

			(plugin as any)._isLeader = false;
			(plugin as any)._release = (): void => {};

			plugin.releaseLock();

			expect(events).not.toContain('released');
		});

		it('swallows errors thrown by the release function', () => {
			removeLocks();
			const p = makePlayer('tl-11');
			const plugin = makePlugin(p);

			(plugin as any)._isLeader = true;
			(plugin as any)._release = (): void => { throw new Error('oops'); };

			expect(() => plugin.releaseLock()).not.toThrow();
		});
	});

	describe('releaseLeadership()', () => {
		it('is a backward-compat alias for releaseLock()', () => {
			removeLocks();
			const p = makePlayer('tl-12');
			const plugin = makePlugin(p);
			const releaseSpy = vi.spyOn(plugin, 'releaseLock');
			plugin.releaseLeadership();
			expect(releaseSpy).toHaveBeenCalled();
		});
	});

	describe('dispose()', () => {
		it('calls releaseLock() on dispose', () => {
			removeLocks();
			const p = makePlayer('tl-13');
			const plugin = makePlugin(p);
			const releaseSpy = vi.spyOn(plugin, 'releaseLock');
			plugin.dispose();
			expect(releaseSpy).toHaveBeenCalled();
		});
	});

	describe('getLockKey()', () => {
		it('returns default key when no getLockKey opt given', () => {
			removeLocks();
			const p = makePlayer('tl-14');
			const plugin = makePlugin(p);
			expect((plugin as any).getLockKey()).toBe('nomercy-player-leader');
		});

		it('returns custom key from opts.getLockKey()', () => {
			removeLocks();
			const p = makePlayer('tl-15');
			const plugin = makePlugin(p, { getLockKey: () => 'custom-key' });
			expect((plugin as any).getLockKey()).toBe('custom-key');
		});
	});
});
