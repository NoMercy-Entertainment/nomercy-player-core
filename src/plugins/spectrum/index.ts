import type { BaseEventMap, IPlayer, RequireSpec } from '../../types';
import type { VisualizationFrame } from '../visualization';
import { PluginError } from '../../errors';
import { Plugin } from '../../plugin';
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
}

/** Events emitted by {@link SpectrumPlugin}. */
export interface SpectrumEvents {
	/**
	 * Fired once per RAF tick with fresh FFT and waveform data.
	 * `frame` contains the full `VisualizationFrame` snapshot.
	 * `energy` carries the pre-computed bass/mid/treble band energies (0..1)
	 * as a convenience so listeners don't have to re-slice the FFT buffer.
	 */
	frame: { frame: VisualizationFrame; energy: { bass: number; mid: number; treble: number } };
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
	private smoothedEnergy: number = 0;
	private _currentFrame: VisualizationFrame | null = null;
	private beatProviders: BeatProvider[] = [];

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

		this.frame((deltaMs, time) => this.tick(deltaMs, time));
	}

	/** Stops the frame tick and releases the AnalyserNode reference. */
	override dispose(): void {
		this.beatProviders = [];
		this._currentFrame = null;
		this._analyser = null;
		this.graph = null;
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

	private allocateBuffers(): void {
		const analyserNode = this._analyser;
		if (!analyserNode)
			return;
		this.freqBuffer = new Uint8Array(new ArrayBuffer(analyserNode.frequencyBinCount));
		this.waveBuffer = new Uint8Array(new ArrayBuffer(analyserNode.fftSize));
	}

	private ensureFreqBuffer(): void {
		const analyserNode = this._analyser;
		if (!analyserNode)
			return;
		if (this.freqBuffer.length !== analyserNode.frequencyBinCount) {
			this.freqBuffer = new Uint8Array(new ArrayBuffer(analyserNode.frequencyBinCount));
		}
	}

	private tick(deltaMs: number, time: number): void {
		const analyserNode = this._analyser;
		if (!analyserNode)
			return;

		this.ensureFreqBuffer();
		if (this.waveBuffer.length !== analyserNode.fftSize) {
			this.waveBuffer = new Uint8Array(new ArrayBuffer(analyserNode.fftSize));
		}

		try {
			analyserNode.getByteFrequencyData(this.freqBuffer);
		}
		catch { /* swallow */ }
		try {
			analyserNode.getByteTimeDomainData(this.waveBuffer);
		}
		catch { /* swallow */ }

		// Common bands — coarse splits roughly aligned with bass/mid/treble.
		const bass = this.bandEnergy(20, 250);
		const mid = this.bandEnergy(250, 4000);
		const treble = this.bandEnergy(4000, 16000);

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
