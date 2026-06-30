// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { BaseEventMap, IPlayer, RequireSpec } from '../../types';
import type { VisualizationFrame } from '../visualization';
import { Plugin } from '../../core/plugin';
import { PluginError } from '../../errors';
import { AudioGraphPlugin } from '../audio-graph';

/** Options for {@link SpectrumPlugin}. */
export interface SpectrumOptions {
	/**
	 * FFT size for the `AnalyserNode`. Higher values give finer frequency
	 * resolution (more bins) at the cost of time resolution. Default inherits
	 * from `AudioGraphPlugin`'s shared analyser (usually `2048`).
	 */
	fftSize?: 512 | 1024 | 2048 | 4096;
	/**
	 * Smoothing time constant 0..1 for the `AnalyserNode`. Higher values make
	 * spectrum output lag behind transients. Default inherits from the shared
	 * analyser (usually `0.8`).
	 */
	smoothingTimeConstant?: number;
	/**
	 * Target frame rate for the analysis tick, in Hz. When omitted the plugin
	 * ticks at the canvas plugin's RAF rate (usually 60 fps).
	 * Currently unused — reserved for future pacing control.
	 */
	frameRate?: number;
	/**
	 * Enable stereo analysis. When `true` the plugin wires a
	 * `ChannelSplitterNode` feeding two separate `AnalyserNode`s (L and R) from
	 * the same audio graph source. The frame will include `frequencyLeft`,
	 * `frequencyRight`, `waveformLeft`, and `waveformRight` Uint8Array fields.
	 *
	 * Default `false`. Enabling this allocates two extra AnalyserNodes and four
	 * extra Uint8Array buffers per frame.
	 */
	stereo?: boolean;
}

/** Events emitted by {@link SpectrumPlugin}. */
export interface SpectrumEvents {
	/**
	 * Fired once per RAF tick with fresh FFT and waveform data.
	 * `frame` contains the full `VisualizationFrame` snapshot.
	 * `energy` carries the pre-computed bass/mid/treble band energies (0..1)
	 * as a convenience so listeners don't have to re-slice the FFT buffer.
	 */
	'frame': { frame: VisualizationFrame; energy: { bass: number; mid: number; treble: number } };

	/**
	 * Fired whenever `options(partial)` is called on this plugin. Payload is the
	 * full merged options object after the update. Mirrors the base-class
	 * `plugin:spectrum:opts:changed` player event but typed for plugin-to-plugin
	 * listeners using `on(SpectrumPlugin, 'opts:changed', fn)`.
	 */
	'opts:changed': SpectrumOptions;
}

type BeatProvider = () => { beat?: boolean; bpm?: number };

/**
 * FFT analyser that drives the visualization pipeline. Requires
 * {@link AudioGraphPlugin} to be registered first.
 *
 * **What it does**
 *
 * On `use()` it acquires the shared `AnalyserNode` from `AudioGraphPlugin`,
 * allocates typed `Uint8Array` buffers for frequency and waveform data, and
 * starts a per-RAF tick. Each tick calls `getByteFrequencyData` and
 * `getByteTimeDomainData`, computes coarse band energies (bass / mid / treble),
 * polls any registered beat providers, and emits a `frame` event with the
 * full `VisualizationFrame` payload.
 *
 * `VisualizationPlugin` subclasses consume these frames via the `frame` event.
 * Advanced consumers can also call `analyser()` directly for raw `AnalyserNode`
 * access, or `bandEnergy(loHz, hiHz)` for custom frequency ranges.
 *
 * **Events**
 *
 * - `frame` — fired every RAF tick; carries `VisualizationFrame` + band energies.
 *
 * **Usage**
 *
 * ```ts
 * player
 *   .addPlugin(audioGraphPlugin)
 *   .addPlugin(spectrumPlugin, { fftSize: 2048 })
 *   .addPlugin(canvasPlugin)
 *   .addPlugin(MyVisualization);
 *
 * const spectrum = player.getPlugin(SpectrumPlugin);
 * spectrum.registerBeatProvider(() => ({ beat: myDetector.beat, bpm: 128 }));
 * ```
 */
export class SpectrumPlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, SpectrumOptions, SpectrumEvents> {
	static override readonly id: string = 'spectrum';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'AnalyserNode spectrum + waveform frame source for visualizers';

	static override readonly requires: ReadonlyArray<RequireSpec> = [AudioGraphPlugin];

	private graph: AudioGraphPlugin | null = null;
	private _analyser: AnalyserNode | null = null;
	private freqBuffer: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));
	private waveBuffer: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));
	private freqFloatBuffer: Float32Array<ArrayBuffer> = new Float32Array(new ArrayBuffer(0));
	private waveFloatBuffer: Float32Array<ArrayBuffer> = new Float32Array(new ArrayBuffer(0));
	private smoothedEnergy: number = 0;
	private _currentFrame: VisualizationFrame | null = null;
	private beatProviders: BeatProvider[] = [];

	/** Peak-hold values per band, decayed each frame. */
	private _peakBass: number = 0;
	private _peakMid: number = 0;
	private _peakTreble: number = 0;

	/** Stereo support — null when stereo is disabled (default). */
	private _splitter: ChannelSplitterNode | null = null;
	private _analyserLeft: AnalyserNode | null = null;
	private _analyserRight: AnalyserNode | null = null;
	private freqBufferLeft: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));
	private freqBufferRight: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));
	private waveBufferLeft: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));
	private waveBufferRight: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));

	/**
	 * When `true`, the AnalyserNode is bypassed. Each RAF tick emits the frame
	 * last supplied via `pushFrame()` instead of reading FFT data. Cleared
	 * automatically when `syntheticMode(false)` is called.
	 */
	private _syntheticMode: boolean = false;
	/** The most recent synthetic frame supplied by the caller. */
	private _syntheticFrame: VisualizationFrame | null = null;

	/** Acquires the shared AnalyserNode from AudioGraphPlugin and starts the per-frame tick. */
	override use(): void {
		const graph = this.player.getPlugin?.(AudioGraphPlugin);
		if (!graph) {
			throw new PluginError({
				code: 'core:plugin/missing-dep',
				severity: 'error',
				scope: {
					kind: 'plugin',
					id: SpectrumPlugin.id,
				},
				message: 'SpectrumPlugin requires AudioGraphPlugin to be registered first.',
				context: { dependency: AudioGraphPlugin.id },
			});
		}
		this.graph = graph;

		const analyserNode = graph.analyserSource();
		if (this.opts?.fftSize !== undefined)
			analyserNode.fftSize = this.opts.fftSize;
		if (this.opts?.smoothingTimeConstant !== undefined)
			analyserNode.smoothingTimeConstant = this.opts.smoothingTimeConstant;
		this._analyser = analyserNode;

		this.allocateBuffers();

		if (this.opts?.stereo === true)
			this.wireStereo(analyserNode);

		this.on(SpectrumPlugin, 'opts:changed', (opts) => {
			if (opts.fftSize !== undefined)
				this.fftSize(opts.fftSize);
			if (opts.smoothingTimeConstant !== undefined)
				this.smoothingTimeConstant(opts.smoothingTimeConstant);
		});

		this.frame((deltaMs, time) => this.tick(deltaMs, time));
	}

	/** Stops the frame tick and releases the AnalyserNode reference. */
	override dispose(): void {
		this.beatProviders = [];
		this._currentFrame = null;
		this._syntheticFrame = null;
		this._syntheticMode = false;
		this._analyser = null;
		this.graph = null;

		this._peakBass = 0;
		this._peakMid = 0;
		this._peakTreble = 0;

		try {
			this._splitter?.disconnect();
			this._analyserLeft?.disconnect();
			this._analyserRight?.disconnect();
		}
		catch { /* swallow */ }
		this._splitter = null;
		this._analyserLeft = null;
		this._analyserRight = null;
	}

	/**
	 * Returns the live `AnalyserNode` for advanced consumers that need direct
	 * access (e.g. custom buffer reads at non-standard intervals).
	 *
	 * Throws `PluginError` when called before `use()`.
	 */
	analyser(): AnalyserNode {
		if (!this._analyser) {
			throw new PluginError({
				code: 'core:plugin/state-uninitialized',
				severity: 'error',
				scope: {
					kind: 'plugin',
					id: SpectrumPlugin.id,
				},
				message: 'SpectrumPlugin: analyser unavailable — call use() first.',
			});
		}
		return this._analyser;
	}

	/**
	 * Returns the most recently computed `VisualizationFrame`.
	 *
	 * On the very first call before any RAF tick has fired, it calls `tick(0, 0)`
	 * to eagerly populate the frame so callers never receive `undefined`.
	 *
	 * Throws `PluginError` when the analyser is unavailable (before `use()`).
	 */
	currentFrame(): VisualizationFrame {
		if (this._currentFrame)
			return this._currentFrame;
		this.tick(0, 0);
		if (!this._currentFrame) {
			throw new PluginError({
				code: 'core:plugin/state-uninitialized',
				severity: 'error',
				scope: {
					kind: 'plugin',
					id: SpectrumPlugin.id,
				},
				message: 'SpectrumPlugin: frame unavailable.',
			});
		}
		return this._currentFrame;
	}

	/**
	 * Returns the average magnitude of FFT bins in the [loHz, hiHz] frequency
	 * range, normalised to 0..1 (0 = silence, 1 = full scale).
	 *
	 * Useful for driving custom energy meters or beat detection without
	 * subscribing to the full `frame` event. Returns `0` when the analyser is
	 * unavailable or when `loHz > hiHz`.
	 */
	bandEnergy(loHz: number, hiHz: number): number {
		const analyserNode = this._analyser;
		if (!analyserNode)
			return 0;
		const ctx = this.graph?.context();
		const sampleRate = ctx?.sampleRate ?? 44100;
		const fftSize = analyserNode.fftSize;
		const binCount = analyserNode.frequencyBinCount;
		const binHz = sampleRate / fftSize;

		const loBin = Math.max(0, Math.floor(loHz / binHz));
		const hiBin = Math.min(binCount - 1, Math.ceil(hiHz / binHz));
		if (hiBin < loBin)
			return 0;

		this.ensureFreqBuffer();
		try {
			analyserNode.getByteFrequencyData(this.freqBuffer);
		}
		catch { return 0; }

		let sum = 0;
		for (let i = loBin; i <= hiBin; i++) {
			sum += this.freqBuffer[i] ?? 0;
		}
		const span = hiBin - loBin + 1;
		return (sum / span) / 255;
	}

	/**
	 * Registers a beat / BPM provider function. Polled once per frame tick.
	 *
	 * The provider returns `{ beat?: boolean; bpm?: number }`. When multiple
	 * providers are registered, the first truthy `beat` and the last numeric
	 * `bpm` seen wins. Beat and BPM values are forwarded into every `frame`
	 * event and into the `VisualizationFrame` consumed by visualizers.
	 */
	registerBeatProvider(fn: BeatProvider): void {
		this.beatProviders.push(fn);
	}

	/**
	 * Returns whether synthetic mode is currently active.
	 *
	 * In synthetic mode the AnalyserNode is bypassed and frames supplied via
	 * `pushFrame()` are emitted instead — useful on passive NoMercy-Connect
	 * devices that have no local audio stream.
	 */
	syntheticMode(): boolean;
	/**
	 * Enables or disables synthetic mode.
	 *
	 * - `true` — bypass the AnalyserNode; emit frames from `pushFrame()` instead.
	 *   Call `pushFrame()` each time the server sends a progress/state event to
	 *   supply the synthetic data. The visualizer RAF loop continues at its normal
	 *   rate so the canvas stays live.
	 * - `false` — restore real AnalyserNode analysis (device is now active).
	 *   The last synthetic frame is discarded; the next RAF tick reads live FFT
	 *   data from the AnalyserNode.
	 */
	syntheticMode(enabled: boolean): void;
	syntheticMode(enabled?: boolean): boolean | void {
		if (enabled === undefined) {
			return this._syntheticMode;
		}
		this._syntheticMode = enabled;
		if (!enabled) {
			this._syntheticFrame = null;
		}
	}

	/**
	 * Supplies a synthetic `VisualizationFrame` for the next RAF tick.
	 *
	 * Only has an effect when `syntheticMode(true)` is active. Call this from
	 * the app's NoMercy-Connect progress handler each time the server sends a
	 * state update. The most recently pushed frame is held and re-emitted on
	 * every canvas RAF tick until replaced or until `syntheticMode(false)` is
	 * called.
	 *
	 * The `frame` is emitted verbatim — `time` and `deltaMs` are NOT overridden
	 * by the canvas RAF clock (unlike real-analysis frames). Set them from the
	 * server's progress payload for accurate seek-bar / time display.
	 *
	 * Example (app side):
	 * ```ts
	 * const spectrum = player.getPlugin(SpectrumPlugin);
	 * spectrum.syntheticMode(true);
	 *
	 * musicSocket.on('state', (state) => {
	 *   spectrum.pushFrame(buildSyntheticFrame(state));
	 * });
	 *
	 * // When device becomes active:
	 * spectrum.syntheticMode(false);
	 * ```
	 */
	pushFrame(frame: VisualizationFrame): void {
		if (!this._syntheticMode) {
			return;
		}
		this._syntheticFrame = frame;
	}

	/**
	 * Returns the current FFT size, or `undefined` before `use()` has run.
	 */
	fftSize(): 256 | 512 | 1024 | 2048 | 4096 | undefined;
	/**
	 * Changes the FFT size at runtime and re-allocates internal frequency and
	 * waveform buffers to match the new bin count. The change takes effect on
	 * the next frame tick.
	 */
	fftSize(size: 256 | 512 | 1024 | 2048 | 4096): void;
	fftSize(size?: 256 | 512 | 1024 | 2048 | 4096): 256 | 512 | 1024 | 2048 | 4096 | undefined | void {
		if (size === undefined) {
			return this._analyser?.fftSize as 256 | 512 | 1024 | 2048 | 4096 | undefined;
		}
		const analyserNode = this._analyser;
		if (!analyserNode)
			return;
		analyserNode.fftSize = size;
		this.allocateBuffers();
	}

	/**
	 * Returns the current smoothing time constant, or `undefined` before `use()`.
	 */
	smoothingTimeConstant(): number | undefined;
	/**
	 * Changes the smoothing time constant at runtime (0 = no smoothing, 1 = maximum
	 * lag). The change takes effect on the next frame tick.
	 */
	smoothingTimeConstant(value: number): void;
	smoothingTimeConstant(value?: number): number | undefined | void {
		if (value === undefined) {
			return this._analyser?.smoothingTimeConstant;
		}
		const analyserNode = this._analyser;
		if (!analyserNode)
			return;
		analyserNode.smoothingTimeConstant = value;
	}

	private allocateBuffers(): void {
		const analyserNode = this._analyser;
		if (!analyserNode)
			return;

		const binCount = analyserNode.frequencyBinCount;
		const fftSize = analyserNode.fftSize;

		this.freqBuffer = new Uint8Array(new ArrayBuffer(binCount));
		this.waveBuffer = new Uint8Array(new ArrayBuffer(fftSize));
		this.freqFloatBuffer = new Float32Array(new ArrayBuffer(binCount * 4));
		this.waveFloatBuffer = new Float32Array(new ArrayBuffer(fftSize * 4));
	}

	private ensureFreqBuffer(): void {
		const analyserNode = this._analyser;
		if (!analyserNode)
			return;

		const binCount = analyserNode.frequencyBinCount;
		const fftSize = analyserNode.fftSize;

		if (this.freqBuffer.length !== binCount) {
			this.freqBuffer = new Uint8Array(new ArrayBuffer(binCount));
			this.freqFloatBuffer = new Float32Array(new ArrayBuffer(binCount * 4));
		}
		if (this.waveBuffer.length !== fftSize) {
			this.waveBuffer = new Uint8Array(new ArrayBuffer(fftSize));
			this.waveFloatBuffer = new Float32Array(new ArrayBuffer(fftSize * 4));
		}
	}

	/**
	 * Wires a `ChannelSplitterNode` downstream of the shared mono `AnalyserNode`,
	 * feeding two dedicated `AnalyserNode`s (left and right channels). Called from
	 * `use()` only when `stereo: true` is configured.
	 *
	 * Topology: `tapSource → monoAnalyser → splitter → analyserL / analyserR`
	 *
	 * The `AnalyserNode` is a passthrough `AudioNode` — its signal flows through to
	 * any connected downstream node — so connecting the splitter to the mono
	 * analyser's output gives L/R the same pre-volume signal without needing
	 * direct access to `AudioGraphPlugin`'s private `_analysisSource`.
	 *
	 * The mono path (`monoAnalyser → destination`) is unaffected; the splitter is
	 * a parallel branch.
	 */
	private wireStereo(monoAnalyser: AnalyserNode): void {
		const audioCtx = this.graph?.context();
		if (!audioCtx)
			return;

		try {
			const splitter = audioCtx.createChannelSplitter(2);
			const analyserLeft = audioCtx.createAnalyser();
			const analyserRight = audioCtx.createAnalyser();

			analyserLeft.fftSize = monoAnalyser.fftSize;
			analyserRight.fftSize = monoAnalyser.fftSize;
			analyserLeft.smoothingTimeConstant = monoAnalyser.smoothingTimeConstant;
			analyserRight.smoothingTimeConstant = monoAnalyser.smoothingTimeConstant;

			// monoAnalyser is a passthrough — connect its output to the splitter.
			monoAnalyser.connect(splitter);
			splitter.connect(analyserLeft, 0);
			splitter.connect(analyserRight, 1);

			this._splitter = splitter;
			this._analyserLeft = analyserLeft;
			this._analyserRight = analyserRight;

			const binCount = analyserLeft.frequencyBinCount;
			const fftSz = analyserLeft.fftSize;
			this.freqBufferLeft = new Uint8Array(new ArrayBuffer(binCount));
			this.freqBufferRight = new Uint8Array(new ArrayBuffer(binCount));
			this.waveBufferLeft = new Uint8Array(new ArrayBuffer(fftSz));
			this.waveBufferRight = new Uint8Array(new ArrayBuffer(fftSz));
		}
		catch { /* AudioContext not available or stereo wiring failed — degrade to mono silently */ }
	}

	/** Decay constant applied to peak-hold values each frame (matches testbed PEAK_DECAY). */
	private static readonly PEAK_DECAY = 0.003;

	private tick(deltaMs: number, time: number): void {
		const analyserNode = this._analyser;
		if (!analyserNode)
			return;

		this.ensureFreqBuffer();

		// Byte data (0-255) — existing mono path.
		try {
			analyserNode.getByteFrequencyData(this.freqBuffer);
		}
		catch { /* swallow */ }
		try {
			analyserNode.getByteTimeDomainData(this.waveBuffer);
		}
		catch { /* swallow */ }

		// Float data — true dB frequency values and true -1..1 waveform.
		try {
			analyserNode.getFloatFrequencyData(this.freqFloatBuffer);
		}
		catch { /* swallow */ }
		try {
			analyserNode.getFloatTimeDomainData(this.waveFloatBuffer);
		}
		catch { /* swallow */ }

		// sampleRate + binHz — reuse the same math as bandEnergy().
		const ctx = this.graph?.context();
		const sampleRate = ctx?.sampleRate ?? 44100;
		const binHz = sampleRate / analyserNode.fftSize;

		// peakHz — bin index of max magnitude in float FFT × binHz.
		let peakBin = 0;
		let peakDb = -Infinity;
		for (let i = 0; i < this.freqFloatBuffer.length; i++) {
			const db = this.freqFloatBuffer[i] ?? -Infinity;
			if (db > peakDb) {
				peakDb = db;
				peakBin = i;
			}
		}
		const peakHz = peakBin * binHz;

		// Common bands — coarse splits roughly aligned with bass/mid/treble.
		const bass = this.bandEnergy(20, 250);
		const mid = this.bandEnergy(250, 4000);
		const treble = this.bandEnergy(4000, 16000);

		// Peak-hold with exponential decay — rise instantly, decay slowly.
		this._peakBass = Math.max(bass, this._peakBass - SpectrumPlugin.PEAK_DECAY);
		this._peakMid = Math.max(mid, this._peakMid - SpectrumPlugin.PEAK_DECAY);
		this._peakTreble = Math.max(treble, this._peakTreble - SpectrumPlugin.PEAK_DECAY);

		// Smoothed RMS-ish energy (0..1) for trivial kick detection.
		const instant = (bass + mid + treble) / 3;
		this.smoothedEnergy = this.smoothedEnergy * 0.8 + instant * 0.2;

		// Poll beat providers.
		let beat: boolean | undefined;
		let bpm: number | undefined;
		for (const provider of this.beatProviders) {
			try {
				const out = provider();
				if (out?.beat)
					beat = out.beat;
				if (typeof out?.bpm === 'number')
					bpm = out.bpm;
			}
			catch { /* swallow */ }
		}

		// Stereo channel data — only populated when stereo is wired.
		let frequencyLeft: Uint8Array | undefined;
		let frequencyRight: Uint8Array | undefined;
		let waveformLeft: Uint8Array | undefined;
		let waveformRight: Uint8Array | undefined;

		if (this._analyserLeft && this._analyserRight) {
			try {
				this._analyserLeft.getByteFrequencyData(this.freqBufferLeft);
			}
			catch { /* swallow */ }
			try {
				this._analyserRight.getByteFrequencyData(this.freqBufferRight);
			}
			catch { /* swallow */ }
			try {
				this._analyserLeft.getByteTimeDomainData(this.waveBufferLeft);
			}
			catch { /* swallow */ }
			try {
				this._analyserRight.getByteTimeDomainData(this.waveBufferRight);
			}
			catch { /* swallow */ }

			frequencyLeft = this.freqBufferLeft;
			frequencyRight = this.freqBufferRight;
			waveformLeft = this.waveBufferLeft;
			waveformRight = this.waveBufferRight;
		}

		const frameData: VisualizationFrame = {
			frequency: this.freqBuffer,
			waveform: this.waveBuffer,
			time,
			deltaMs,
			energy: this.smoothedEnergy,
			bandEnergies: {
				bass,
				mid,
				treble,
			},
			beat,
			bpm,
			frequencyFloat: this.freqFloatBuffer,
			waveformFloat: this.waveFloatBuffer,
			sampleRate,
			binHz,
			peakHz,
			peakBandEnergies: {
				bass: this._peakBass,
				mid: this._peakMid,
				treble: this._peakTreble,
			},
			frequencyLeft,
			frequencyRight,
			waveformLeft,
			waveformRight,
		};
		this._currentFrame = frameData;

		this.emit('frame', {
			frame: frameData,
			energy: {
				bass,
				mid,
				treble,
			},
		});
	}
}

/** Plugin alias for {@link SpectrumPlugin}. Pass to `addPlugin(spectrumPlugin)`. */
export const spectrumPlugin = SpectrumPlugin;
