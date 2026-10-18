// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Setup pipeline and plugin registration under late or racing calls:
 *  - a plugin added during setup, after the plugin stage, still registers
 *  - dispose() during setup keeps the player disposed
 *  - ready() rejects when a setup stage failed before ready() was called
 *  - post-setup registrations in flight count for duplicate and requires checks
 *  - a registration that settles after dispose() is torn down, not installed
 */

import type { StubPlayer } from '../testing/stub-player';
import type { BaseEventMap, PluginCtorWithId } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
	container: HTMLElement = {} as HTMLElement;
	get id(): string { return this.playerId; }

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => Promise<void>;
	declare phase: () => string;
	declare addPlugin: <P extends Plugin<any, any, any>>(
		PluginClass: PluginCtorWithId & (new () => P),
		opts?: P['opts'],
	) => this;

	declare getPluginById: (id: string) => unknown;
	declare plugins: () => ReadonlyArray<Plugin>;

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

let gate: Promise<void>;
let release: () => void;
let disposedIds: string[];
let usedIds: string[];

class QuickPlugin extends Plugin<StubPlayer> {
	static override readonly id = 'quick';
	static override readonly version = '1.0.0';
	static override readonly description = 'Quick';
	override use(): void { usedIds.push('quick'); }
	override dispose(): void { disposedIds.push('quick'); }
}

class SlowPlugin extends Plugin<StubPlayer> {
	static override readonly id = 'slow';
	static override readonly version = '1.0.0';
	static override readonly description = 'Slow';
	override async use(): Promise<void> {
		usedIds.push('slow');
		await gate;
	}

	override dispose(): void { disposedIds.push('slow'); }
}

class NeedsSlowPlugin extends Plugin<StubPlayer> {
	static override readonly id = 'needs-slow';
	static override readonly version = '1.0.0';
	static override readonly description = 'NeedsSlow';
	static override readonly requires = [SlowPlugin];
	override use(): void {}
	override dispose(): void {}
}

function newPlayer(): MockPlayer {
	const div = document.createElement('div');
	div.id = 'spd-mock';
	document.body.appendChild(div);
	return new MockPlayer('spd-mock');
}

const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

describe('setup pipeline and plugin registration races', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
		disposedIds = [];
		usedIds = [];
		gate = new Promise<void>((resolve) => { release = resolve; });
	});
	afterEach(() => {
		release();
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('registers a plugin added from a pluginsRegistered listener before ready()', async () => {
		const player = newPlayer();
		player.on('pluginsRegistered' as never, () => { player.addPlugin(QuickPlugin); });
		player.setup({});
		await player.ready();
		expect(player.getPluginById('quick')).toBeDefined();
	});

	it('keeps the player disposed when dispose() runs during setup', async () => {
		const player = newPlayer();
		player.addPlugin(SlowPlugin);
		player.addPlugin(QuickPlugin);
		player.setup({});
		await flush();
		await player.dispose();
		release();
		await flush();
		expect(player.phase()).toBe('disposed');
		expect(usedIds).toEqual(['slow']);
	});

	it('rejects ready() when a setup stage failed before ready() was called', async () => {
		const player = newPlayer();
		player.setup({
			playlist: [{ id: 'a', title: 'A' }],
			transformPlaylistItem: () => { throw new Error('transform boom'); },
		});
		await flush();
		await expect(player.ready()).rejects.toThrow();
	});

	it('counts an in-flight post-setup registration for requires and duplicate checks', async () => {
		const player = newPlayer();
		player.setup({});
		await player.ready();
		player.addPlugin(SlowPlugin);
		expect(() => player.addPlugin(NeedsSlowPlugin)).not.toThrow();
		expect(() => player.addPlugin(SlowPlugin)).toThrow();
		release();
		await player.ready();
		expect(player.plugins().map(p => (p.constructor as PluginCtorWithId).id).sort()).toEqual(['needs-slow', 'slow']);
	});

	it('tears down a registration that settles after dispose()', async () => {
		const player = newPlayer();
		player.setup({});
		await player.ready();
		player.addPlugin(SlowPlugin);
		await flush();
		await player.dispose();
		release();
		await flush();
		expect(player.plugins()).toHaveLength(0);
		expect(disposedIds).toEqual(['slow']);
	});
});
