// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Locks the platform-policy wires (`pauseWhenHidden`, `onOffline`, `wakeLock`)
 * and the `now()` clock source. Builds a custom in-memory IPlatform
 * so visibility / network / wake-lock state changes are deterministic.
 */

import type { IPlatform } from '../adapters/platform/browser';
import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
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
	declare play: (opts?: any) => Promise<void>;
	declare pause: (opts?: any) => Promise<void>;
	declare now: () => number;

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

interface FakeHandles {
	platform: IPlatform;
	flipVisibility: (visible: boolean) => void;
	flipNetwork: (online: boolean) => void;
	wakeLock: {
		acquire: ReturnType<typeof vi.fn>;
		release: ReturnType<typeof vi.fn>;
		isHeld: () => boolean;
	};
}

function buildFakePlatform(): FakeHandles {
	const visListeners = new Set<(visible: boolean) => void>();
	const netListeners = new Set<(state: { online: boolean; type: any }) => void>();
	let online = true;
	let visible = true;
	let held = false;

	const acquire = vi.fn(async () => {
		held = true;
	});
	const release = vi.fn(async () => {
		held = false;
	});

	const platform: IPlatform = {
		wakeLock: {
			acquire,
			release,
			isHeld: () => held,
			isSupported: () => true,
		},
		network: {
			isOnline: () => online,
			type: () => 'wifi',
			downlinkMbps: () => undefined,
			rttMs: () => undefined,
			subscribe(fn) {
				netListeners.add(fn);
				return () => netListeners.delete(fn);
			},
		},
		visibility: {
			isVisible: () => visible,
			subscribe(fn) {
				visListeners.add(fn);
				return () => visListeners.delete(fn);
			},
		},
		capabilities: {
			canDecode: async () => ({ supported: true, smooth: true, powerEfficient: true }),
		},
	};

	return {
		platform,
		flipVisibility(isVisible: boolean) {
			visible = isVisible;
			for (const fn of visListeners) fn(isVisible);
		},
		flipNetwork(state: boolean) {
			online = state;
			for (const fn of netListeners) fn({ online: state, type: 'wifi' });
		},
		wakeLock: { acquire, release, isHeld: () => held },
	};
}

describe('policies — pauseWhenHidden / onOffline / wakeLock + now()', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	// ── pauseWhenHidden ──

	it('pauseWhenHidden:true → visibility false fires visibility:hidden AND calls pause', async () => {
		const fake = buildFakePlatform();
		const mockPlayer = makePlayer('pol-vis-on').setup({
			platform: fake.platform,
			pauseWhenHidden: true,
		});
		await mockPlayer.ready();
		await mockPlayer.play();

		const events: string[] = [];
		const pausePromise = new Promise<void>((resolve) => {
			mockPlayer.on('pause' as any, () => {
				resolve();
			});
		});
		mockPlayer.on('visibility:hidden' as any, () => events.push('visibility:hidden'));

		fake.flipVisibility(false);
		await pausePromise;

		expect(events).toContain('visibility:hidden');
	});

	it('pauseWhenHidden:false (default) → visibility false fires no pause', async () => {
		const fake = buildFakePlatform();
		const mockPlayer = makePlayer('pol-vis-off').setup({
			platform: fake.platform,
		});
		await mockPlayer.ready();
		await mockPlayer.play();

		let pauseFired = false;
		mockPlayer.on('pause' as any, () => {
			pauseFired = true;
		});

		fake.flipVisibility(false);
		await new Promise(resolve => setTimeout(resolve, 10));

		expect(pauseFired).toBe(false);
	});

	// ── onOffline ──

	it('onOffline:\'pause\' → offline emits network:offline AND calls pause', async () => {
		const fake = buildFakePlatform();
		const mockPlayer = makePlayer('pol-net-pause').setup({
			platform: fake.platform,
			onOffline: 'pause',
		});
		await mockPlayer.ready();
		await mockPlayer.play();

		const events: string[] = [];
		const pausePromise = new Promise<void>((resolve) => {
			mockPlayer.on('pause' as any, () => {
				resolve();
			});
		});
		mockPlayer.on('network:offline' as any, () => events.push('network:offline'));

		fake.flipNetwork(false);
		await pausePromise;

		expect(events).toContain('network:offline');
	});

	it('onOffline:\'continue-buffered\' (default) → emits network:offline but does NOT call pause', async () => {
		const fake = buildFakePlatform();
		const mockPlayer = makePlayer('pol-net-continue').setup({
			platform: fake.platform,
		});
		await mockPlayer.ready();
		await mockPlayer.play();

		const events: string[] = [];
		let pauseFired = false;
		mockPlayer.on('network:offline' as any, () => events.push('network:offline'));
		mockPlayer.on('pause' as any, () => {
			pauseFired = true;
		});

		fake.flipNetwork(false);
		await new Promise(resolve => setTimeout(resolve, 10));

		expect(events).toContain('network:offline');
		expect(pauseFired).toBe(false);
	});

	it('onOffline:\'ignore\' → emits NEITHER network:offline NOR pauses', async () => {
		const fake = buildFakePlatform();
		const mockPlayer = makePlayer('pol-net-ignore').setup({
			platform: fake.platform,
			onOffline: 'ignore',
		});
		await mockPlayer.ready();
		await mockPlayer.play();

		const events: string[] = [];
		let pauseFired = false;
		mockPlayer.on('network:offline' as any, () => events.push('network:offline'));
		mockPlayer.on('pause' as any, () => {
			pauseFired = true;
		});

		fake.flipNetwork(false);
		await new Promise(resolve => setTimeout(resolve, 10));

		expect(events).not.toContain('network:offline');
		expect(pauseFired).toBe(false);
	});

	// ── wakeLock ──

	it('wakeLock:\'always\' → acquire() once at setup, release() at dispose', async () => {
		const fake = buildFakePlatform();
		const mockPlayer = makePlayer('pol-wl-always').setup({
			platform: fake.platform,
			wakeLock: 'always',
		});
		await mockPlayer.ready();
		// Wait for the floating promise from acquire().catch(...).
		await Promise.resolve();
		await Promise.resolve();

		expect(fake.wakeLock.acquire).toHaveBeenCalledTimes(1);
		expect(fake.wakeLock.release).not.toHaveBeenCalled();

		mockPlayer.dispose();
		await Promise.resolve();
		await Promise.resolve();

		expect(fake.wakeLock.release).toHaveBeenCalled();
	});

	it('wakeLock:\'auto\' → acquire on starting/playing, release on paused/stopped/ended/disposed', async () => {
		const fake = buildFakePlatform();
		const mockPlayer = makePlayer('pol-wl-auto').setup({
			platform: fake.platform,
			wakeLock: 'auto',
		});
		await mockPlayer.ready();

		expect(fake.wakeLock.acquire).not.toHaveBeenCalled();

		await mockPlayer.play(); // ready → starting fires phase event
		await Promise.resolve();
		await Promise.resolve();
		expect(fake.wakeLock.acquire).toHaveBeenCalled();

		await mockPlayer.pause(); // starting → paused
		await Promise.resolve();
		await Promise.resolve();
		expect(fake.wakeLock.release).toHaveBeenCalled();
	});

	it('wakeLock:\'never\' (default) → acquire never called', async () => {
		const fake = buildFakePlatform();
		const mockPlayer = makePlayer('pol-wl-never').setup({
			platform: fake.platform,
		});
		await mockPlayer.ready();
		await mockPlayer.play();
		await Promise.resolve();
		await Promise.resolve();

		expect(fake.wakeLock.acquire).not.toHaveBeenCalled();
	});

	// ── now() / clockSource ──

	it('now() returns Date.now() by default', async () => {
		const mockPlayer = makePlayer('pol-now-default').setup({});
		await mockPlayer.ready();
		const before = Date.now();
		const got = mockPlayer.now();
		const after = Date.now();
		expect(got).toBeGreaterThanOrEqual(before);
		expect(got).toBeLessThanOrEqual(after);
	});

	it('now() returns clockSource() value when configured', async () => {
		const mockPlayer = makePlayer('pol-now-custom').setup({ clockSource: () => 12345 });
		await mockPlayer.ready();
		expect(mockPlayer.now()).toBe(12345);
	});
});
