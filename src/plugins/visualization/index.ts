// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { BaseEventMap, IPlayer, RequireSpec } from '../../types';
import type { CanvasRenderFn } from '../canvas';
import { Plugin } from '../../core/plugin';
import { CanvasPlugin } from '../canvas';
import { SpectrumPlugin } from '../spectrum';

/**
 * Per-frame data delivered to a VisualizationPlugin's `render()`. Includes
 * spectrum, waveform, current time, BPM/beat (when a provider has supplied
 * them), pre-computed band energies, and a smoothed RMS energy value for
 * trivial "kick on bass hits" effects.
 *
 * Optional fields are populated as providers register them. Visualization
 * authors should defensively check; the kit guarantees the always-on fields.
 */
export interface VisualizationFrame {
	/** FFT magnitudes, configurable bin count (default 256). Always present. */
	frequency: Uint8Array;
	/** Time-domain samples for oscilloscope-style visuals. Always present. */
	waveform: Uint8Array;
	/** Current playback time in seconds. Always present. */
	time: number;
	/** Milliseconds since the previous frame. Always present. */
	deltaMs: number;
	/** Smoothed RMS energy 0..1 — for trivial kick/hit detection. Always present. */
	energy: number;
	/** Pre-computed common-band energies. Always present. */
	bandEnergies: { bass: number; mid: number; treble: number };
	/** True on frames close to a beat. Populated only if a beat provider is registered. */
	beat?: boolean;
	/** BPM if a provider (server-side beatdetect or client-side detector) has supplied it. */
	bpm?: number;
}

/** Options for {@link VisualizationPlugin} subclasses. */
export interface VisualizationOptions {
	/**
	 * Whether this visualizer clears the canvas before calling `render()`.
	 * Default `false` — the canvas plugin handles clearing when its
	 * `compositeMode` is `'clear'`, which is the recommended approach for
	 * stacked / layered visualizers. Set to `true` only when this specific
	 * visualizer needs an independent clear pass.
	 */
	clearBeforeRender?: boolean;
	/**
	 * Render-loop pacing. `'frame'` = driven by the canvas plugin's RAF loop
	 * (default). `'time'` = lazy poll on explicit `getFrame()` calls.
	 * Reserved for future use; currently only `'frame'` is active.
	 */
	tick?: 'frame' | 'time';
}

/** Events emitted by {@link VisualizationPlugin} subclasses. */
export interface VisualizationEvents {
	/** Emitted once during `use()` when AudioContext / spectrum is unavailable. */
	unsupported: { reason: string };
	/** Emitted each render tick after `render()` completes. */
	rendered: { frame: VisualizationFrame };
}

/**
 * Base class for canvas-based visualization plugins. Layered composition:
 *
 *  - **Layer 1** (`audioGraphPlugin`): mounts the AudioContext + signal chain
 *  - **Layer 2** (`spectrumPlugin`): produces `VisualizationFrame` data each tick
 *  - **Layer 2** (`canvasPlugin`): mounts the shared `<canvas>` + RAF loop
 *  - **Layer 3** (this): subclasses implement `render(ctx, frame)`. The base
 *    plugin registers itself with the canvas plugin's render loop and pulls
 *    fresh frames from the spectrum plugin every frame.
 *
 * Authors override only `render(ctx, frame)`. The canvas plugin owns clear /
 * composite. The spectrum plugin owns frame data.
 *
 * Bridges to p5.js, three.js, shader-based viz live in separate optional
 * packages and build ON TOP of this — never use kit internals.
 *
 * Example:
 *
 * ```ts
 * class WinampClassic extends VisualizationPlugin {
 *   static readonly id = 'fillz:winamp-classic';
 *
 *   render(ctx: CanvasRenderingContext2D, frame: VisualizationFrame) {
 *     for (let i = 0; i < frame.frequency.length; i++) {
 *       const h = (frame.frequency[i] / 255) * ctx.canvas.height;
 *       ctx.fillStyle = `hsl(${i}, 100%, 50%)`;
 *       ctx.fillRect(i * 4, ctx.canvas.height - h, 3, h);
 *     }
 *   }
 * }
 *
 * player
 *   .addPlugin(audioGraphPlugin)
 *   .addPlugin(spectrumPlugin)
 *   .addPlugin(canvasPlugin)
 *   .addPlugin(WinampClassic);
 * ```
 */
export abstract class VisualizationPlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, VisualizationOptions, VisualizationEvents> {
	static override readonly id: string = 'visualization';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'Abstract base class for canvas visualizations';

	/**
	 * Required deps: a canvas to draw to and a frame source to read from.
	 * Player refuses to register a visualizer without both already present.
	 */
	static override readonly requires: ReadonlyArray<RequireSpec> = [CanvasPlugin, SpectrumPlugin];

	private _canvasPlugin: CanvasPlugin | null = null;
	private _spectrumPlugin: SpectrumPlugin | null = null;
	private _renderTickBound: CanvasRenderFn | null = null;
	private _spectrumFrameHandler: ((data: { frame: VisualizationFrame }) => void) | null = null;
	protected _latestFrame: VisualizationFrame | undefined;
	private _setupCalled = false;

	/**
	 * Resolves the `CanvasPlugin` and `SpectrumPlugin` dependencies, registers
	 * the render callback with the canvas RAF loop, and subscribes to `frame`
	 * events from the spectrum plugin.
	 *
	 * When either dependency is missing or the spectrum plugin is in the
	 * unsupported path (e.g. no `AudioContext`), emits `unsupported` and
	 * returns early — the rest of the player keeps running.
	 */
	override use(): void {
		const canvas = this.player.getPlugin(CanvasPlugin);
		const spectrum = this.player.getPlugin(SpectrumPlugin);

		// Graceful degradation: in environments without an AudioContext (happy-dom,
		// SSR, locked autoplay policy) the spectrum plugin's `use()` will have
		// thrown and the kit marked it disabled. We still install cleanly so the
		// rest of the player keeps running — just emit `unsupported` and skip
		// renderer registration.
		if (!canvas || !spectrum || !spectrum.enabled()) {
			this.emit('unsupported', { reason: !canvas ? 'canvas-missing' : 'spectrum-unavailable' });
			return;
		}

		this._canvasPlugin = canvas;
		this._spectrumPlugin = spectrum;

		// Track the latest spectrum frame as the source of truth — `_renderTick`
		// reads from it on every canvas RAF tick.
		this._spectrumFrameHandler = (data) => {
			this._latestFrame = data.frame;
		};
		this.on(SpectrumPlugin, 'frame', this._spectrumFrameHandler);

		this._renderTickBound = this._renderTick.bind(this);
		canvas.addRenderer(this._renderTickBound);
	}

	/**
	 * Unregisters the render callback from the canvas plugin's RAF loop and
	 * clears all internal plugin references. The spectrum frame subscription
	 * is cleaned up automatically by the lifecycle registry.
	 */
	override dispose(): void {
		if (this._canvasPlugin && this._renderTickBound) {
			try {
				this._canvasPlugin.removeRenderer(this._renderTickBound);
			}
			catch { /* swallow */ }
		}
		// Spectrum subscription is auto-cleaned by the lifecycle registry via `on()`.
		this._renderTickBound = null;
		this._spectrumFrameHandler = null;
		this._canvasPlugin = null;
		this._spectrumPlugin = null;
		this._latestFrame = undefined;
		this._setupCalled = false;
	}

	/**
	 * Returns the most recent `VisualizationFrame` passed to `render()`, or
	 * `undefined` when no frame has arrived yet (spectrum hasn't ticked, or the
	 * visualizer is in the unsupported path). Safe to call from outside the
	 * render loop for snapshot reads.
	 */
	currentFrame(): VisualizationFrame | undefined {
		return this._latestFrame;
	}

	/**
	 * Override this. Called once per frame at the canvas plugin's configured
	 * FPS, with a fully-populated VisualizationFrame and the shared 2D context.
	 */
	protected abstract render(ctx: CanvasRenderingContext2D, frame: VisualizationFrame): void;

	/**
	 * Optional: override to do one-time setup after `use()` has resolved deps.
	 * Called once before the first `render()`.
	 */
	protected setup(_ctx: CanvasRenderingContext2D): void {}

	/**
	 * Optional: override to react to canvas resize events. Default behaviour
	 * is a no-op; override only if your visualization caches buffers tied to
	 * the previous size.
	 */
	protected onResize(_width: number, _height: number): void {}

	/**
	 * Optional: override to react to beat events when a beat provider is
	 * registered on the spectrum plugin. Receives the beat payload (currently
	 * `{ beat, bpm }`); use to drive kick-on-bass visuals without recomputing
	 * from raw FFT data.
	 */
	protected onBeat(_beat: { beat?: boolean; bpm?: number }): void {}

	/**
	 * Per-canvas-RAF tick. Reads the latest spectrum frame, builds the
	 * VisualizationFrame payload (overlaying the canvas-supplied deltaMs/time so
	 * timing stays anchored to the canvas loop), and dispatches to `render()`.
	 */
	private _renderTick(ctx: CanvasRenderingContext2D, deltaMs: number, time: number): void {
		const spectrum = this._spectrumPlugin;
		if (!spectrum)
			return;

		// One-shot setup hook before first render.
		if (!this._setupCalled) {
			try {
				this.setup(ctx);
			}
			catch { /* swallow — author bug shouldn't kill the loop */ }
			this._setupCalled = true;
		}

		// Pull a fresh spectrum frame. The spectrum plugin's own frame-event
		// will already have populated `_latestFrame` for the same RAF cycle in
		// most cases; this is a defensive pull so the very first render() never
		// sees `undefined`.
		let source = this._latestFrame;
		if (!source) {
			try {
				source = spectrum.currentFrame();
			}
			catch { return; }
			this._latestFrame = source;
		}

		const payload: VisualizationFrame = {
			...source,
			// Anchor timing to the canvas RAF loop (not the spectrum loop) so
			// authors get the expected per-render deltas even if the spectrum
			// has its own pacing.
			deltaMs,
			time,
		};
		this._latestFrame = payload;

		try {
			this.render(ctx, payload);
		}
		catch (err) {
			if (typeof console !== 'undefined' && console.error) {
				console.error(`[VisualizationPlugin:${(this.constructor as typeof Plugin).id}] render threw:`, err);
			}
			return;
		}

		this.emit('rendered', { frame: payload });
	}
}

/**
 * Baseline oscilloscope-style visualizer. Strokes the time-domain waveform
 * as a continuous line across the full canvas width.
 *
 * Ships as a working reference and smoke-test for the visualization pipeline.
 * Real authors extend {@link VisualizationPlugin} directly and implement their
 * own `render(ctx, frame)` method.
 *
 * Requires `audioGraphPlugin`, `spectrumPlugin`, and `canvasPlugin` to be
 * registered before this plugin.
 *
 * ```ts
 * player
 *   .addPlugin(audioGraphPlugin)
 *   .addPlugin(spectrumPlugin)
 *   .addPlugin(canvasPlugin)
 *   .addPlugin(waveformVisualization);
 * ```
 */
export class WaveformVisualization<P extends IPlayer<BaseEventMap> = IPlayer> extends VisualizationPlugin<P> {
	static override readonly id: string = 'fillz:waveform';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'Oscilloscope-style waveform stroke visualizer';

	protected override render(ctx: CanvasRenderingContext2D, frame: VisualizationFrame): void {
		const wave = frame.waveform;
		if (!wave || wave.length === 0)
			return;
		const canvasWidth = ctx.canvas.width;
		const canvasHeight = ctx.canvas.height;
		if (canvasWidth === 0 || canvasHeight === 0)
			return;

		ctx.lineWidth = 2;
		ctx.strokeStyle = '#ffffff';
		ctx.beginPath();
		const sliceWidth = canvasWidth / wave.length;
		let x = 0;
		for (let i = 0; i < wave.length; i++) {
			const sampleValue = (wave[i] ?? 128) / 128.0;
			const y = (sampleValue * canvasHeight) / 2;
			if (i === 0)
				ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
			x += sliceWidth;
		}
		ctx.stroke();
	}
}

/** Concrete alias for {@link WaveformVisualization}. Pass to `addPlugin(waveformVisualization)`. */
export const waveformVisualization = WaveformVisualization;
