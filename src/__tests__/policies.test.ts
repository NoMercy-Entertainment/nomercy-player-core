/**
 * Locks the platform-policy wires (`pauseWhenHidden`, `onOffline`, `wakeLock`)
 * and the `now()` clock source per spec §G. Builds a custom in-memory IPlatform
 * so visibility / network / wake-lock state changes are deterministic.
 */

import type { IPlatform } from '../platform';
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
	const visListeners = new Set<(v: boolean) => void>();
	const netListeners = new Set<(s: { online: boolean; type: any }) => void>();
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
		flipVisibility(v: boolean) {
			visible = v;
			for (const fn of visListeners) fn(v);
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
		const p = makePlayer('pol-vis-on').setup({
			platform: fake.platform,
			pauseWhenHidden: true,
		});
		await p.ready();
		await p.play();

		const events: string[] = [];
		const pausePromise = new Promise<void>((resolve) => {
			p.on('pause' as any, () => {
				resolve();
			});
		});
		p.on('visibility:hidden' as any, () => events.push('visibility:hidden'));

		fake.flipVisibility(false);
		await pausePromise;

		expect(events).toContain('visibility:hidden');
	});

	it('pauseWhenHidden:false (default) → visibility false fires no pause', async () => {
		const fake = buildFakePlatform();
		const p = makePlayer('pol-vis-off').setup({
			platform: fake.platform,
		});
		await p.ready();
		await p.play();

		let pauseFired = false;
		p.on('pause' as any, () => {
			pauseFired = true;
		});

		fake.flipVisibility(false);
		await new Promise(r => setTimeout(r, 10));

		expect(pauseFired).toBe(false);
	});

	// ── onOffline ──

	it('onOffline:\'pause\' → offline emits network:offline AND calls pause', async () => {
		const fake = buildFakePlatform();
		const p = makePlayer('pol-net-pause').setup({
			platform: fake.platform,
			onOffline: 'pause',
		});
		await p.ready();
		await p.play();

		const events: string[] = [];
		const pausePromise = new Promise<void>((resolve) => {
			p.on('pause' as any, () => {
				resolve();
			});
		});
		p.on('network:offline' as any, () => events.push('network:offline'));

		fake.flipNetwork(false);
		await pausePromise;

		expect(events).toContain('network:offline');
	});

	it('onOffline:\'continue-buffered\' (default) → emits network:offline but does NOT call pause', async () => {
		const fake = buildFakePlatform();
		const p = makePlayer('pol-net-continue').setup({
			platform: fake.platform,
		});
		await p.ready();
		await p.play();

		const events: string[] = [];
		let pauseFired = false;
		p.on('network:offline' as any, () => events.push('network:offline'));
		p.on('pause' as any, () => {
			pauseFired = true;
		});

		fake.flipNetwork(false);
		await new Promise(r => setTimeout(r, 10));

		expect(events).toContain('network:offline');
		expect(pauseFired).toBe(false);
	});

	it('onOffline:\'ignore\' → emits NEITHER network:offline NOR pauses', async () => {
		const fake = buildFakePlatform();
		const p = makePlayer('pol-net-ignore').setup({
			platform: fake.platform,
			onOffline: 'ignore',
		});
		await p.ready();
		await p.play();

		const events: string[] = [];
		let pauseFired = false;
		p.on('network:offline' as any, () => events.push('network:offline'));
		p.on('pause' as any, () => {
			pauseFired = true;
		});

		fake.flipNetwork(false);
		await new Promise(r => setTimeout(r, 10));

		expect(events).not.toContain('network:offline');
		expect(pauseFired).toBe(false);
	});

	// ── wakeLock ──

	it('wakeLock:\'always\' → acquire() once at setup, release() at dispose', async () => {
		const fake = buildFakePlatform();
		const p = makePlayer('pol-wl-always').setup({
			platform: fake.platform,
			wakeLock: 'always',
		});
		await p.ready();
		// Wait for the floating promise from acquire().catch(...).
		await Promise.resolve();
		await Promise.resolve();

		expect(fake.wakeLock.acquire).toHaveBeenCalledTimes(1);
		expect(fake.wakeLock.release).not.toHaveBeenCalled();

		p.dispose();
		await Promise.resolve();
		await Promise.resolve();

		expect(fake.wakeLock.release).toHaveBeenCalled();
	});

	it('wakeLock:\'auto\' → acquire on starting/playing, release on paused/stopped/ended/disposed', async () => {
		const fake = buildFakePlatform();
		const p = makePlayer('pol-wl-auto').setup({
			platform: fake.platform,
			wakeLock: 'auto',
		});
		await p.ready();

		expect(fake.wakeLock.acquire).not.toHaveBeenCalled();

		await p.play(); // ready → starting fires phase event
		await Promise.resolve();
		await Promise.resolve();
		expect(fake.wakeLock.acquire).toHaveBeenCalled();

		await p.pause(); // starting → paused
		await Promise.resolve();
		await Promise.resolve();
		expect(fake.wakeLock.release).toHaveBeenCalled();
	});

	it('wakeLock:\'never\' (default) → acquire never called', async () => {
		const fake = buildFakePlatform();
		const p = makePlayer('pol-wl-never').setup({
			platform: fake.platform,
		});
		await p.ready();
		await p.play();
		await Promise.resolve();
		await Promise.resolve();

		expect(fake.wakeLock.acquire).not.toHaveBeenCalled();
	});

	// ── now() / clockSource ──

	it('now() returns Date.now() by default', async () => {
		const p = makePlayer('pol-now-default').setup({});
		await p.ready();
		const before = Date.now();
		const got = p.now();
		const after = Date.now();
		expect(got).toBeGreaterThanOrEqual(before);
		expect(got).toBeLessThanOrEqual(after);
	});

	it('now() returns clockSource() value when configured', async () => {
		const p = makePlayer('pol-now-custom').setup({ clockSource: () => 12345 });
		await p.ready();
		expect(p.now()).toBe(12345);
	});
});
