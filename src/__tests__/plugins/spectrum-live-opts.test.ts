// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * SpectrumPlugin live-options tests.
 *
 * Pins the contract that calling `options(partial)` on an active SpectrumPlugin
 * immediately re-applies `fftSize` and `smoothingTimeConstant` to the live
 * AnalyserNode via the `opts:changed` self-listener wired in `use()`.
 *
 * Tests operate directly on bare SpectrumPlugin instances with stubbed
 * AnalyserNodes so there is no dependency on AudioContext (unavailable in
 * happy-dom). The player is wired minimally — just enough for `options()` to
 * fire the event bus and the `on()` listener to receive it.
 */

import type { BaseEventMap } from '../../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LifecycleRegistry } from '../../adapters/lifecycle-registry/default';
import { EventEmitter } from '../../index';
import { SpectrumPlugin } from '../../plugins/spectrum';

/** Minimal AnalyserNode stub with mutable fftSize + smoothingTimeConstant. */
function makeAnalyserStub(initialFftSize: number = 2048): AnalyserNode {
	let fftSize = initialFftSize;
	let smoothingTimeConstant = 0.8;
	return {
		get fftSize() { return fftSize; },
		set fftSize(val: number) { fftSize = val; },
		get frequencyBinCount() { return fftSize / 2; },
		get smoothingTimeConstant() { return smoothingTimeConstant; },
		set smoothingTimeConstant(val: number) { smoothingTimeConstant = val; },
		getByteFrequencyData: (buf: Uint8Array) => { buf.fill(0); },
		getByteTimeDomainData: (buf: Uint8Array) => { buf.fill(128); },
		getFloatFrequencyData: (buf: Float32Array) => { buf.fill(-100); },
		getFloatTimeDomainData: (buf: Float32Array) => { buf.fill(0); },
		connect: () => {},
	} as unknown as AnalyserNode;
}

/** Minimal EventEmitter player stub — just enough for Plugin.on() + Plugin.emit() to route events. */
function makePlayerStub(): EventEmitter<BaseEventMap> {
	return new EventEmitter<BaseEventMap>();
}

/**
 * Wire a SpectrumPlugin instance manually, bypassing addPlugin().
 *
 * Plants the analyser stub into the internal `_analyser` field, wires the
 * player + lifecycle + opts, then calls `use()` so the opts:changed listener
 * registers. The frame() hook is a no-op here; only the event wiring matters.
 */
function wirePlugin(
	plugin: SpectrumPlugin,
	player: EventEmitter<BaseEventMap>,
	analyser: AnalyserNode,
	opts: { fftSize?: number; smoothingTimeConstant?: number } = {},
): void {
	const lifecycle = new LifecycleRegistry();

	// Plant the minimal internals the base Plugin class expects before use().
	(plugin as unknown as { player: typeof player }).player = player;
	(plugin as unknown as { lifecycle: LifecycleRegistry }).lifecycle = lifecycle;
	(plugin as unknown as { opts: typeof opts }).opts = opts;

	// Stub the AudioGraphPlugin dependency lookup so use() doesn't throw.
	(player as unknown as { getPlugin: (ctor: unknown) => unknown }).getPlugin = () => ({
		analyserSource: () => analyser,
		context: () => ({ sampleRate: 44100 } as unknown as AudioContext),
	});

	// Stub frame() so the RAF tick never fires (no real rAF in happy-dom).
	(plugin as unknown as { frame: (fn: unknown) => void }).frame = () => {};

	plugin.use();
}

describe('SpectrumPlugin — live opts re-apply via opts:changed', () => {
	let player: EventEmitter<BaseEventMap>;

	beforeEach(() => {
		player = makePlayerStub();
	});

	afterEach(() => {
		// nothing to clean up — no DOM or real timers used
	});

	it('options({ fftSize }) re-applies to the live AnalyserNode immediately', () => {
		const analyser = makeAnalyserStub(2048);
		const plugin = new SpectrumPlugin();
		wirePlugin(plugin, player, analyser, { fftSize: 2048, smoothingTimeConstant: 0.8 });

		expect(analyser.fftSize).toBe(2048);

		plugin.options({ fftSize: 4096 });

		// The opts:changed listener wired in use() must forward to fftSize().
		expect(analyser.fftSize).toBe(4096);
	});

	it('options({ smoothingTimeConstant }) re-applies to the live AnalyserNode immediately', () => {
		const analyser = makeAnalyserStub(2048);
		const plugin = new SpectrumPlugin();
		wirePlugin(plugin, player, analyser, { fftSize: 2048, smoothingTimeConstant: 0.8 });

		expect(analyser.smoothingTimeConstant).toBeCloseTo(0.8);

		plugin.options({ smoothingTimeConstant: 0.2 });

		expect(analyser.smoothingTimeConstant).toBeCloseTo(0.2);
	});

	it('fftSize() getter returns the live AnalyserNode value', () => {
		const analyser = makeAnalyserStub(1024);
		const plugin = new SpectrumPlugin();
		wirePlugin(plugin, player, analyser, { fftSize: 1024 });

		expect(plugin.fftSize()).toBe(1024);

		plugin.fftSize(2048);
		expect(analyser.fftSize).toBe(2048);
		expect(plugin.fftSize()).toBe(2048);
	});

	it('smoothingTimeConstant() getter + setter round-trips correctly', () => {
		const analyser = makeAnalyserStub(2048);
		const plugin = new SpectrumPlugin();
		wirePlugin(plugin, player, analyser, { fftSize: 2048, smoothingTimeConstant: 0.5 });

		expect(plugin.smoothingTimeConstant()).toBeCloseTo(0.5);

		plugin.smoothingTimeConstant(0.9);
		expect(analyser.smoothingTimeConstant).toBeCloseTo(0.9);
		expect(plugin.smoothingTimeConstant()).toBeCloseTo(0.9);
	});

	it('partial options() update does not clobber unchanged settings', () => {
		const analyser = makeAnalyserStub(2048);
		const plugin = new SpectrumPlugin();
		wirePlugin(plugin, player, analyser, { fftSize: 2048, smoothingTimeConstant: 0.8 });

		// Update only smoothing — fftSize must stay at 2048.
		plugin.options({ smoothingTimeConstant: 0.3 });

		expect(analyser.fftSize).toBe(2048);
		expect(analyser.smoothingTimeConstant).toBeCloseTo(0.3);
	});
});
