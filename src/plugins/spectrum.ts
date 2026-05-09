import type { BaseEventMap, IPlayer, RequireSpec } from '../types';
import type { VisualizationFrame } from './visualization';
import { PluginError } from '../errors';
import { Plugin } from '../plugin';
import { AudioGraphPlugin } from './audio-graph';

export interface SpectrumOptions {
	fftSize?: 512 | 1024 | 2048 | 4096;
	smoothingTimeConstant?: number;
	frameRate?: number;
}

export interface SpectrumEvents {
	frame: { frame: VisualizationFrame; energy: { bass: number; mid: number; treble: number } };
}

type BeatProvider = () => { beat?: boolean; bpm?: number };

/**
 * AnalyserNode-driven spectrum + waveform frame source. Strictly opt-in.
 * Requires AudioGraphPlugin. Emits `frame` events per RAF tick with frequency,
 * waveform, time, deltaMs, energy, and pre-computed band energies.
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

	override use(): void {
		const playerWithPluginAccess = this.player as unknown as { getPlugin?: <T>(c: new () => T) => T | undefined };
		const graph = playerWithPluginAccess.getPlugin?.(AudioGraphPlugin) as AudioGraphPlugin | undefined;
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

	override dispose(): void {
		this.beatProviders = [];
		this._currentFrame = null;
		this._analyser = null;
		this.graph = null;
	}

	/** Direct AnalyserNode handle for advanced consumers. */
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

	/** Snapshot of the current visualization frame. Eager-populates on first read. */
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

	/** Sum of magnitudes in the [loHz, hiHz] band, normalized 0..1. */
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

	/** Register a beat / BPM provider. Polled per frame. */
	registerBeatProvider(fn: BeatProvider): void {
		this.beatProviders.push(fn);
	}

	/** Runtime FFT size change — re-allocates internal buffers. */
	fftSize(): 256 | 512 | 1024 | 2048 | 4096 | undefined;
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

export const spectrumPlugin = SpectrumPlugin;
