// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * `VolumeMemoryPlugin` must remember the level the listener chose, not the
 * effective level. `player.volume()` returns 0 while muted, so saving it
 * wrote `{ level: 0, muted: true }` on every mute. The next page load then
 * restored volume 0 and a mute whose "level before mute" was also 0: unmute
 * restored silence, while the server frame said 100 and the pre-volume
 * analyser kept drawing bands. Web music sounded dead for good.
 */

import type { BaseEventMap } from '../../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LifecycleRegistry } from '../../adapters/lifecycle-registry/default';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../../index';
import { VolumeMemoryPlugin } from '../../plugins/volume-memory';

const _instances = new Map<string, MockPlayer>();
const STORAGE_KEY = 'nmplayer-volume-memory-volume';

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
	declare volume: (level?: number) => any;
	declare mute: () => Promise<void>;
	declare unmute: () => Promise<void>;

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
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

function startPlugin(player: MockPlayer): VolumeMemoryPlugin {
	const plugin = new VolumeMemoryPlugin();
	plugin.initialize(player as any, {}, new LifecycleRegistry());
	plugin.use();
	return plugin;
}

const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

function stored(): { level?: number; muted?: boolean } {
	return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
}

describe('VolumeMemoryPlugin', () => {
	beforeEach(() => {
		_instances.clear();
		localStorage.clear();
	});

	afterEach(() => {
		_instances.clear();
		document.body.innerHTML = '';
		localStorage.clear();
	});

	it('keeps the chosen level in storage while muted', async () => {
		const player = makePlayer('vm-1');
		startPlugin(player);

		await player.volume(80);
		await player.mute();

		expect(stored()).toEqual({ level: 80, muted: true });
	});

	it('restores the chosen level on unmute after a muted reload', async () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ level: 70, muted: true }));
		const player = makePlayer('vm-2');
		startPlugin(player);
		await settle();

		expect(player.volume()).toBe(0);
		await player.unmute();
		expect(player.volume()).toBe(70);
	});

	it('does not restore silence from the old { level: 0, muted: true } pair', async () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ level: 0, muted: true }));
		const player = makePlayer('vm-3');
		startPlugin(player);
		await settle();

		await player.unmute();
		expect(player.volume()).toBeGreaterThan(0);
	});

	it('still applies a level the listener set to 0 on purpose', async () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ level: 0, muted: false }));
		const player = makePlayer('vm-4');
		startPlugin(player);
		await settle();

		expect(player.volume()).toBe(0);
	});
});
