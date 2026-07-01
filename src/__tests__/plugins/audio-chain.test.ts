// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * AudioGraphPlugin / MixerPlugin / SpectrumPlugin static-shape + graceful-degradation locks.
 *
 * In happy-dom there is no `AudioContext`, so the audio chain plugins emit a
 * BrowserPolicyError on `use()` rather than crashing the player. These tests
 * pin that contract plus the basic plugin-class metadata (id, version,
 * `requires` list) so future regressions surface immediately.
 *
 * Mirrors the conventions in `tier1-features.test.ts`: a self-contained
 * MockPlayer built on the kit's shared mixins so the real spine is exercised.
 */

import type { BaseEventMap } from '../../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BrowserPolicyError } from '../../errors';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../../index';
import { AudioGraphPlugin } from '../../plugins/audio-graph';
import { MixerPlugin } from '../../plugins/mixer';
import { SpectrumPlugin } from '../../plugins/spectrum';

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
	declare getPluginById: (id: string) => any;
	declare removePlugin: (PluginClass: any) => void;

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

describe('Audio chain plugins (audio-graph / mixer / spectrum)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	describe('plugin metadata', () => {
		it('AudioGraphPlugin advertises id "audio-graph" and a 2.x version', () => {
			expect(AudioGraphPlugin.id).toBe('audio-graph');
			expect(AudioGraphPlugin.version.startsWith('2.')).toBe(true);
			expect(typeof AudioGraphPlugin.description).toBe('string');
			expect(AudioGraphPlugin.description.length).toBeGreaterThan(0);
		});

		it('MixerPlugin lists AudioGraphPlugin as a static dependency', () => {
			const requires = MixerPlugin.requires;
			expect(requires).toBeDefined();
			expect(requires).toContain(AudioGraphPlugin);
			expect(MixerPlugin.id).toBe('mixer');
		});

		it('SpectrumPlugin lists AudioGraphPlugin as a static dependency', () => {
			const requires = SpectrumPlugin.requires;
			expect(requires).toBeDefined();
			expect(requires).toContain(AudioGraphPlugin);
			expect(SpectrumPlugin.id).toBe('spectrum');
		});
	});

	describe('graceful degradation in environments without AudioContext', () => {
		it('audioGraphPlugin install fails with a structured BrowserPolicyError when AudioContext is undefined', async () => {
			// happy-dom does not implement Web Audio. Confirm the precondition so
			// the test fails loudly if the environment ever changes underneath us.
			expect(typeof (globalThis as any).AudioContext).toBe('undefined');
			expect(typeof (globalThis as any).webkitAudioContext).toBe('undefined');

			const mockPlayer = makePlayer('ag-unsupported').setup({});
			await mockPlayer.ready();

			let captured: unknown;
			mockPlayer.on('plugin:failed' as any, (data: any) => {
				captured = data?.error;
			});

			mockPlayer.addPlugin(AudioGraphPlugin);
			// Allow the kit's async install path to settle.
			await new Promise(r => setTimeout(r, 0));

			expect(captured).toBeInstanceOf(BrowserPolicyError);
			expect((captured as BrowserPolicyError).code).toBe('core:policy/audioContextUnsupported');
			// Plugin whose use() throws is disposed + NOT pushed onto _plugins.
			// plugins() must never return a ghost instance with enabled:false.
			const inst = mockPlayer.getPluginById('audio-graph');
			expect(inst).toBeUndefined();
		});

		it('context() throws BrowserPolicyError directly when AudioContext is unavailable', () => {
			const plugin = new AudioGraphPlugin();
			// Bare instance — initialize() not called, but `context` only
			// touches the lazy ctx + global ctor; no player wiring required.
			expect(() => plugin.context()).toThrow(BrowserPolicyError);
		});
	});
});
