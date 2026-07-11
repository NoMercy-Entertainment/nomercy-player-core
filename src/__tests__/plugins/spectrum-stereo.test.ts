// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Stereo-path behavioral tests for `SpectrumPlugin`.
 *
 * The shared analyser stub used by spectrum-deep.test.ts / spectrum-live-opts.test.ts
 * stubs `graph.context()` as a bare `{ sampleRate }` object — it has no
 * `createChannelSplitter` / `createAnalyser`, so `wireStereo()` throws internally
 * and the plugin silently degrades to mono (the catch in `wireStereo()` swallows
 * it). That left the stereo path — `_splitter` / `_analyserLeft` / `_analyserRight`
 * wiring, dispose teardown, and runtime fftSize/smoothing propagation — completely
 * untested.
 *
 * This file provides a stereo-capable AudioContext stub (`createChannelSplitter`
 * + `createAnalyser` returning spy-backed nodes) so `wireStereo()` actually runs,
 * and pins two dispose/runtime-config bug fixes:
 *
 *  - dispose() must targeted-disconnect the SHARED analyser from the splitter
 *    (not just the splitter's own outgoing edges) or the shared analyser stays
 *    connected to an orphaned splitter after every add/remove cycle.
 *  - fftSize() / smoothingTimeConstant() must propagate to the L/R analysers
 *    and reallocate their buffers, or stereo frames keep serving stale-sized
 *    data after a runtime FFT size change.
 */

import type { BaseEventMap } from '../../types';
import { describe, expect, it, vi } from 'vitest';
import { LifecycleRegistry } from '../../adapters/lifecycle-registry/default';
import { EventEmitter } from '../../index';
import { SpectrumPlugin } from '../../plugins/spectrum';

// ─── Stereo-capable stubs ──────────────────────────────────────────────────────

/** Spy-backed AnalyserNode stub with mutable fftSize / smoothingTimeConstant. */
function createAnalyserStub(initialFftSize: number = 2048): AnalyserNode {
	let _fftSize = initialFftSize;
	let _smoothing = 0.8;
	return {
		get fftSize() { return _fftSize; },
		set fftSize(val: number) { _fftSize = val; },
		get frequencyBinCount() { return _fftSize / 2; },
		get smoothingTimeConstant() { return _smoothing; },
		set smoothingTimeConstant(val: number) { _smoothing = val; },
		getByteFrequencyData: vi.fn((buf: Uint8Array) => { buf.fill(100); }),
		getByteTimeDomainData: vi.fn((buf: Uint8Array) => { buf.fill(128); }),
		getFloatFrequencyData: vi.fn((buf: Float32Array) => { buf.fill(-100); }),
		getFloatTimeDomainData: vi.fn((buf: Float32Array) => { buf.fill(0); }),
		connect: vi.fn(),
		disconnect: vi.fn(),
	} as unknown as AnalyserNode;
}

/** Spy-backed ChannelSplitterNode stub. */
function createSplitterStub(): ChannelSplitterNode {
	return {
		connect: vi.fn(),
		disconnect: vi.fn(),
	} as unknown as ChannelSplitterNode;
}

/**
 * A minimal AudioContext stub that implements `createChannelSplitter` +
 * `createAnalyser` so `wireStereo()` runs its real body instead of throwing
 * into the swallowed catch. The first `createAnalyser()` call returns the
 * "left" node, the second the "right" node — matching `wireStereo()`'s call
 * order (`analyserLeft` then `analyserRight`).
 */
function makeStereoAudioContextStub(): {
	ctx: AudioContext;
	splitter: ChannelSplitterNode;
	analyserLeft: AnalyserNode;
	analyserRight: AnalyserNode;
} {
	const splitter = createSplitterStub();
	const analyserLeft = createAnalyserStub();
	const analyserRight = createAnalyserStub();
	let createAnalyserCalls = 0;

	const ctx = {
		sampleRate: 44100,
		createChannelSplitter: vi.fn(() => splitter),
		createAnalyser: vi.fn(() => {
			createAnalyserCalls += 1;
			return createAnalyserCalls === 1 ? analyserLeft : analyserRight;
		}),
	} as unknown as AudioContext;

	return { ctx, splitter, analyserLeft, analyserRight };
}

function makePlayerStub(): EventEmitter<BaseEventMap> {
	return new EventEmitter<BaseEventMap>();
}

// ─── Wire helper — stereo enabled ──────────────────────────────────────────────

function wireStereoPlugin(opts: { fftSize?: number; smoothingTimeConstant?: number } = {}): {
	plugin: SpectrumPlugin;
	player: EventEmitter<BaseEventMap>;
	monoAnalyser: AnalyserNode;
	splitter: ChannelSplitterNode;
	analyserLeft: AnalyserNode;
	analyserRight: AnalyserNode;
	tickFn: (deltaMs: number, time: number) => void;
} {
	const player = makePlayerStub();
	const monoAnalyser = createAnalyserStub(opts.fftSize ?? 2048);
	const { ctx, splitter, analyserLeft, analyserRight } = makeStereoAudioContextStub();
	const lifecycle = new LifecycleRegistry();
	const plugin = new SpectrumPlugin();

	(plugin as unknown as { player: typeof player }).player = player;
	(plugin as unknown as { lifecycle: typeof lifecycle }).lifecycle = lifecycle;
	(plugin as unknown as { opts: typeof opts & { stereo: boolean } }).opts = { ...opts, stereo: true };

	const fakeGraph = {
		analyserSource: () => monoAnalyser,
		context: () => ctx,
	};
	(player as EventEmitter<BaseEventMap> & { getPlugin: (ctor: unknown) => unknown }).getPlugin = () => fakeGraph;

	let capturedTickFn: (deltaMs: number, time: number) => void = () => {};
	(plugin as unknown as { frame: (fn: (data: number, time: number) => void) => void }).frame = (fn) => {
		capturedTickFn = fn;
	};

	plugin.use();

	return {
		plugin,
		player,
		monoAnalyser,
		splitter,
		analyserLeft,
		analyserRight,
		tickFn: (deltaMs, time) => capturedTickFn(deltaMs, time),
	};
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SpectrumPlugin — stereo wiring (bug-fix regression)', () => {
	it('sanity: the stereo AudioContext stub actually wires the splitter + L/R analysers', () => {
		const { plugin, monoAnalyser, splitter, analyserLeft, analyserRight } = wireStereoPlugin();

		expect((plugin as unknown as { _splitter: unknown })._splitter).toBe(splitter);
		expect((plugin as unknown as { _analyserLeft: unknown })._analyserLeft).toBe(analyserLeft);
		expect((plugin as unknown as { _analyserRight: unknown })._analyserRight).toBe(analyserRight);
		expect(monoAnalyser.connect).toHaveBeenCalledWith(splitter);
	});

	describe('dispose()', () => {
		it('targeted-disconnects the shared analyser from the orphaned splitter', () => {
			const { plugin, monoAnalyser, splitter } = wireStereoPlugin();

			plugin.dispose();

			// The shared AnalyserNode is owned by AudioGraphPlugin and stays alive
			// after SpectrumPlugin is removed. dispose() must remove the
			// `sharedAnalyser -> splitter` edge it created in wireStereo(), or the
			// splitter (now unreferenced) stays connected forever — a leak.
			expect(monoAnalyser.disconnect).toHaveBeenCalledWith(splitter);
		});
	});

	describe('fftSize() runtime change', () => {
		it('propagates to the L/R analysers and reallocates their buffers', () => {
			const { plugin, analyserLeft, analyserRight, tickFn } = wireStereoPlugin({ fftSize: 2048 });

			plugin.fftSize(512);
			tickFn(16, 1);

			const frame = plugin.currentFrame();

			// The mono + L/R analysers must all report the new fftSize.
			expect(analyserLeft.fftSize).toBe(512);
			expect(analyserRight.fftSize).toBe(512);

			// frame.binHz is recomputed from the new mono fftSize (256 bins); the
			// L/R arrays must match that bin count, not the stale 1024-bin buffers
			// allocated at wireStereo() time for fftSize 2048.
			expect(frame.frequencyLeft?.length).toBe(frame.frequency.length);
			expect(frame.frequencyRight?.length).toBe(frame.frequency.length);
			expect(frame.waveformLeft?.length).toBe(frame.waveform.length);
			expect(frame.waveformRight?.length).toBe(frame.waveform.length);
		});
	});

	describe('smoothingTimeConstant() runtime change', () => {
		it('propagates to the L/R analysers', () => {
			const { plugin, analyserLeft, analyserRight } = wireStereoPlugin({ fftSize: 2048 });

			plugin.smoothingTimeConstant(0.3);

			expect(analyserLeft.smoothingTimeConstant).toBeCloseTo(0.3);
			expect(analyserRight.smoothingTimeConstant).toBeCloseTo(0.3);
		});
	});
});
