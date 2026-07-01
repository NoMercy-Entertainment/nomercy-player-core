// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Effect-chain audio delivery — silence regression.
 *
 * Proven runtime failure (2026-06-14):
 *
 *   Stack: audioGraphPlugin + equalizerPlugin + mixerPlugin + spectrumPlugin
 *   Symptom: music is SILENT even though:
 *     - ctx.state === 'running'
 *     - <audio> paused:false, readyState:4, currentTime advancing
 *     - backend.outputNode(ctx).connect(ctx.destination) immediately produces audio
 *
 * Root cause A — lazy-backend context mismatch:
 *   When addPlugin(audioGraphPlugin) is called before backend() is first invoked,
 *   AudioGraphPlugin.use() creates its own AudioContext A. Inside use(),
 *   resolveMediaElement() lazily initialises the backend, which creates its own
 *   AudioContext B and registers it on the player via setPlayerAudioContext.
 *   At that point this.ctx = A and this.destination = A.destination, but the
 *   backend's source node belongs to context B. rebuildChain() calls
 *   sourceNode_B.connect(A.destination) — a cross-context connection that Chrome
 *   silently ignores (no throw, no audio).
 *
 *   Fix: after resolveMediaElement() returns, re-read the player's audioContext.
 *   If it changed (backend lazy-init updated it), adopt the new context before
 *   mounting the source and setting this.destination.
 *
 * Root cause B — duplicate EQ filter edges:
 *   EqualizerPlugin.use() called both graph.insertEffect() for every filter node
 *   AND relinkInternalChain(), and registered a 'chain:rebuilt' listener that
 *   re-ran relinkInternalChain() on every downstream insert. Since rebuildChain
 *   already wires postEffects sequentially, relinkInternalChain() was adding a
 *   second fan-out edge between each adjacent filter pair. With N=10 filters the
 *   signal doubles at each stage → extreme amplification / distortion.
 *
 *   Fix: remove the relinkInternalChain() call and chain:rebuilt listener from
 *   EqualizerPlugin.use(). rebuildChain() owns the serial wiring.
 *
 * These tests use a mock AudioContext so they run under happy-dom. They verify:
 *   1. The final chain tail (panner / last effect) connects to ctx.destination.
 *   2. ctx.destination is the SAME object as the backend source's context destination.
 *   3. No duplicate edges exist between adjacent EQ filter nodes.
 *   4. The lazy-backend context-reconciliation path is exercised.
 *   5. Spectrum plugin's analyserSource() tap does not disconnect the main chain.
 */

import type { BaseEventMap, IPlayer } from '../../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
	setPlayerAudioContext,
} from '../../index';
import { AudioGraphPlugin } from '../../plugins/audio-graph';
import { EqualizerPlugin } from '../../plugins/equalizer/index';
import { MixerPlugin } from '../../plugins/mixer';
import { SpectrumPlugin } from '../../plugins/spectrum';

// ── Web Audio stubs ───────────────────────────────────────────────────────────

class MockAudioNode {
	_connections: MockAudioNode[] = [];
	readonly label: string;

	constructor(label: string) {
		this.label = label;
	}

	connect(target: MockAudioNode): void {
		this._connections.push(target);
	}

	disconnect(): void {
		this._connections = [];
	}
}

class MockGainNode extends MockAudioNode {
	gain = { value: 1, setTargetAtTime: vi.fn() };

	constructor(label = 'gain') {
		super(label);
	}
}

class MockBiquadFilter extends MockAudioNode {
	type: BiquadFilterType = 'peaking';
	frequency = { value: 0 };
	Q = { value: 1 };
	gain = { value: 0, setTargetAtTime: vi.fn() };

	constructor(label = 'biquad') {
		super(label);
	}
}

class MockAnalyserNode extends MockAudioNode {
	fftSize = 2048;
	smoothingTimeConstant = 0.8;
	frequencyBinCount = 1024;

	constructor(label = 'analyser') {
		super(label);
	}

	getByteFrequencyData(_buf: Uint8Array): void { /* no-op */ }
	getByteTimeDomainData(_buf: Uint8Array): void { /* no-op */ }
}

class MockStereoPannerNode extends MockAudioNode {
	pan = { value: 0, setTargetAtTime: vi.fn() };

	constructor(label = 'panner') {
		super(label);
	}
}

class MockMediaElementSourceNode extends MockAudioNode {
	constructor(label = 'source') {
		super(label);
	}
}

class MockDestinationNode extends MockAudioNode {
	constructor() {
		super('destination');
	}
}

class MockAudioContext {
	state: AudioContextState = 'running';
	currentTime = 0;
	sampleRate = 44100;
	destination = new MockDestinationNode() as unknown as AudioDestinationNode;

	createGain = vi.fn((): GainNode => new MockGainNode() as unknown as GainNode);
	createBiquadFilter = vi.fn((): BiquadFilterNode => new MockBiquadFilter() as unknown as BiquadFilterNode);
	createAnalyser = vi.fn((): AnalyserNode => new MockAnalyserNode() as unknown as AnalyserNode);
	createStereoPanner = vi.fn((): StereoPannerNode => new MockStereoPannerNode() as unknown as StereoPannerNode);
	createMediaElementSource = vi.fn((_el: HTMLMediaElement): MediaElementAudioSourceNode => new MockMediaElementSourceNode() as unknown as MediaElementAudioSourceNode);
	resume = vi.fn(() => Promise.resolve());
	close = vi.fn(() => Promise.resolve());
}

// ── MockPlayer ────────────────────────────────────────────────────────────────

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = document.createElement('div');

	get id(): string {
		return this.playerId;
	}

	declare options: object;
	declare setup: (config: object) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare addPlugin: <_P>(PluginClass: unknown, opts?: unknown) => this;
	declare getPlugin: <_P extends object>(PluginClass: { new(): _P }) => _P | undefined;
	declare getPluginById: (id: string) => object | undefined;
	declare removePlugin: (PluginClass: unknown) => void;
	declare audioContext: () => AudioContext | undefined;

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

// ── MockPlayer with a backend that registers its own AudioContext lazily ──────

const _instancesLazy = new Map<string, MockPlayerLazyBackend>();

class MockPlayerLazyBackend extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = document.createElement('div');

	get id(): string {
		return this.playerId;
	}

	declare options: object;
	declare setup: (config: object) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare addPlugin: <_P>(PluginClass: unknown, opts?: unknown) => this;
	declare getPlugin: <_P extends object>(PluginClass: { new(): _P }) => _P | undefined;
	declare getPluginById: (id: string) => object | undefined;
	declare removePlugin: (PluginClass: unknown) => void;
	declare audioContext: () => AudioContext | undefined;

	private _backendCtx!: MockAudioContext;
	private _sourceNode!: MockMediaElementSourceNode;
	private _audioEl!: HTMLAudioElement;

	constructor(id?: string | number, backendCtx?: MockAudioContext) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayerLazyBackend' });
		const resolved = resolvePlayerConstructor(id, _instancesLazy, 'MockPlayerLazyBackend');
		if (resolved.kind === 'existing') {
			return resolved.instance as unknown as this;
		}
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instancesLazy.set(resolved.id, this);

		this._backendCtx = backendCtx ?? new MockAudioContext();
		this._sourceNode = new MockMediaElementSourceNode('backend-source');
		this._audioEl = document.createElement('audio');
	}

	static _resetRegistry(): void {
		_instancesLazy.clear();
	}

	/**
	 * Simulates WebAudioBackend lazy initialization:
	 * - Returns a backend object with outputNode() + mediaElement()
	 * - Registers the backend's AudioContext on the player (mirroring _wireBackend)
	 */
	backend(): {
		outputNode: (ctx: AudioContext) => AudioNode;
		mediaElement: () => HTMLMediaElement;
	} {
		// Simulate _wireBackend registering the backend's context on the player.
		// This is what NMMusicPlayer._wireBackend does when a WebAudioBackend
		// is constructed — it calls setPlayerAudioContext(this, instance.audioContext()).
		setPlayerAudioContext(this as unknown as IPlayer, this._backendCtx as unknown as AudioContext);

		return {
			outputNode: (_ctx: AudioContext): AudioNode => this._sourceNode as unknown as AudioNode,
			mediaElement: (): HTMLMediaElement => this._audioEl,
		};
	}

	get backendCtx(): MockAudioContext {
		return this._backendCtx;
	}

	get sourceNode(): MockMediaElementSourceNode {
		return this._sourceNode;
	}
}

composeMixins(MockPlayerLazyBackend.prototype, ...playerCoreMethods);

// ── Helpers ───────────────────────────────────────────────────────────────────

function installAudioContext(ctx: MockAudioContext): void {
	const Ctor = class {
		state = ctx.state;
		currentTime = ctx.currentTime;
		sampleRate = ctx.sampleRate;
		destination = ctx.destination;
		createGain = ctx.createGain.bind(ctx);
		createBiquadFilter = ctx.createBiquadFilter.bind(ctx);
		createAnalyser = ctx.createAnalyser.bind(ctx);
		createStereoPanner = ctx.createStereoPanner.bind(ctx);
		createMediaElementSource = ctx.createMediaElementSource.bind(ctx);
		resume = ctx.resume.bind(ctx);
		close = ctx.close.bind(ctx);
	};
	(globalThis as unknown as { AudioContext: unknown }).AudioContext = Ctor;
}

function removeAudioContext(): void {
	delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
}

/** Collect all unique labels reachable from `node` following its connections. */
function reachableLabels(node: MockAudioNode): Set<string> {
	const visited = new Set<MockAudioNode>();
	const labels = new Set<string>();

	function walk(current: MockAudioNode): void {
		if (visited.has(current))
			return;
		visited.add(current);
		labels.add(current.label);
		for (const next of current._connections) {
			walk(next);
		}
	}
	walk(node);
	return labels;
}

/** Returns true when `node` is connected (directly or transitively) to `target`. */
function reachesDestination(node: MockAudioNode, target: MockAudioNode): boolean {
	return reachableLabels(node).has(target.label);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Effect-chain audio delivery — full-stack EQ + mixer + spectrum', () => {
	let ctx: MockAudioContext;

	beforeEach(async () => {
		MockPlayer._resetRegistry();
		MockPlayerLazyBackend._resetRegistry();
		ctx = new MockAudioContext();
		installAudioContext(ctx);
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		MockPlayerLazyBackend._resetRegistry();
		removeAudioContext();
		document.body.innerHTML = '';
	});

	// ── Scenario 1: happy path — audioGraphPlugin → EQ → mixer ────────────────

	describe('source → EQ (preGain + 10 filters) → mixer (gain + panner) → destination', () => {
		it('chain tail (panner) connects to ctx.destination', async () => {
			const div = document.createElement('div');
			div.id = 'chain-full-1';
			document.body.appendChild(div);

			const player = new MockPlayer('chain-full-1');
			player.setup({});
			await player.ready();

			setPlayerAudioContext(player as unknown as IPlayer, ctx as unknown as AudioContext);

			const audioEl = document.createElement('audio');
			document.body.appendChild(audioEl);

			// Provide a source node via a minimal backend mock (context pre-registered).
			const sourceNode = new MockMediaElementSourceNode('source');
			const rawPlayer = player as unknown as {
				backend?: () => { outputNode: (audioContext: AudioContext) => AudioNode; mediaElement: () => HTMLMediaElement };
			};
			rawPlayer.backend = () => ({
				outputNode: (_c: AudioContext): AudioNode => sourceNode as unknown as AudioNode,
				mediaElement: () => audioEl,
			});

			player.addPlugin(AudioGraphPlugin, { fftSize: 2048 });
			player.addPlugin(EqualizerPlugin, { preset: 'Flat' });
			player.addPlugin(MixerPlugin, { pan: 0 });

			// Wait for async plugin installs.
			await new Promise(resolve => setTimeout(resolve, 0));

			const destination = ctx.destination as unknown as MockAudioNode;

			expect(reachesDestination(sourceNode, destination)).toBe(true);
		});

		it('no node in the EQ filter chain has duplicate edges to its successor', async () => {
			const div = document.createElement('div');
			div.id = 'chain-no-dup-1';
			document.body.appendChild(div);

			const player = new MockPlayer('chain-no-dup-1');
			player.setup({});
			await player.ready();

			setPlayerAudioContext(player as unknown as IPlayer, ctx as unknown as AudioContext);

			const audioEl = document.createElement('audio');
			document.body.appendChild(audioEl);

			const sourceNode = new MockMediaElementSourceNode('source');
			const rawPlayer = player as unknown as {
				backend?: () => { outputNode: (audioContext: AudioContext) => AudioNode; mediaElement: () => HTMLMediaElement };
			};
			rawPlayer.backend = () => ({
				outputNode: (_c: AudioContext): AudioNode => sourceNode as unknown as AudioNode,
				mediaElement: () => audioEl,
			});

			player.addPlugin(AudioGraphPlugin, { fftSize: 2048 });
			player.addPlugin(EqualizerPlugin, { preset: 'Flat' });
			player.addPlugin(MixerPlugin, { pan: 0 });

			await new Promise(resolve => setTimeout(resolve, 0));

			// Every node in the chain should have exactly ONE connection to the next.
			// Walk source → first postEffect → ... → last postEffect.
			const graph = player.getPlugin(AudioGraphPlugin)!;
			const outputNode = graph.outputNode() as unknown as MockAudioNode;

			// Walk the full chain from source and verify no node has >1 connection
			// to the same successor.
			const visited = new Set<MockAudioNode>();
			const queue: MockAudioNode[] = [sourceNode];

			while (queue.length > 0) {
				const current = queue.shift()!;
				if (visited.has(current))
					continue;
				visited.add(current);

				// Each node should connect to each successor at most once.
				const seen = new Set<MockAudioNode>();
				for (const next of current._connections) {
					expect(seen.has(next)).toBe(false);
					seen.add(next);
					queue.push(next);
				}
			}

			// Verify the last node in the managed chain was visited.
			expect(visited.has(outputNode)).toBe(true);
		});
	});

	// ── Scenario 2: lazy-backend context reconciliation ────────────────────────

	describe('lazy-backend context reconciliation (root cause A)', () => {
		it('chain reaches destination when backend is initialised lazily inside AudioGraphPlugin.use()', async () => {
			const backendCtx = new MockAudioContext();
			// Do NOT pre-register the backend context on the player.
			// The player's audioContext() returns undefined at addPlugin time.
			// This simulates the case where addPlugin(audioGraphPlugin) is called
			// before backend() is ever invoked.

			const div = document.createElement('div');
			div.id = 'lazy-backend-1';
			document.body.appendChild(div);

			const player = new MockPlayerLazyBackend('lazy-backend-1', backendCtx);
			player.setup({});
			await player.ready();

			// AudioContext exposed to AudioGraphPlugin will initially be the
			// globally-installed mock (ctx from beforeEach), NOT backendCtx.
			// When AudioGraphPlugin.use() calls resolveMediaElement(), the
			// player.backend() method runs, calls setPlayerAudioContext with
			// backendCtx, and the plugin must pick it up.
			player.addPlugin(AudioGraphPlugin, { fftSize: 2048 });
			player.addPlugin(EqualizerPlugin, { preset: 'Flat' });
			player.addPlugin(MixerPlugin, { pan: 0 });

			await new Promise(resolve => setTimeout(resolve, 0));

			// After all plugins install, the source (player.backendCtx's sourceNode)
			// must reach the backend context's destination.
			const sourceNode = player.sourceNode as unknown as MockAudioNode;
			const backendDest = backendCtx.destination as unknown as MockAudioNode;

			expect(reachesDestination(sourceNode, backendDest)).toBe(true);
		});

		it('plugin audioContext() returns the backend context after lazy init', async () => {
			const backendCtx = new MockAudioContext();

			const div = document.createElement('div');
			div.id = 'lazy-backend-ctx-1';
			document.body.appendChild(div);

			const player = new MockPlayerLazyBackend('lazy-backend-ctx-1', backendCtx);
			player.setup({});
			await player.ready();

			player.addPlugin(AudioGraphPlugin, { fftSize: 2048 });

			await new Promise(resolve => setTimeout(resolve, 0));

			const graph = player.getPlugin(AudioGraphPlugin)!;
			expect(graph.context()).toBe(backendCtx as unknown as AudioContext);
		});
	});

	// ── Scenario 3: spectrum plugin tap does not break the main chain ──────────

	describe('spectrum analyserSource() tap does not disrupt the main chain', () => {
		it('chain remains connected to destination after SpectrumPlugin mounts', async () => {
			const div = document.createElement('div');
			div.id = 'spectrum-tap-1';
			document.body.appendChild(div);

			const player = new MockPlayer('spectrum-tap-1');
			player.setup({});
			await player.ready();

			setPlayerAudioContext(player as unknown as IPlayer, ctx as unknown as AudioContext);

			const audioEl = document.createElement('audio');
			document.body.appendChild(audioEl);

			const sourceNode = new MockMediaElementSourceNode('source');
			const rawPlayer = player as unknown as {
				backend?: () => { outputNode: (audioContext: AudioContext) => AudioNode; mediaElement: () => HTMLMediaElement };
			};
			rawPlayer.backend = () => ({
				outputNode: (_c: AudioContext): AudioNode => sourceNode as unknown as AudioNode,
				mediaElement: () => audioEl,
			});

			player.addPlugin(AudioGraphPlugin, { fftSize: 2048 });
			player.addPlugin(EqualizerPlugin, { preset: 'Flat' });
			player.addPlugin(MixerPlugin, { pan: 0 });

			await new Promise(resolve => setTimeout(resolve, 0));

			// Simulate the app mounting SpectrumPlugin later (on a DOM ref).
			player.addPlugin(SpectrumPlugin, { fftSize: 2048 });

			await new Promise(resolve => setTimeout(resolve, 0));

			const destination = ctx.destination as unknown as MockAudioNode;
			expect(reachesDestination(sourceNode, destination)).toBe(true);
		});

		it('spectrum analyser tap does not add duplicate edges to the chain destination', async () => {
			const div = document.createElement('div');
			div.id = 'spectrum-tap-2';
			document.body.appendChild(div);

			const player = new MockPlayer('spectrum-tap-2');
			player.setup({});
			await player.ready();

			setPlayerAudioContext(player as unknown as IPlayer, ctx as unknown as AudioContext);

			const audioEl = document.createElement('audio');
			document.body.appendChild(audioEl);

			const sourceNode = new MockMediaElementSourceNode('source');
			const rawPlayer = player as unknown as {
				backend?: () => { outputNode: (audioContext: AudioContext) => AudioNode; mediaElement: () => HTMLMediaElement };
			};
			rawPlayer.backend = () => ({
				outputNode: (_c: AudioContext): AudioNode => sourceNode as unknown as AudioNode,
				mediaElement: () => audioEl,
			});

			player.addPlugin(AudioGraphPlugin, { fftSize: 2048 });
			player.addPlugin(EqualizerPlugin, { preset: 'Flat' });
			player.addPlugin(MixerPlugin, { pan: 0 });
			player.addPlugin(SpectrumPlugin, { fftSize: 2048 });

			await new Promise(resolve => setTimeout(resolve, 0));

			// The analyser is a parallel tap — it must NOT be connected to
			// ctx.destination. Destination receives signal only through the panner
			// (last mixer effect). The analyser hangs off source as a dead-end branch.
			const graph = player.getPlugin(AudioGraphPlugin)!;
			const analyserNode = graph.analyserSource() as unknown as MockAudioNode;
			const destination = ctx.destination as unknown as MockAudioNode;

			expect(analyserNode._connections).not.toContain(destination);
		});
	});

	// Note: a real-audio render proof (signal reaches destination through the
	// EQ + mixer chain) lives in nomercy-music-player's e2e suite
	// (webaudio-analyser.spec.ts asserts maxValue > 0; equalizer.spec.ts asserts
	// EQ boost/cut in dB), which runs against a real browser AudioContext where
	// our plugins actually shape audio. A unit-env OfflineAudioContext render
	// would only exercise the Web Audio API itself, not our plugin code.

	// ── Scenario 5: chain integrity after plugin removal ──────────────────────

	describe('chain integrity — removePlugin does not break remaining effects', () => {
		it('removing EQ leaves the mixer still wired to destination', async () => {
			const div = document.createElement('div');
			div.id = 'remove-eq-1';
			document.body.appendChild(div);

			const player = new MockPlayer('remove-eq-1');
			player.setup({});
			await player.ready();

			setPlayerAudioContext(player as unknown as IPlayer, ctx as unknown as AudioContext);

			const audioEl = document.createElement('audio');
			document.body.appendChild(audioEl);

			const sourceNode = new MockMediaElementSourceNode('source');
			const rawPlayer = player as unknown as {
				backend?: () => { outputNode: (audioContext: AudioContext) => AudioNode; mediaElement: () => HTMLMediaElement };
			};
			rawPlayer.backend = () => ({
				outputNode: (_c: AudioContext): AudioNode => sourceNode as unknown as AudioNode,
				mediaElement: () => audioEl,
			});

			player.addPlugin(AudioGraphPlugin, { fftSize: 2048 });
			player.addPlugin(EqualizerPlugin, { preset: 'Flat' });
			player.addPlugin(MixerPlugin, { pan: 0 });

			await new Promise(resolve => setTimeout(resolve, 0));

			player.removePlugin(EqualizerPlugin);

			await new Promise(resolve => setTimeout(resolve, 0));

			const destination = ctx.destination as unknown as MockAudioNode;
			expect(reachesDestination(sourceNode, destination)).toBe(true);
		});
	});
});
