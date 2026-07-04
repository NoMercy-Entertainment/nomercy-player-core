// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Locks the player-level activity tracker: the built-in pointer/touch/key
 * wiring, the inactivity countdown (hide only while playing), the `.active` /
 * `.inactive` container classes it drives through the container-class rules,
 * the `inactivityMs` config knob, and the `activityTracking(false)` takeover
 * used by richer UI plugins.
 */

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
	declare dispose: () => Promise<void>;
	declare play: (opts?: any) => Promise<void>;
	declare pause: (opts?: any) => Promise<void>;
	declare bumpActivity: () => void;
	declare activityTracking: (enabled?: boolean) => boolean;

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

function pointerMove(target: HTMLElement): void {
	target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
}

describe('activity — player-level tracker + inactivityMs + activityTracking()', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		vi.useRealTimers();
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('setup() bumps once: activity {active:true} emitted and container gains .active', async () => {
		const events: boolean[] = [];
		const mockPlayer = makePlayer('act-initial');
		mockPlayer.on('activity' as any, ({ active }: { active: boolean }) => events.push(active));

		mockPlayer.setup({});
		await mockPlayer.ready();

		expect(events).toEqual([true]);
		expect(mockPlayer.container.classList.contains('active')).toBe(true);
	});

	it('while playing, the countdown expiry emits {active:false} and swaps .active for .inactive', async () => {
		const mockPlayer = makePlayer('act-hide').setup({});
		await mockPlayer.ready();
		await mockPlayer.play();

		vi.useFakeTimers();
		mockPlayer.bumpActivity();
		vi.advanceTimersByTime(4000);

		expect(mockPlayer.container.classList.contains('active')).toBe(false);
		expect(mockPlayer.container.classList.contains('inactive')).toBe(true);
	});

	it('while paused, the countdown expiry does NOT hide', async () => {
		const mockPlayer = makePlayer('act-paused').setup({});
		await mockPlayer.ready();
		await mockPlayer.play();
		await mockPlayer.pause();

		vi.useFakeTimers();
		mockPlayer.bumpActivity();
		vi.advanceTimersByTime(60000);

		expect(mockPlayer.container.classList.contains('active')).toBe(true);
		expect(mockPlayer.container.classList.contains('inactive')).toBe(false);
	});

	it('pointer input on the container wakes a hidden UI back to .active', async () => {
		const mockPlayer = makePlayer('act-wake').setup({});
		await mockPlayer.ready();
		await mockPlayer.play();

		vi.useFakeTimers();
		mockPlayer.bumpActivity();
		vi.advanceTimersByTime(4000);
		expect(mockPlayer.container.classList.contains('inactive')).toBe(true);

		pointerMove(mockPlayer.container);

		expect(mockPlayer.container.classList.contains('active')).toBe(true);
		expect(mockPlayer.container.classList.contains('inactive')).toBe(false);
	});

	it('resuming playback re-arms the countdown (play event bumps)', async () => {
		const mockPlayer = makePlayer('act-resume').setup({});
		await mockPlayer.ready();
		await mockPlayer.play();
		await mockPlayer.pause();

		vi.useFakeTimers();
		mockPlayer.bumpActivity();
		vi.advanceTimersByTime(60000);
		expect(mockPlayer.container.classList.contains('active')).toBe(true);

		await mockPlayer.play();
		vi.advanceTimersByTime(4000);

		expect(mockPlayer.container.classList.contains('active')).toBe(false);
		expect(mockPlayer.container.classList.contains('inactive')).toBe(true);
	});

	it('a custom inactivityMs drives the countdown', async () => {
		const mockPlayer = makePlayer('act-custom').setup({ inactivityMs: 1000 });
		await mockPlayer.ready();
		await mockPlayer.play();

		vi.useFakeTimers();
		mockPlayer.bumpActivity();
		vi.advanceTimersByTime(999);
		expect(mockPlayer.container.classList.contains('active')).toBe(true);

		vi.advanceTimersByTime(1);
		expect(mockPlayer.container.classList.contains('inactive')).toBe(true);
	});

	it('inactivityMs: 0 disables the tracker entirely', async () => {
		const events: boolean[] = [];
		const mockPlayer = makePlayer('act-disabled');
		mockPlayer.on('activity' as any, ({ active }: { active: boolean }) => events.push(active));

		mockPlayer.setup({ inactivityMs: 0 });
		await mockPlayer.ready();

		pointerMove(mockPlayer.container);

		expect(events).toEqual([]);
		expect(mockPlayer.activityTracking()).toBe(false);
		expect(mockPlayer.container.classList.contains('active')).toBe(false);
	});

	it('activityTracking(false) clears the armed countdown and stands the listeners down', async () => {
		const mockPlayer = makePlayer('act-takeover').setup({});
		await mockPlayer.ready();
		await mockPlayer.play();

		vi.useFakeTimers();
		mockPlayer.bumpActivity();
		mockPlayer.activityTracking(false);
		vi.advanceTimersByTime(60000);

		expect(mockPlayer.container.classList.contains('active')).toBe(true);

		const events: boolean[] = [];
		mockPlayer.on('activity' as any, ({ active }: { active: boolean }) => events.push(active));
		pointerMove(mockPlayer.container);

		expect(events).toEqual([]);
		expect(mockPlayer.activityTracking()).toBe(false);
	});

	it('the desync guard force-re-emits {active:true} when a consumer stripped the class directly', async () => {
		const mockPlayer = makePlayer('act-desync').setup({});
		await mockPlayer.ready();

		mockPlayer.emit('activity' as any, { active: false });
		expect(mockPlayer.container.classList.contains('active')).toBe(false);

		mockPlayer.bumpActivity();

		expect(mockPlayer.container.classList.contains('active')).toBe(true);
	});

	it('dispose() releases the listeners and any armed countdown', async () => {
		const mockPlayer = makePlayer('act-dispose').setup({});
		await mockPlayer.ready();
		await mockPlayer.play();

		vi.useFakeTimers();
		mockPlayer.bumpActivity();
		const container = mockPlayer.container;
		await mockPlayer.dispose();

		const events: boolean[] = [];
		mockPlayer.on('activity' as any, ({ active }: { active: boolean }) => events.push(active));
		pointerMove(container);
		vi.advanceTimersByTime(60000);

		expect(events).toEqual([]);
	});
});
