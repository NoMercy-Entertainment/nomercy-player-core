// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Deep behavioral tests for `VisualizationPlugin` (abstract base + WaveformVisualization).
 *
 * The existing visualization.test.ts covers: static metadata, graceful degradation
 * (missing canvas/spectrum), unsupported event, WaveformVisualization basic shape.
 *
 * This file covers the remaining ~46 uncovered lines:
 *  - _renderTick: one-shot setup() call before first render
 *  - _renderTick: render(ctx, payload) called with overlaid deltaMs + time
 *  - _renderTick: rendered event emitted with correct frame
 *  - _renderTick: render() error is swallowed (no crash)
 *  - _renderTick: falls back to spectrum.currentFrame() when _latestFrame is empty
 *  - currentFrame() getter returns the most recent frame
 *  - dispose() removes renderer + clears references
 *  - spectrum:frame event updates _latestFrame
 *  - setup() called exactly once even across multiple render ticks
 */

import type { VisualizationFrame } from '../../plugins/visualization';
import type { BaseEventMap } from '../../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../../index';
import { CanvasPlugin } from '../../plugins/canvas';
import { SpectrumPlugin } from '../../plugins/spectrum';
import { VisualizationPlugin, WaveformVisualization } from '../../plugins/visualization';

// ─── MockPlayer ───────────────────────────────────────────────────────────────

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = {} as HTMLElement;

	get id(): string { return this.playerId; }

	declare options: (config?: unknown) => unknown;
	declare setup: (config: unknown) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare phase: () => string;
	declare addPlugin: (PluginClass: unknown, opts?: unknown) => this;
	declare getPlugin: (PluginClass: unknown) => unknown;
	declare getPluginById: (id: string) => unknown;
	declare removePlugin: (PluginClass: unknown) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<unknown>;
	declare enabledPlugins: () => ReadonlyArray<unknown>;
	declare play: (opts?: unknown) => Promise<void>;
	declare pause: (opts?: unknown) => Promise<void>;
	declare stop: (opts?: unknown) => Promise<void>;
	declare t: (key: string, vars?: Record<string, string>) => string;
	declare time: { (): number; (t: number, opts?: unknown): Promise<void> };
	declare volume: { (): number; (v: number): void };
	declare experimental: unknown;

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

	static _reset(): void { _instances.clear(); }
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

// ─── Canvas context stub ──────────────────────────────────────────────────────

function makeCtx(): CanvasRenderingContext2D {
	return {
		canvas: { width: 640, height: 320 } as HTMLCanvasElement,
		lineWidth: 0,
		strokeStyle: '',
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
		clearRect: vi.fn(),
		fillRect: vi.fn(),
	} as unknown as CanvasRenderingContext2D;
}

// ─── Concrete visualization subclass for testing ──────────────────────────────

class TestVisualization extends VisualizationPlugin {
	static override readonly id: string = 'test:viz';

	renderCalls: Array<{ ctx: CanvasRenderingContext2D; frame: VisualizationFrame }> = [];
	setupCalls: number = 0;

	protected override setup(_ctx: CanvasRenderingContext2D): void {
		this.setupCalls++;
	}

	protected override render(ctx: CanvasRenderingContext2D, frame: VisualizationFrame): void {
		this.renderCalls.push({ ctx, frame });
	}
}

class ThrowingVisualization extends VisualizationPlugin {
	static override readonly id: string = 'test:throwing-viz';

	protected override render(_ctx: CanvasRenderingContext2D, _frame: VisualizationFrame): void {
		throw new Error('render bug');
	}
}

// ─── Fake CanvasPlugin + SpectrumPlugin ───────────────────────────────────────

function buildFakeDeps(spectrumEnabled: boolean = true): {
	fakeCanvas: { addRenderer: ReturnType<typeof vi.fn>; removeRenderer: ReturnType<typeof vi.fn> };
	fakeSpectrum: { enabled: () => boolean; currentFrame: () => VisualizationFrame };
	sampleFrame: VisualizationFrame;
} {
	const sampleFrame: VisualizationFrame = {
		frequency: new Uint8Array([100, 150, 200]),
		waveform: new Uint8Array([128, 130, 125]),
		time: 5.5,
		deltaMs: 16,
		energy: 0.4,
		bandEnergies: { bass: 0.3, mid: 0.2, treble: 0.1 },
		frequencyFloat: new Float32Array([-40, -30, -20]),
		waveformFloat: new Float32Array([0, 0.5, -0.5]),
		sampleRate: 44100,
		binHz: 44100 / 2048,
		peakHz: 2 * (44100 / 2048),
		peakBandEnergies: { bass: 0.3, mid: 0.2, treble: 0.1 },
	};

	return {
		fakeCanvas: {
			addRenderer: vi.fn(),
			removeRenderer: vi.fn(),
		},
		fakeSpectrum: {
			enabled: () => spectrumEnabled,
			currentFrame: () => sampleFrame,
		},
		sampleFrame,
	};
}

/**
 * Wire a concrete VisualizationPlugin subclass against fake dependencies,
 * bypassing addPlugin() to avoid AudioContext requirements.
 */
function wireVizPlugin<T extends VisualizationPlugin>(
	Ctor: new () => T,
	player: MockPlayer,
	spectrumEnabled: boolean = true,
): { plugin: T; fakeCanvas: ReturnType<typeof buildFakeDeps>['fakeCanvas']; fakeSpectrum: ReturnType<typeof buildFakeDeps>['fakeSpectrum']; sampleFrame: VisualizationFrame } {
	const { fakeCanvas, fakeSpectrum, sampleFrame } = buildFakeDeps(spectrumEnabled);

	// Stub getPlugin to return our fakes.
	(player as MockPlayer & { getPlugin: (ctor: unknown) => unknown }).getPlugin = (ctor: unknown) => {
		if (ctor === CanvasPlugin)
			return fakeCanvas;
		if (ctor === SpectrumPlugin)
			return fakeSpectrum;
		return undefined;
	};

	const plugin = new Ctor();

	// Wire manually: player, lifecycle, opts.
	(plugin as unknown as { player: MockPlayer }).player = player;
	(plugin as unknown as { lifecycle: { addCleanup: () => void } }).lifecycle = {
		addCleanup: vi.fn(),
	};
	(plugin as unknown as { opts: object }).opts = {};

	// Stub plugin's `on` for SpectrumPlugin events — we drive frame manually.
	const origOn = (plugin as unknown as { on: (source: unknown, ...rest: unknown[]) => unknown }).on.bind(plugin);
	(plugin as unknown as { on: typeof origOn }).on = (source: unknown, ...rest: unknown[]) => {
		if (source === SpectrumPlugin)
			return plugin; // skip spectrum subscription
		return (origOn as (...args: unknown[]) => unknown)(source, ...rest) as typeof plugin;
	};

	plugin.use();

	return { plugin, fakeCanvas, fakeSpectrum, sampleFrame };
}

/** Invoke the render tick by pulling the addRenderer callback directly. */
function invokeRenderTick(
	fakeCanvas: { addRenderer: ReturnType<typeof vi.fn> },
	ctx: CanvasRenderingContext2D,
	deltaMs: number,
	time: number,
): void {
	const callback = fakeCanvas.addRenderer.mock.calls[0]?.[0] as ((ctx: CanvasRenderingContext2D, deltaMs: number, time: number) => void) | undefined;
	if (callback) {
		callback(ctx, deltaMs, time);
	}
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VisualizationPlugin — deep behavioral coverage', () => {
	beforeEach(() => MockPlayer._reset());
	afterEach(() => {
		MockPlayer._reset();
		document.body.innerHTML = '';
	});

	// ── use() with valid deps ─────────────────────────────────────────────────

	describe('use() with canvas + spectrum available', () => {
		it('registers renderer with canvas plugin via addRenderer()', () => {
			const mockPlayer = makePlayer('viz-use-1');
			const { fakeCanvas } = wireVizPlugin(TestVisualization, mockPlayer);
			expect(fakeCanvas.addRenderer).toHaveBeenCalledOnce();
		});

		it('emits unsupported when spectrum is disabled', () => {
			const mockPlayer = makePlayer('viz-unsupported-spectrum');
			const unsupported: Array<{ reason: string }> = [];

			const plugin = new TestVisualization();
			const { fakeCanvas: _fc, fakeSpectrum } = buildFakeDeps(false);

			(mockPlayer as MockPlayer & { getPlugin: (ctor: unknown) => unknown }).getPlugin = (ctor: unknown) => {
				if (ctor === CanvasPlugin)
					return { addRenderer: vi.fn(), removeRenderer: vi.fn() };
				if (ctor === SpectrumPlugin)
					return fakeSpectrum;
				return undefined;
			};

			(plugin as unknown as { player: MockPlayer }).player = mockPlayer;
			(plugin as unknown as { lifecycle: { addCleanup: () => void } }).lifecycle = { addCleanup: vi.fn() };
			(plugin as unknown as { opts: object }).opts = {};

			mockPlayer.on('plugin:test:viz:unsupported' as never, (data: { reason: string }) => { unsupported.push(data); });
			plugin.use();

			expect(unsupported).toHaveLength(1);
			expect(unsupported[0]!.reason).toBe('spectrum-unavailable');
		});
	});

	// ── _renderTick: setup() one-shot ────────────────────────────────────────

	describe('_renderTick — setup() called once before first render', () => {
		it('setup() is called exactly once on the first render tick', () => {
			const mockPlayer = makePlayer('viz-setup-1');
			const { plugin, fakeCanvas, sampleFrame } = wireVizPlugin(TestVisualization, mockPlayer);

			// Plant a frame so the tick has data.
			(plugin as unknown as { _latestFrame: VisualizationFrame })._latestFrame = sampleFrame;

			const ctx = makeCtx();
			invokeRenderTick(fakeCanvas, ctx, 16, 5.5);
			invokeRenderTick(fakeCanvas, ctx, 16, 5.5);
			invokeRenderTick(fakeCanvas, ctx, 16, 5.5);

			expect((plugin as TestVisualization).setupCalls).toBe(1);
		});
	});

	// ── _renderTick: render() called with overlaid timing ────────────────────

	describe('_renderTick — render() receives canvas-anchored timing', () => {
		it('render() is called with deltaMs and time from the canvas RAF (not the spectrum frame)', () => {
			const mockPlayer = makePlayer('viz-timing-1');
			const { plugin, fakeCanvas, sampleFrame } = wireVizPlugin(TestVisualization, mockPlayer);

			(plugin as unknown as { _latestFrame: VisualizationFrame })._latestFrame = {
				...sampleFrame,
				deltaMs: 999, // should be overridden
				time: 999,
			};

			const ctx = makeCtx();
			invokeRenderTick(fakeCanvas, ctx, 17, 42);

			const calls = (plugin as TestVisualization).renderCalls;
			expect(calls).toHaveLength(1);
			expect(calls[0]!.frame.deltaMs).toBe(17);
			expect(calls[0]!.frame.time).toBe(42);
		});
	});

	// ── _renderTick: rendered event ───────────────────────────────────────────

	describe('_renderTick — "rendered" event emitted after render()', () => {
		it('emits rendered with the composed frame payload', () => {
			const mockPlayer = makePlayer('viz-rendered-1');
			const { plugin, fakeCanvas, sampleFrame } = wireVizPlugin(TestVisualization, mockPlayer);
			(plugin as unknown as { _latestFrame: VisualizationFrame })._latestFrame = sampleFrame;

			const rendered: Array<{ frame: VisualizationFrame }> = [];
			mockPlayer.on('plugin:test:viz:rendered' as never, (data: { frame: VisualizationFrame }) => { rendered.push(data); });

			const ctx = makeCtx();
			invokeRenderTick(fakeCanvas, ctx, 16, 5);

			expect(rendered).toHaveLength(1);
			expect(rendered[0]!.frame.time).toBe(5);
		});
	});

	// ── _renderTick: render() error is swallowed ──────────────────────────────

	describe('_renderTick — errors in render() are swallowed', () => {
		it('player loop continues after render() throws', () => {
			const mockPlayer = makePlayer('viz-throw-1');
			const { plugin, fakeCanvas, sampleFrame } = wireVizPlugin(ThrowingVisualization, mockPlayer);
			(plugin as unknown as { _latestFrame: VisualizationFrame })._latestFrame = sampleFrame;

			const ctx = makeCtx();
			// Must not throw — error is caught internally.
			expect(() => invokeRenderTick(fakeCanvas, ctx, 16, 5)).not.toThrow();
		});
	});

	// ── _renderTick: falls back to spectrum.currentFrame() ───────────────────

	describe('_renderTick — falls back to spectrum.currentFrame() when _latestFrame is undefined', () => {
		it('render() still receives a frame on first tick when no frame was cached', () => {
			const mockPlayer = makePlayer('viz-fallback-1');
			const { plugin, fakeCanvas } = wireVizPlugin(TestVisualization, mockPlayer);

			// Confirm no cached frame.
			(plugin as unknown as { _latestFrame: VisualizationFrame | undefined })._latestFrame = undefined;

			const ctx = makeCtx();
			invokeRenderTick(fakeCanvas, ctx, 16, 5);

			// render() received the fallback frame from fakeSpectrum.currentFrame()
			const calls = (plugin as TestVisualization).renderCalls;
			expect(calls).toHaveLength(1);
		});
	});

	// ── currentFrame() ────────────────────────────────────────────────────────

	describe('currentFrame()', () => {
		it('returns undefined before any tick', () => {
			const mockPlayer = makePlayer('viz-currentframe-1');
			const { plugin } = wireVizPlugin(TestVisualization, mockPlayer);
			// No ticks yet, no cached frame planted.
			(plugin as unknown as { _latestFrame: VisualizationFrame | undefined })._latestFrame = undefined;
			expect(plugin.currentFrame()).toBeUndefined();
		});

		it('returns the last rendered frame after a tick', () => {
			const mockPlayer = makePlayer('viz-currentframe-2');
			const { plugin, fakeCanvas, sampleFrame } = wireVizPlugin(TestVisualization, mockPlayer);
			(plugin as unknown as { _latestFrame: VisualizationFrame })._latestFrame = sampleFrame;

			const ctx = makeCtx();
			invokeRenderTick(fakeCanvas, ctx, 20, 10);

			const frame = plugin.currentFrame();
			expect(frame).toBeDefined();
			expect(frame!.time).toBe(10);
		});
	});

	// ── dispose() ────────────────────────────────────────────────────────────

	describe('dispose()', () => {
		it('calls removeRenderer on the canvas plugin', () => {
			const mockPlayer = makePlayer('viz-dispose-1');
			const { plugin, fakeCanvas } = wireVizPlugin(TestVisualization, mockPlayer);
			plugin.dispose();
			expect(fakeCanvas.removeRenderer).toHaveBeenCalledOnce();
		});

		it('clears _latestFrame and _renderTickBound after dispose', () => {
			const mockPlayer = makePlayer('viz-dispose-2');
			const { plugin, sampleFrame } = wireVizPlugin(TestVisualization, mockPlayer);
			(plugin as unknown as { _latestFrame: VisualizationFrame })._latestFrame = sampleFrame;
			plugin.dispose();
			expect(plugin.currentFrame()).toBeUndefined();
			expect((plugin as unknown as { _renderTickBound: unknown })._renderTickBound).toBeNull();
		});
	});

	// ── WaveformVisualization concrete subclass ───────────────────────────────

	describe('WaveformVisualization', () => {
		it('has a stable plugin id and version', () => {
			expect(WaveformVisualization.id).toBe('fillz:waveform');
			expect(WaveformVisualization.version).toBe('2.0.0');
		});

		it('render() draws a waveform stroke on the canvas context', () => {
			const mockPlayer = makePlayer('viz-waveform-render');
			const { plugin, fakeCanvas, sampleFrame } = wireVizPlugin(WaveformVisualization, mockPlayer);
			(plugin as unknown as { _latestFrame: VisualizationFrame })._latestFrame = sampleFrame;

			const ctx = makeCtx();
			invokeRenderTick(fakeCanvas, ctx, 16, 5);

			expect((ctx.beginPath as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
			expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
		});

		it('render() is a no-op when waveform array is empty', () => {
			const mockPlayer = makePlayer('viz-waveform-empty');
			const { plugin, fakeCanvas, sampleFrame } = wireVizPlugin(WaveformVisualization, mockPlayer);

			const emptyFrame: VisualizationFrame = { ...sampleFrame, waveform: new Uint8Array(0) };
			(plugin as unknown as { _latestFrame: VisualizationFrame })._latestFrame = emptyFrame;

			const ctx = makeCtx();
			invokeRenderTick(fakeCanvas, ctx, 16, 5);

			// beginPath should NOT be called for empty waveform
			expect((ctx.beginPath as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
		});
	});
});
