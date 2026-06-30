// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slice 03 — consequence-pinning tests for `MixerPlugin`.
 *
 * Tests the pure state layer of gain() and pan() — no AudioContext required.
 * MixerPlugin requires AudioGraphPlugin at registration time, so the plugin is
 * initialized directly via `initialize()` to bypass the registration pipeline.
 * `use()` is intentionally NOT called (no AudioContext in jsdom): gain/pan state
 * is exercised in isolation from Web Audio.
 *
 * Pinned consequences:
 *  20. `gain()` returns the default gain value (0 dB); `gain(0.5)` stores and
 *      returns 0.5; the plugin emits `plugin:mixer:gain:changed` with `{ gain: 0.5 }`.
 *  21. `pan(0.3)` stores 0.3; `pan()` returns 0.3; the plugin emits
 *      `plugin:mixer:pan:changed` with `{ pan: 0.3 }`.
 *
 * NOTE: The slice spec described the default gain as "1.0" using linear scale
 * language. The MixerPlugin stores gain in dB — default is 0 dB (= unity gain in
 * linear scale). This test asserts the actual implementation (0 dB). See Findings.
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
import { MixerPlugin } from '../../plugins/mixer';

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

function makeMixerPlugin(player: MockPlayer): MixerPlugin {
	const plugin = new MixerPlugin();
	plugin.initialize(player as any, {}, new LifecycleRegistry());
	return plugin;
}

describe('MixerPlugin (slice 03)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('gain() returns 0 (default, 0 dB unity) before use(); gain(0.5) stores 0.5 and emits plugin:mixer:gain:changed', () => {
		const player = makePlayer('mixer-1');
		const mixer = makeMixerPlugin(player);

		expect(mixer.gain()).toBe(0);

		const emitted: Array<{ gain: number }> = [];
		player.on('plugin:mixer:gain:changed' as any, (data: { gain: number }) => {
			emitted.push(data);
		});

		mixer.gain(0.5);

		expect(mixer.gain()).toBe(0.5);
		expect(emitted).toHaveLength(1);
		expect(emitted[0]!.gain).toBe(0.5);
	});

	it('pan(0.3) stores 0.3; pan() returns 0.3; plugin emits plugin:mixer:pan:changed with { pan: 0.3 }', () => {
		const player = makePlayer('mixer-2');
		const mixer = makeMixerPlugin(player);

		const emitted: Array<{ pan: number }> = [];
		player.on('plugin:mixer:pan:changed' as any, (data: { pan: number }) => {
			emitted.push(data);
		});

		mixer.pan(0.3);

		expect(mixer.pan()).toBe(0.3);
		expect(emitted).toHaveLength(1);
		expect(emitted[0]!.pan).toBeCloseTo(0.3);
	});
});
