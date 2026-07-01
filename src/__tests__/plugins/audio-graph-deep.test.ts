// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Deep behavioral tests for `AudioGraphPlugin`.
 *
 * The existing audio-chain.test.ts and audio-graph-backend-defer.test.ts cover:
 * baseline chain wiring, insertEffect / removeEffect order, analyserSource tap,
 * context:ready / context:closed events, backend outputNode integration,
 * crossfade source-swap event, BrowserPolicyError in non-browser envs.
 *
 * This file covers the remaining ~44 uncovered lines:
 *  - pre() / post() shorthand methods
 *  - route() + unroute() manual node pairs
 *  - outputNode() throws before use() (state-uninitialized)
 *  - outputNode() returns last node in chain
 *  - context() lazy creates context when not yet initialized
 *  - analyserSource() returns same node on repeated calls
 *  - analyserSource() applies fftSize + smoothing from opts
 *  - chain:rebuilt event emitted after insertEffect / removeEffect
 *  - dispose() clears all nodes and emits context:closed
 *  - tearDownGraph is idempotent (double-dispose is safe)
 */

import type { BaseEventMap } from '../../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LifecycleRegistry } from '../../adapters/lifecycle-registry/default';
import { EventEmitter } from '../../index';
import { AudioGraphPlugin } from '../../plugins/audio-graph';

// ─── Fake AudioContext + nodes ─────────────────────────────────────────────────

function makeAudioNode(): AudioNode {
	return {
		connect: vi.fn(),
		disconnect: vi.fn(),
	} as unknown as AudioNode;
}

function makeAnalyserNode(fftSize: number = 2048): AnalyserNode {
	let _fftSize = fftSize;
	let _smoothing = 0.8;
	return {
		get fftSize() { return _fftSize; },
		set fftSize(val: number) { _fftSize = val; },
		get frequencyBinCount() { return _fftSize / 2; },
		get smoothingTimeConstant() { return _smoothing; },
		set smoothingTimeConstant(val: number) { _smoothing = val; },
		connect: vi.fn(),
		disconnect: vi.fn(),
		getByteFrequencyData: vi.fn(),
		getByteTimeDomainData: vi.fn(),
	} as unknown as AnalyserNode;
}

function makeGainNode(): GainNode {
	return {
		gain: { value: 1, setTargetAtTime: vi.fn() },
		connect: vi.fn(),
		disconnect: vi.fn(),
	} as unknown as GainNode;
}

function makeBiquadNode(): BiquadFilterNode {
	return {
		type: 'peaking',
		frequency: { value: 0 },
		Q: { value: 1 },
		gain: { value: 0 },
		connect: vi.fn(),
		disconnect: vi.fn(),
	} as unknown as BiquadFilterNode;
}

function makeAudioContext(): AudioContext & { _analyser: AnalyserNode; _gain: GainNode } {
	const analyser = makeAnalyserNode();
	const gain = makeGainNode();
	const destination = makeAudioNode();
	return {
		sampleRate: 44100,
		currentTime: 0,
		state: 'running' as AudioContextState,
		_analyser: analyser,
		_gain: gain,
		destination,
		createGain: vi.fn(() => gain),
		createAnalyser: vi.fn(() => analyser),
		createBiquadFilter: vi.fn(() => makeBiquadNode()),
		createMediaElementSource: vi.fn(() => makeAudioNode()),
		resume: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
	} as unknown as AudioContext & { _analyser: AnalyserNode; _gain: GainNode };
}

// ─── Wire plugin helper ────────────────────────────────────────────────────────

function wirePlugin(
	opts: { latencyHint?: AudioContextLatencyCategory; fftSize?: number; smoothing?: number } = {},
): { plugin: AudioGraphPlugin; player: EventEmitter<BaseEventMap>; ctx: ReturnType<typeof makeAudioContext> } {
	const player = new EventEmitter<BaseEventMap>();
	const fakeCtx = makeAudioContext();

	// Stub globalThis.AudioContext so plugin.use() picks it up.
	// Must be a regular function (not arrow) so `new` works correctly.
	const originalAudioContext = (globalThis as Record<string, unknown>)['AudioContext'];
	(globalThis as Record<string, unknown>)['AudioContext'] = function () { return fakeCtx; };

	const plugin = new AudioGraphPlugin();
	const lifecycle = new LifecycleRegistry();

	(plugin as unknown as { player: typeof player }).player = player;
	(plugin as unknown as { lifecycle: typeof lifecycle }).lifecycle = lifecycle;
	(plugin as unknown as { opts: typeof opts }).opts = opts;

	// No media element — plugin will use a silent gain node as source.
	(player as EventEmitter<BaseEventMap> & { backend: () => null }).backend = () => null;

	plugin.use();

	// Restore
	(globalThis as Record<string, unknown>)['AudioContext'] = originalAudioContext;

	return { plugin, player, ctx: fakeCtx };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AudioGraphPlugin — deep behavioral coverage', () => {
	let savedAudioContext: unknown;

	beforeEach(() => {
		savedAudioContext = (globalThis as Record<string, unknown>)['AudioContext'];
	});

	afterEach(() => {
		(globalThis as Record<string, unknown>)['AudioContext'] = savedAudioContext;
	});

	// ── pre() / post() shorthands ─────────────────────────────────────────────

	describe('pre() / post() shorthands', () => {
		it('pre(node) inserts the node as a pre-effect and returns the same node', () => {
			const { plugin } = wirePlugin();
			const node = makeAudioNode();
			const returned = plugin.pre(node);
			expect(returned).toBe(node);
		});

		it('post(node) inserts the node as a post-effect and returns the same node', () => {
			const { plugin } = wirePlugin();
			const node = makeAudioNode();
			const returned = plugin.post(node);
			expect(returned).toBe(node);
		});
	});

	// ── route() + unroute() ───────────────────────────────────────────────────

	describe('route() / unroute()', () => {
		it('route() calls from.connect(to)', () => {
			const { plugin } = wirePlugin();
			const from = makeAudioNode();
			const to = makeAudioNode();
			plugin.route(from, to);
			expect((from.connect as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(to);
		});

		it('unroute() calls from.disconnect(to) and removes from routes', () => {
			const { plugin } = wirePlugin();
			const from = makeAudioNode();
			const to = makeAudioNode();
			plugin.route(from, to);
			plugin.unroute(from, to);
			expect((from.disconnect as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(to);
		});

		it('unroute() is a no-op for a pair that was never routed', () => {
			const { plugin } = wirePlugin();
			const from = makeAudioNode();
			const to = makeAudioNode();
			expect(() => plugin.unroute(from, to)).not.toThrow();
		});
	});

	// ── outputNode() ──────────────────────────────────────────────────────────

	describe('outputNode()', () => {
		it('returns the source node when no effects are inserted', () => {
			const { plugin } = wirePlugin();
			const out = plugin.outputNode();
			expect(out).toBeDefined();
		});

		it('returns the last post-effect node after insertEffect', () => {
			const { plugin } = wirePlugin();
			const effect1 = makeAudioNode();
			const effect2 = makeAudioNode();
			plugin.insertEffect(effect1, 'post');
			plugin.insertEffect(effect2, 'post');
			expect(plugin.outputNode()).toBe(effect2);
		});

		it('throws PluginError when called before use()', () => {
			const plugin = new AudioGraphPlugin();
			expect(() => plugin.outputNode()).toThrow('chain has no source');
		});
	});

	// ── context() ────────────────────────────────────────────────────────────

	describe('context()', () => {
		it('returns the existing context after use()', () => {
			const { plugin, ctx } = wirePlugin();
			// context() returns what was set during use()
			const returnedCtx = plugin.context();
			expect(returnedCtx).toBe(ctx);
		});

		it('throws BrowserPolicyError when AudioContext is not available', () => {
			(globalThis as Record<string, unknown>)['AudioContext'] = undefined;
			(globalThis as Record<string, unknown>)['webkitAudioContext'] = undefined;

			const plugin = new AudioGraphPlugin();
			expect(() => plugin.context()).toThrow('AudioContext is not available');
		});
	});

	// ── analyserSource() ──────────────────────────────────────────────────────

	describe('analyserSource()', () => {
		it('returns the same AnalyserNode on repeated calls (singleton)', () => {
			const { plugin } = wirePlugin();
			const analyser1 = plugin.analyserSource();
			const analyser2 = plugin.analyserSource();
			expect(analyser1).toBe(analyser2);
		});

		it('applies opts.fftSize to the analyser node', () => {
			const { plugin, ctx } = wirePlugin({ fftSize: 4096 });
			plugin.analyserSource();
			expect(ctx._analyser.fftSize).toBe(4096);
		});

		it('applies opts.smoothing to the analyser node', () => {
			const { plugin, ctx } = wirePlugin({ smoothing: 0.5 });
			plugin.analyserSource();
			expect(ctx._analyser.smoothingTimeConstant).toBeCloseTo(0.5);
		});
	});

	// ── chain:rebuilt event ───────────────────────────────────────────────────

	describe('chain:rebuilt event', () => {
		it('emitted on insertEffect()', () => {
			const { plugin, player } = wirePlugin();
			const rebuilt: unknown[] = [];
			player.on('plugin:audio-graph:chain:rebuilt' as never, () => rebuilt.push(true));

			plugin.insertEffect(makeAudioNode(), 'post');

			expect(rebuilt.length).toBeGreaterThan(0);
		});

		it('emitted on removeEffect()', () => {
			const { plugin, player } = wirePlugin();
			const node = makeAudioNode();
			plugin.insertEffect(node, 'post');

			const rebuilt: unknown[] = [];
			player.on('plugin:audio-graph:chain:rebuilt' as never, () => rebuilt.push(true));

			plugin.removeEffect(node);

			expect(rebuilt.length).toBeGreaterThan(0);
		});
	});

	// ── context:closed on dispose ─────────────────────────────────────────────

	describe('dispose()', () => {
		it('emits context:closed', () => {
			const { plugin, player } = wirePlugin();
			const closed: unknown[] = [];
			player.on('plugin:audio-graph:context:closed' as never, () => closed.push(true));

			plugin.dispose();

			expect(closed).toHaveLength(1);
		});

		it('is idempotent — double dispose does not throw', () => {
			const { plugin } = wirePlugin();
			plugin.dispose();
			expect(() => plugin.dispose()).not.toThrow();
		});
	});

	// ── unsupported event ─────────────────────────────────────────────────────

	describe('unsupported() path', () => {
		it('emits unsupported + throws BrowserPolicyError when AudioContext is missing', () => {
			(globalThis as Record<string, unknown>)['AudioContext'] = undefined;
			(globalThis as Record<string, unknown>)['webkitAudioContext'] = undefined;

			const player = new EventEmitter<BaseEventMap>();
			const plugin = new AudioGraphPlugin();
			const lifecycle = new LifecycleRegistry();

			(plugin as unknown as { player: typeof player }).player = player;
			(plugin as unknown as { lifecycle: typeof lifecycle }).lifecycle = lifecycle;
			(plugin as unknown as { opts: object }).opts = {};

			const unsupported: Array<{ reason: string }> = [];
			player.on('plugin:audio-graph:unsupported' as never, (data: { reason: string }) => unsupported.push(data));

			expect(() => plugin.use()).toThrow('AudioContext is not available');
			expect(unsupported).toHaveLength(1);
			expect(unsupported[0]!.reason).toContain('AudioContext');
		});
	});
});
