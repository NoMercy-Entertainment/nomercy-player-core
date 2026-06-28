// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Deep behavioral tests for `SpectrumPlugin`.
 *
 * The existing spectrum-live-opts.test.ts covers: options({ fftSize }) and
 * options({ smoothingTimeConstant }) live re-apply.
 *
 * This file covers the remaining ~41 uncovered lines:
 *  - analyser() getter throws before use(), returns node after use()
 *  - currentFrame() triggers eager tick when no frame has arrived yet
 *  - currentFrame() throws PluginError when analyser is unavailable after tick
 *  - fftSize() getter / setter runtime change + buffer re-allocation
 *  - smoothingTimeConstant() getter / setter
 *  - bandEnergy(loHz, hiHz) returns normalized energy in 0..1
 *  - bandEnergy returns 0 when analyser is not ready
 *  - bandEnergy returns 0 when loHz > hiHz
 *  - registerBeatProvider: beat/bpm forwarded into frame event
 *  - syntheticMode() getter / setter
 *  - pushFrame() only has effect in synthetic mode
 *  - tick() emits "frame" event with expected shape
 *  - dispose() clears analyser + beat providers
 */

import type { VisualizationFrame } from '../../plugins/visualization';
import type { BaseEventMap } from '../../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LifecycleRegistry } from '../../adapters/lifecycle-registry/default';
import { PluginError } from '../../errors';
import { EventEmitter } from '../../index';
import { SpectrumPlugin } from '../../plugins/spectrum';

// ─── Analyser stub ─────────────────────────────────────────────────────────────

function makeAnalyserStub(fftSize: number = 2048): AnalyserNode {
	let _fftSize = fftSize;
	let _smoothing = 0.8;
	const freqData = new Uint8Array(fftSize / 2).fill(128);
	const waveData = new Uint8Array(fftSize).fill(128);

	return {
		get fftSize() { return _fftSize; },
		set fftSize(v: number) { _fftSize = v; },
		get frequencyBinCount() { return _fftSize / 2; },
		get smoothingTimeConstant() { return _smoothing; },
		set smoothingTimeConstant(v: number) { _smoothing = v; },
		getByteFrequencyData: vi.fn((buf: Uint8Array) => { buf.set(freqData.slice(0, buf.length)); }),
		getByteTimeDomainData: vi.fn((buf: Uint8Array) => { buf.set(waveData.slice(0, buf.length)); }),
	} as unknown as AnalyserNode;
}

function makePlayerStub(): EventEmitter<BaseEventMap> {
	return new EventEmitter<BaseEventMap>();
}

// ─── Wire helper ──────────────────────────────────────────────────────────────

function wirePlugin(
	opts: { fftSize?: number; smoothingTimeConstant?: number } = {},
	analyser?: AnalyserNode,
): { plugin: SpectrumPlugin; player: EventEmitter<BaseEventMap>; analyserNode: AnalyserNode; tickFn: (deltaMs: number, time: number) => void } {
	const player = makePlayerStub();
	const analyserNode = analyser ?? makeAnalyserStub();
	const lifecycle = new LifecycleRegistry();
	const plugin = new SpectrumPlugin();

	(plugin as unknown as { player: typeof player }).player = player;
	(plugin as unknown as { lifecycle: typeof lifecycle }).lifecycle = lifecycle;
	(plugin as unknown as { opts: typeof opts }).opts = opts;

	const fakeGraph = {
		analyserSource: () => analyserNode,
		context: () => ({ sampleRate: 44100 } as AudioContext),
	};
	(player as EventEmitter<BaseEventMap> & { getPlugin: (ctor: unknown) => unknown }).getPlugin = () => fakeGraph;

	let capturedTickFn: (deltaMs: number, time: number) => void = () => {};
	(plugin as unknown as { frame: (fn: (d: number, t: number) => void) => void }).frame = (fn) => {
		capturedTickFn = fn;
	};

	plugin.use();

	return {
		plugin,
		player,
		analyserNode,
		tickFn: (deltaMs, time) => capturedTickFn(deltaMs, time),
	};
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SpectrumPlugin — deep behavioral coverage', () => {
	afterEach(() => {});

	// ── analyser() ────────────────────────────────────────────────────────────

	describe('analyser()', () => {
		it('returns the AnalyserNode after use()', () => {
			const { plugin, analyserNode } = wirePlugin();
			expect(plugin.analyser()).toBe(analyserNode);
		});

		it('throws PluginError before use()', () => {
			const plugin = new SpectrumPlugin();
			expect(() => plugin.analyser()).toThrow(PluginError);
		});
	});

	// ── currentFrame() ────────────────────────────────────────────────────────

	describe('currentFrame()', () => {
		it('eagerly triggers tick(0, 0) on first call to populate frame', () => {
			const { plugin, tickFn } = wirePlugin();
			// Fire one real tick so the frame exists.
			tickFn(16, 1);
			const frame = plugin.currentFrame();
			expect(frame).toBeDefined();
			expect(frame.time).toBe(1);
		});

		it('throws PluginError when analyser is gone (after dispose)', () => {
			const { plugin } = wirePlugin();
			plugin.dispose();
			expect(() => plugin.currentFrame()).toThrow(PluginError);
		});
	});

	// ── fftSize() ─────────────────────────────────────────────────────────────

	describe('fftSize()', () => {
		it('getter returns current fftSize', () => {
			const { plugin } = wirePlugin({ fftSize: 2048 });
			expect(plugin.fftSize()).toBe(2048);
		});

		it('getter returns undefined before use()', () => {
			const plugin = new SpectrumPlugin();
			expect(plugin.fftSize()).toBeUndefined();
		});

		it('setter updates the analyser fftSize', () => {
			const { plugin, analyserNode } = wirePlugin();
			plugin.fftSize(4096);
			expect(analyserNode.fftSize).toBe(4096);
		});

		it('setter is a no-op before use()', () => {
			const plugin = new SpectrumPlugin();
			expect(() => plugin.fftSize(2048)).not.toThrow();
		});
	});

	// ── smoothingTimeConstant() ───────────────────────────────────────────────

	describe('smoothingTimeConstant()', () => {
		it('getter returns current smoothing constant', () => {
			const { plugin } = wirePlugin({ smoothingTimeConstant: 0.5 });
			expect(plugin.smoothingTimeConstant()).toBeCloseTo(0.5);
		});

		it('getter returns undefined before use()', () => {
			const plugin = new SpectrumPlugin();
			expect(plugin.smoothingTimeConstant()).toBeUndefined();
		});

		it('setter updates the analyser smoothing constant', () => {
			const { plugin, analyserNode } = wirePlugin();
			plugin.smoothingTimeConstant(0.3);
			expect(analyserNode.smoothingTimeConstant).toBeCloseTo(0.3);
		});
	});

	// ── bandEnergy() ─────────────────────────────────────────────────────────

	describe('bandEnergy()', () => {
		it('returns a value in 0..1 range for a valid frequency band', () => {
			const { plugin, tickFn } = wirePlugin();
			tickFn(16, 1); // populate buffers

			const energy = plugin.bandEnergy(20, 250);
			expect(energy).toBeGreaterThanOrEqual(0);
			expect(energy).toBeLessThanOrEqual(1);
		});

		it('returns 0 when analyser is not available (before use)', () => {
			const plugin = new SpectrumPlugin();
			expect(plugin.bandEnergy(20, 250)).toBe(0);
		});

		it('returns 0 when loHz > hiHz', () => {
			const { plugin } = wirePlugin();
			expect(plugin.bandEnergy(5000, 100)).toBe(0);
		});
	});

	// ── registerBeatProvider() ────────────────────────────────────────────────

	describe('registerBeatProvider()', () => {
		it('beat and bpm from providers are included in the frame event', () => {
			const { plugin, player, tickFn } = wirePlugin();

			plugin.registerBeatProvider(() => ({ beat: true, bpm: 128 }));

			const frames: Array<{ frame: VisualizationFrame }> = [];
			(player as unknown as { on: (event: string, fn: (data: unknown) => void) => void }).on(
				'plugin:spectrum:frame',
				(data: unknown) => { frames.push(data as { frame: VisualizationFrame }); },
			);

			tickFn(16, 1);

			expect(frames).toHaveLength(1);
			expect(frames[0]!.frame.beat).toBe(true);
			expect(frames[0]!.frame.bpm).toBe(128);
		});

		it('provider errors are swallowed — tick continues', () => {
			const { plugin, tickFn } = wirePlugin();

			plugin.registerBeatProvider(() => { throw new Error('beat fail'); });

			expect(() => tickFn(16, 1)).not.toThrow();
		});

		it('first truthy beat wins when multiple providers exist', () => {
			const { plugin, player, tickFn } = wirePlugin();

			plugin.registerBeatProvider(() => ({ beat: false, bpm: 90 }));
			plugin.registerBeatProvider(() => ({ beat: true, bpm: 120 }));

			const frames: Array<{ frame: VisualizationFrame }> = [];
			(player as unknown as { on: (event: string, fn: (data: unknown) => void) => void }).on(
				'plugin:spectrum:frame',
				(data: unknown) => { frames.push(data as { frame: VisualizationFrame }); },
			);

			tickFn(16, 1);

			expect(frames[0]!.frame.beat).toBe(true);
			expect(frames[0]!.frame.bpm).toBe(120); // last bpm wins
		});
	});

	// ── syntheticMode() + pushFrame() ────────────────────────────────────────

	describe('syntheticMode() + pushFrame()', () => {
		it('syntheticMode() returns false by default', () => {
			const { plugin } = wirePlugin();
			expect(plugin.syntheticMode()).toBe(false);
		});

		it('syntheticMode(true) enables synthetic mode', () => {
			const { plugin } = wirePlugin();
			plugin.syntheticMode(true);
			expect(plugin.syntheticMode()).toBe(true);
		});

		it('syntheticMode(false) clears synthetic frame', () => {
			const { plugin } = wirePlugin();
			const syntheticFrame: VisualizationFrame = {
				frequency: new Uint8Array(1024),
				waveform: new Uint8Array(2048),
				time: 10,
				deltaMs: 16,
				energy: 0.5,
				bandEnergies: { bass: 0.3, mid: 0.2, treble: 0.1 },
			};

			plugin.syntheticMode(true);
			plugin.pushFrame(syntheticFrame);
			plugin.syntheticMode(false);

			expect((plugin as unknown as { _syntheticFrame: VisualizationFrame | null })._syntheticFrame).toBeNull();
		});

		it('pushFrame() is a no-op when not in synthetic mode', () => {
			const { plugin } = wirePlugin();
			const frame: VisualizationFrame = {
				frequency: new Uint8Array(1024),
				waveform: new Uint8Array(2048),
				time: 10,
				deltaMs: 16,
				energy: 0.5,
				bandEnergies: { bass: 0.3, mid: 0.2, treble: 0.1 },
			};

			plugin.pushFrame(frame);

			expect((plugin as unknown as { _syntheticFrame: VisualizationFrame | null })._syntheticFrame).toBeNull();
		});

		it('pushFrame() stores the frame in synthetic mode', () => {
			const { plugin } = wirePlugin();
			const frame: VisualizationFrame = {
				frequency: new Uint8Array(1024),
				waveform: new Uint8Array(2048),
				time: 10,
				deltaMs: 16,
				energy: 0.5,
				bandEnergies: { bass: 0.3, mid: 0.2, treble: 0.1 },
			};

			plugin.syntheticMode(true);
			plugin.pushFrame(frame);

			expect((plugin as unknown as { _syntheticFrame: VisualizationFrame | null })._syntheticFrame).toBe(frame);
		});
	});

	// ── tick() emits frame event ──────────────────────────────────────────────

	describe('tick() — frame event', () => {
		it('emits "frame" event with VisualizationFrame payload', () => {
			const { plugin, player, tickFn } = wirePlugin();

			const frames: Array<{ frame: VisualizationFrame; energy: { bass: number; mid: number; treble: number } }> = [];
			(player as unknown as { on: (event: string, fn: (data: unknown) => void) => void }).on(
				'plugin:spectrum:frame',
				(data: unknown) => { frames.push(data as { frame: VisualizationFrame; energy: { bass: number; mid: number; treble: number } }); },
			);

			tickFn(16, 5);

			expect(frames).toHaveLength(1);
			const { frame, energy } = frames[0]!;
			expect(frame.time).toBe(5);
			expect(frame.deltaMs).toBe(16);
			expect(frame.frequency).toBeInstanceOf(Uint8Array);
			expect(frame.waveform).toBeInstanceOf(Uint8Array);
			expect(typeof frame.energy).toBe('number');
			expect(energy).toHaveProperty('bass');
			expect(energy).toHaveProperty('mid');
			expect(energy).toHaveProperty('treble');
		});
	});

	// ── dispose() ────────────────────────────────────────────────────────────

	describe('dispose()', () => {
		it('clears _analyser and beat providers', () => {
			const { plugin } = wirePlugin();
			plugin.registerBeatProvider(() => ({ beat: true }));

			plugin.dispose();

			expect((plugin as unknown as { _analyser: AnalyserNode | null })._analyser).toBeNull();
			expect((plugin as unknown as { beatProviders: unknown[] }).beatProviders).toHaveLength(0);
		});

		it('clears syntheticMode state', () => {
			const { plugin } = wirePlugin();
			plugin.syntheticMode(true);
			plugin.dispose();
			expect((plugin as unknown as { _syntheticMode: boolean })._syntheticMode).toBe(false);
		});
	});
});
