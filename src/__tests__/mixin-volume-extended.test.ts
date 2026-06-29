// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended coverage for `volumeMethods`.
 *
 * Pinned consequences:
 *  VOL-E1. volume() getter returns _internalVolume when unmuted.
 *  VOL-E2. volume() getter returns 0 when muted.
 *  VOL-E3. volume(v) clamps above 100 to 100.
 *  VOL-E4. volume(v) clamps below 0 to 0.
 *  VOL-E5. mute() saves pre-mute volume; subsequent volume() returns 0.
 *  VOL-E6. unmute() restores pre-mute volume.
 *  VOL-E7. toggleMute() from unmuted → muted.
 *  VOL-E8. toggleMute() from muted → unmuted.
 *  VOL-E9. mute() is a no-op when already muted.
 *  VOL-E10. unmute() is a no-op when already unmuted.
 *  VOL-E11. volume(v) while muted and v > 0 auto-unmutes and emits mute{muted:false}.
 *  VOL-E12. volumeUp/Down(step) delegates to volume().
 *  VOL-E13. volume(v) forwards to backend (divided by 100).
 *  VOL-E14. mute() forwards to backend.mute(); unmute() forwards to backend.unmute().
 */

import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
	container: HTMLElement = {} as HTMLElement;

	get id(): string {
		return this.playerId;
	}

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare volume: { (): number; (v: number): void };
	declare mute: () => void;
	declare unmute: () => void;
	declare toggleMute: () => void;
	declare volumeUp: (step?: number) => void;
	declare volumeDown: (step?: number) => void;

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

interface MockBackend {
	volumeCalls: number[];
	muteCalls: number;
	unmuteCalls: number;
}

function wireBackend(player: MockPlayer): MockBackend {
	const b: MockBackend = { volumeCalls: [], muteCalls: 0, unmuteCalls: 0 };
	(player as unknown as { backend: () => unknown }).backend = (): unknown => ({
		volume: (v: number): void => { b.volumeCalls.push(v); },
		mute: (): void => { b.muteCalls++; },
		unmute: (): void => { b.unmuteCalls++; },
	});
	return b;
}

describe('volumeMethods — extended (VOL-E)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('VOL-E1: volume() getter returns stored volume when unmuted (default 100)', () => {
		const player = makePlayer('vol-1');

		expect(player.volume()).toBe(100);
	});

	it('VOL-E2: volume() getter returns 0 when muted', () => {
		const player = makePlayer('vol-2');

		player.mute();

		expect(player.volume()).toBe(0);
	});

	it('VOL-E3: volume(v) clamps above 100 to 100', () => {
		const player = makePlayer('vol-3');

		player.volume(150);

		expect(player.volume()).toBe(100);
	});

	it('VOL-E4: volume(v) clamps below 0 to 0', () => {
		const player = makePlayer('vol-4');

		player.volume(-10);

		expect(player.volume()).toBe(0);
	});

	it('VOL-E5: mute() saves pre-mute volume; volume() returns 0', () => {
		const player = makePlayer('vol-5');
		player.volume(75);

		player.mute();

		expect(player.volume()).toBe(0);
	});

	it('VOL-E6: unmute() restores pre-mute volume', () => {
		const player = makePlayer('vol-6');
		player.volume(75);
		player.mute();

		player.unmute();

		expect(player.volume()).toBe(75);
	});

	it('VOL-E7: toggleMute from unmuted → muted', () => {
		const player = makePlayer('vol-7');

		player.toggleMute();

		expect(player.volume()).toBe(0);
	});

	it('VOL-E8: toggleMute from muted → unmuted, volume restored', () => {
		const player = makePlayer('vol-8');
		player.volume(60);
		player.mute();

		player.toggleMute();

		expect(player.volume()).toBe(60);
	});

	it('VOL-E9: mute() is a no-op when already muted — mute event fires once only', () => {
		const player = makePlayer('vol-9');
		const muteEvents: unknown[] = [];
		player.on('mute' as keyof BaseEventMap, (data: unknown) => { muteEvents.push(data); });

		player.mute();
		player.mute();

		expect(muteEvents).toHaveLength(1);
	});

	it('VOL-E10: unmute() is a no-op when already unmuted — mute event fires once only', () => {
		const player = makePlayer('vol-10');
		player.mute();

		const muteEvents: unknown[] = [];
		player.on('mute' as keyof BaseEventMap, (data: unknown) => { muteEvents.push(data); });

		player.unmute();
		player.unmute();

		expect(muteEvents).toHaveLength(1);
	});

	it('VOL-E11: volume(v) while muted and v > 0 auto-unmutes and emits mute{muted:false}', () => {
		const player = makePlayer('vol-11');
		player.volume(80);
		player.mute();

		const muteEvents: Array<{ muted: boolean }> = [];
		player.on('mute' as keyof BaseEventMap, (data: unknown) => {
			muteEvents.push(data as { muted: boolean });
		});

		player.volume(50);

		expect(player.volume()).toBe(50);
		expect(muteEvents.some(e => e.muted === false)).toBe(true);
	});

	it('VOL-E12: volumeUp(10) raises volume by 10', () => {
		const player = makePlayer('vol-12a');
		player.volume(50);

		player.volumeUp(10);

		expect(player.volume()).toBe(60);
	});

	it('VOL-E12b: volumeDown(10) lowers volume by 10', () => {
		const player = makePlayer('vol-12b');
		player.volume(50);

		player.volumeDown(10);

		expect(player.volume()).toBe(40);
	});

	it('VOL-E13: volume(v) forwards divided-by-100 value to backend', () => {
		const player = makePlayer('vol-13');
		const backend = wireBackend(player);

		player.volume(80);

		expect(backend.volumeCalls).toContain(0.8);
	});

	it('VOL-E13b: volume(0) while unmuted updates _volumeBeforeMute to 0', () => {
		const player = makePlayer('vol-13b');
		player.volume(50);
		player.volume(0);

		expect(player.volume()).toBe(0);
	});

	it('VOL-E14: mute() calls backend.mute(); unmute() calls backend.unmute()', () => {
		const player = makePlayer('vol-14');
		const backend = wireBackend(player);

		player.mute();
		expect(backend.muteCalls).toBe(1);

		player.unmute();
		expect(backend.unmuteCalls).toBe(1);
	});
});
