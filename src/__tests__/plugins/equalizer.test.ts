// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * EqualizerPlugin static-shape, preset catalogue, slider helpers, JSON-string
 * preset parsing, and graceful-degradation locks.
 *
 * happy-dom does not implement Web Audio, so the plugin's `use()` path bails
 * via the audio-graph's `BrowserPolicyError`. Tests pin the plugin metadata,
 * dependency wiring, preset catalogue, slider math, and the install-fails-
 * gracefully contract.
 *
 * Behaviours that require a real `AudioContext` (band ramping, biquad
 * connect/disconnect, persistence round-trip on the live chain) are exercised
 * in the browser test suite, NOT here.
 */

import type { EqPreset } from '../../plugins/equalizer/index';
import type { BaseEventMap } from '../../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BrowserPolicyError, PluginError } from '../../errors';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../../index';
import { AudioGraphPlugin } from '../../plugins/audio-graph';
import { EqualizerPlugin } from '../../plugins/equalizer/index';
import { BUILTIN_PRESETS, DEFAULT_BANDS } from '../../plugins/equalizer/presets';

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

/**
 * Build a bare instance with the band layout and slider config wired up,
 * without going near the audio-context-dependent `use()` path. Lets us
 * exercise data + helper-method behaviour in happy-dom.
 */
function bareInstance(): EqualizerPlugin {
	const inst = new EqualizerPlugin();
	(inst as any)._bands = DEFAULT_BANDS.map(b => ({ ...b }));
	(inst as any).sliderValues = {
		pre: { min: -1, max: 3, step: 0.01, default: 0, totalSteps: 4 },
		band: { min: -12, max: 12, step: 0.01, default: 0, totalSteps: 24 },
	};
	(inst as any).customPresets = new Map();
	(inst as any).opts = {};
	return inst;
}

describe('EqualizerPlugin', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	describe('plugin metadata', () => {
		it('advertises id "equalizer", a 2.x version, and a non-empty description', () => {
			expect(EqualizerPlugin.id).toBe('equalizer');
			expect(EqualizerPlugin.version.startsWith('2.')).toBe(true);
			expect(typeof EqualizerPlugin.description).toBe('string');
			expect(EqualizerPlugin.description.length).toBeGreaterThan(0);
		});

		it('lists AudioGraphPlugin as a static dependency', () => {
			const requires = EqualizerPlugin.requires;
			expect(requires).toBeDefined();
			expect(requires).toContain(AudioGraphPlugin);
		});
	});

	describe('default band layout (Pre + 10 frequencies, hand-tuned)', () => {
		it('starts with `Pre` at index 0 then 10 peaking-filter centres', () => {
			expect(DEFAULT_BANDS).toHaveLength(11);
			expect(DEFAULT_BANDS[0]?.frequency).toBe('Pre');
			const freqs = DEFAULT_BANDS.slice(1).map(b => b.frequency);
			expect(freqs).toEqual([70, 180, 320, 600, 1000, 3000, 6000, 12000, 14000, 16000]);
		});
	});

	describe('preset catalogue (no AudioContext required)', () => {
		it('exposes Fillz\'s 19 hand-tuned built-in presets including Custom + Rock', () => {
			const inst = bareInstance();
			const presets = inst.presets();
			const names = presets.map(p => p.name);
			expect(names).toEqual(
				expect.arrayContaining([
					'Custom',
					'Classical',
					'Club',
					'Dance',
					'Flat',
					'Laptop speakers/headphones',
					'Large hall',
					'Party',
					'Pop',
					'Reggae',
					'Rock',
					'Soft',
					'Ska',
					'Full Bass',
					'Soft Rock',
					'Full Treble',
					'Full Bass & Treble',
					'Live',
					'Techno',
				]),
			);
			// 19 built-ins. Custom presets are added on top.
			expect(BUILTIN_PRESETS.length).toBe(19);
		});

		it('every built-in preset targets the canonical 10 frequencies', () => {
			const expectedFreqs = [70, 180, 320, 600, 1000, 3000, 6000, 12000, 14000, 16000];
			for (const p of BUILTIN_PRESETS) {
				const freqs = p.values.map(v => v.frequency);
				expect(freqs).toEqual(expectedFreqs);
			}
		});

		it('treats Rock\'s ported gains as the canonical reference', () => {
			const rock = BUILTIN_PRESETS.find(p => p.name === 'Rock')!;
			expect(rock.values.map(v => v.gain)).toEqual(
				[4.875, 3, -3.375, -4.875, -2.25, 2.625, 5.625, 6.75, 6.75, 6.75],
			);
		});

		it('Custom is all zeros — canonical "no preset selected" sentinel', () => {
			const custom = BUILTIN_PRESETS.find(p => p.name === 'Custom')!;
			expect(custom.values.every(v => v.gain === 0)).toBe(true);
		});

		it('exposes consumer-supplied opts.presets alongside built-ins, deduped by name', () => {
			const inst = new EqualizerPlugin();
			(inst as any).bands = DEFAULT_BANDS.map(b => ({ ...b }));
			(inst as any).sliderValues = {
				pre: { min: -1, max: 3, step: 0.01, default: 0, totalSteps: 4 },
				band: { min: -12, max: 12, step: 0.01, default: 0, totalSteps: 24 },
			};
			(inst as any).customPresets = new Map();
			(inst as any).opts = {
				presets: [
					{ name: 'CustomA', values: [{ frequency: 1000, gain: 5 }] },
					{ name: 'Rock', values: [{ frequency: 70, gain: 99 }] }, // dup of built-in name — should NOT shadow
				] satisfies EqPreset[],
			};
			const names = inst.presets().map(p => p.name);
			expect(names).toContain('CustomA');
			// Built-in Rock wins on collision (registered first).
			const rock = inst.presets().find(p => p.name === 'Rock')!;
			expect(rock.values[0]?.gain).toBe(4.875);
		});
	});

	describe('custom-preset registration (Fillz-shape: { name, values: EqBand[] })', () => {
		it('addCustomPreset stores a preset that presets() returns', () => {
			const inst = bareInstance();
			inst.addCustomPreset({
				name: 'MyMix',
				values: [{ frequency: 1000, gain: 6 }, { frequency: 6000, gain: -3 }],
			});
			const my = inst.presets().find(p => p.name === 'MyMix')!;
			expect(my).toBeDefined();
			expect(my.values).toHaveLength(2);
			expect(my.values.find(v => v.frequency === 1000)?.gain).toBe(6);
		});

		it('removePreset deletes custom presets but never built-ins', () => {
			const inst = bareInstance();
			inst.addCustomPreset({ name: 'Temp', values: [{ frequency: 1000, gain: 1 }] });
			expect(inst.presets().some(p => p.name === 'Temp')).toBe(true);
			inst.removePreset('Temp');
			expect(inst.presets().some(p => p.name === 'Temp')).toBe(false);

			// Built-ins are protected.
			inst.removePreset('Rock');
			expect(inst.presets().some(p => p.name === 'Rock')).toBe(true);
		});
	});

	describe('slider helpers (0-100 normalization, range lookups)', () => {
		it('maps a 0 dB band gain to the 50% slider midpoint', () => {
			const inst = bareInstance();
			expect(inst.bandSliderValue(1000)).toBe(50);
		});

		it('maps the 0 pre-gain default to 25% on the asymmetric pre slider', () => {
			// Pre slider: min=-1, max=3, totalSteps=4, default=0.
			// offset = floor(max/2) = 1 → (0 + 1) / 4 * 100 = 25.
			const inst = bareInstance();
			expect(inst.bandSliderValue('Pre')).toBe(25);
		});

		it('exposes the configured min/max/step per band', () => {
			const inst = bareInstance();
			expect(inst.bandSliderMin(1000)).toBe(-12);
			expect(inst.bandSliderMax(1000)).toBe(12);
			expect(inst.bandSliderStep(1000)).toBe(0.01);
			expect(inst.bandSliderMin('Pre')).toBe(-1);
			expect(inst.bandSliderMax('Pre')).toBe(3);
		});
	});

	describe('preset resolution (name / object / JSON string)', () => {
		// `setPreset` walks the audio chain when nodes exist; for the data-only
		// resolver we drive the same internal helper with no audio attached.
		it('parses a JSON-string preset matching Fillz\'s reference behaviour', () => {
			const inst = bareInstance();
			const json = JSON.stringify({
				name: 'JsonOne',
				values: [{ frequency: 1000, gain: 7 }],
			});
			const resolved = (inst as unknown as { resolvePreset: (p: string) => EqPreset | undefined }).resolvePreset(json);
			expect(resolved?.name).toBe('JsonOne');
			expect(resolved?.values[0]?.gain).toBe(7);
		});

		it('returns undefined for an unknown preset name', () => {
			const inst = bareInstance();
			const resolved = (inst as unknown as { resolvePreset: (p: string) => EqPreset | undefined }).resolvePreset('NoSuchPreset');
			expect(resolved).toBeUndefined();
		});

		it('returns undefined for malformed JSON', () => {
			const inst = bareInstance();
			const resolved = (inst as unknown as { resolvePreset: (p: string) => EqPreset | undefined }).resolvePreset('{not json');
			expect(resolved).toBeUndefined();
		});
	});

	describe('pre-gain sticky-zero snap (Fillz parity, ±0.05 → 0)', () => {
		it('values within ±0.05 snap to 0', () => {
			const inst = bareInstance();
			const snap = (inst as unknown as { snapPreGain: (n: number) => number }).snapPreGain;
			expect(snap.call(inst, 0.04)).toBe(0);
			expect(snap.call(inst, -0.05)).toBe(0);
		});

		it('values outside the threshold pass through unchanged', () => {
			const inst = bareInstance();
			const snap = (inst as unknown as { snapPreGain: (n: number) => number }).snapPreGain;
			expect(snap.call(inst, 0.5)).toBe(0.5);
			expect(snap.call(inst, -1.25)).toBe(-1.25);
		});
	});

	describe('graceful degradation in environments without AudioContext', () => {
		it('addPlugin(AudioGraphPlugin) emits plugin:failed when AudioContext is undefined', async () => {
			expect(typeof (globalThis as any).AudioContext).toBe('undefined');
			expect(typeof (globalThis as any).webkitAudioContext).toBe('undefined');

			const p = makePlayer('eq-unsupported').setup({});
			await p.ready();

			const failures: unknown[] = [];
			p.on('plugin:failed' as any, (data: any) => {
				failures.push(data?.error);
			});

			p.addPlugin(AudioGraphPlugin);
			await new Promise(r => setTimeout(r, 0));

			expect(failures.some(f => f instanceof BrowserPolicyError)).toBe(true);

			// AudioGraph failed, so it is NOT in _plugins.
			expect(p.getPluginById('audio-graph')).toBeUndefined();
		});

		it('addPlugin(EqualizerPlugin) throws missing-dep when AudioGraph failed (not in _plugins)', async () => {
			const p = makePlayer('eq-unsupported2').setup({});
			await p.ready();

			p.addPlugin(AudioGraphPlugin);
			await new Promise(r => setTimeout(r, 0));

			// AudioGraph is not in _plugins after failing. Adding Equalizer must throw missing-dep.
			expect(() => p.addPlugin(EqualizerPlugin)).toThrow('missing-dep');
		});

		it('refuses to wire up if AudioGraphPlugin is missing from the player', () => {
			const inst = new EqualizerPlugin();
			(inst as any).player = {};
			(inst as any).opts = {};
			(inst as any).lifecycle = { addCleanup: () => {} };
			let err: unknown;
			try {
				inst.use();
			}
			catch (e) {
				err = e;
			}
			expect(err).toBeInstanceOf(PluginError);
			expect((err as PluginError).code).toBe('core:plugin/missing-dep');
		});
	});
});
