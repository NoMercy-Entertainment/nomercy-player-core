import type { BaseEventMap, IPlayer, RequireSpec } from '../../types';
import type {
	EqBand,
	EqBandFrequency,
	EqPreset,
	EqSliderValues,
	SliderRange,
} from './presets';
import { PluginError } from '../../errors';
import { Plugin } from '../../plugin';
import { AudioGraphPlugin } from '../audio-graph';
import {
	BUILTIN_PRESETS,
	DEFAULT_BANDS,
	DEFAULT_SLIDER_VALUES,

} from './presets';

export type {
	EqBand,
	EqBandFrequency,
	EqPreset,
	EqSliderValues,
	SliderRange,
} from './presets';

/** Sticky-zero snap window for the pre-gain slider — matches Fillz's reference. */
const PRE_GAIN_SNAP_THRESHOLD = 0.05;

export interface EqualizerOptions {
	/** Initial band layout. Index 0 must be `{ frequency: 'Pre', gain }`. Defaults to {@link DEFAULT_BANDS}. */
	bands?: ReadonlyArray<EqBand>;
	/** Initial preset name to apply on `use()`. No default — chain stays at the configured `bands`. */
	preset?: string;
	/** Replace the built-in preset list. Built-ins remain available unless explicitly omitted. */
	presets?: ReadonlyArray<EqPreset>;
	/** Override slider ranges (pre-gain + bands). */
	sliderValues?: EqSliderValues;
	/** Persist state under this storage key (auto-save on change, restore on `use()`). */
	persistKey?: string;
	/** Read persisted state on activation. Default `true`. */
	autoLoad?: boolean;
	/** Persist on every change. Default `true` when `persistKey` is set. */
	autoSave?: boolean;
	/** Smoothing time constant for `setTargetAtTime` ramps. Default `0.05` s. */
	smoothingTimeConstantSeconds?: number;
}

export interface EqualizerEvents {
	'ready': void;
	'band:changed': { band: EqBand };
	'preset:changed': { name: string | undefined };
	'change': { bands: EqBand[]; selectedPreset: string | undefined };
	'saved': void;
}

interface PersistedEqState {
	bands?: EqBand[];
	selectedPreset?: string | undefined;
	customPresets?: EqPreset[];
}

/**
 * 10-band parametric equalizer + pre-gain. Strictly opt-in.
 *
 * Architecture: depends on {@link AudioGraphPlugin}; inserts a pre-gain
 * `GainNode` + 10 peaking `BiquadFilter`s as effects on the audio chain.
 * Mounts as 'post' effects so EQ output feeds into any downstream MixerPlugin.
 *
 * Data model (ported from Fillz's v1 reference plugin, MIT):
 *  - Bands array always starts with `{ frequency: 'Pre', gain }` — pre-gain
 *    is treated as a band-like entry so consumer UIs render it with the
 *    same slider primitives as the rest.
 *  - Presets target frequencies (`{ frequency, gain }`), not positional
 *    indices, so a preset can update a subset of the chain without
 *    overwriting the rest.
 *  - Pre-gain `GainNode` is offset by +1: a slider at 0 = unity gain.
 *  - Pre-gain snaps to 0 when |value| ≤ 0.05 (sticky centre detent).
 *
 * 19 hand-tuned built-in presets (Classical, Club, Dance, Flat, Pop, Rock,
 * Soft, Live, Techno, Full Bass, Full Treble, …) + custom-preset support.
 *
 * Pairs naturally with {@link MixerPlugin} (master gain + stereo pan):
 *
 * ```ts
 * player
 *   .addPlugin(audioGraphPlugin)
 *   .addPlugin(equalizerPlugin)   // EQ stage
 *   .addPlugin(mixerPlugin);      // master out + pan
 * ```
 */
export class EqualizerPlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, EqualizerOptions, EqualizerEvents> {
	static override readonly id: string = 'equalizer';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'Web Audio biquad-filter graphic equalizer with pre-gain, hand-tuned presets, and slider helpers';

	static override readonly requires: ReadonlyArray<RequireSpec> = [AudioGraphPlugin];

	private graph: AudioGraphPlugin | null = null;
	private preGainNode: GainNode | null = null;
	private filterNodes: BiquadFilterNode[] = [];

	private _bands: EqBand[] = [];
	private _selectedPreset: string | undefined;
	private customPresets: Map<string, EqPreset> = new Map();
	private _sliderValues: EqSliderValues = DEFAULT_SLIDER_VALUES;

	override use(): void {
		const playerWithPluginAccess = this.player as unknown as { getPlugin?: <T>(c: new () => T) => T | undefined };
		const graph = playerWithPluginAccess.getPlugin?.(AudioGraphPlugin) as AudioGraphPlugin | undefined;
		if (!graph) {
			throw new PluginError({
				code: 'core:plugin/missing-dep',
				severity: 'error',
				scope: {
					kind: 'plugin',
					id: EqualizerPlugin.id,
				},
				message: 'EqualizerPlugin requires AudioGraphPlugin to be registered first.',
				context: { dependency: AudioGraphPlugin.id },
			});
		}
		this.graph = graph;

		// Resolve initial band layout. `opts.bands` overrides the default; we
		// clone so consumers can't mutate our internal state.
		const initialBands = (this.opts?.bands && this.opts.bands.length > 0)
			? this.opts.bands
			: DEFAULT_BANDS;
		this._bands = initialBands.map(b => ({ ...b }));
		this._sliderValues = this.opts?.sliderValues ?? DEFAULT_SLIDER_VALUES;

		// Build the audio chain: preGain → filter[0..N-1] → (downstream).
		const ctx = graph.context();
		const preGain = ctx.createGain();
		preGain.gain.value = this.preGainBand().gain + 1;
		this.preGainNode = preGain;

		const filterBands = this._bands.filter((b): b is EqBand & { frequency: number } => b.frequency !== 'Pre');
		this.filterNodes = filterBands.map((b) => {
			const node = ctx.createBiquadFilter();
			node.type = b.type ?? 'peaking';
			node.frequency.value = b.frequency;
			node.Q.value = b.q ?? 1;
			node.gain.value = b.gain;
			return node;
		});

		// Insert as a 'post' effect so EQ output flows into MixerPlugin if present.
		// Insert preGain first; the audio-graph rebuild reconnects from source.
		// Filters are wired in series internally and patched on chain rebuilds.
		graph.insertEffect(preGain, 'post');
		for (const f of this.filterNodes) graph.insertEffect(f, 'post');
		this.relinkInternalChain();

		// Re-link internal chain after every audio-graph rebuild (e.g. when a
		// downstream plugin inserts a new effect between us and destination).
		this.on(AudioGraphPlugin, 'chain:rebuilt', () => this.relinkInternalChain());

		// Restore persisted state if `persistKey` is set.
		const persistKey = this.opts?.persistKey;
		const restored = persistKey ? this.loadPersisted(persistKey) : undefined;
		if (restored?.customPresets) {
			for (const p of restored.customPresets) this.customPresets.set(p.name, p);
		}

		// Initial preset application: explicit option > restored state > nothing.
		if (this.opts?.preset) {
			this.preset(this.opts.preset);
		}
		else if (restored?.bands) {
			this._bands = restored.bands.map(b => ({ ...b }));
			this._selectedPreset = restored.selectedPreset;
			this.applyAllToNodes();
		}

		this.emit('ready');
	}

	override dispose(): void {
		// Persist before tearing down so the next session can restore.
		this.autoSave();
		const graph = this.graph;
		if (graph) {
			if (this.preGainNode)
				graph.removeEffect(this.preGainNode);
			for (const f of this.filterNodes) graph.removeEffect(f);
		}
		for (const f of this.filterNodes) {
			try {
				f.disconnect();
			}
			catch { /* swallow */ }
		}
		try {
			this.preGainNode?.disconnect();
		}
		catch { /* swallow */ }
		this.filterNodes = [];
		this.preGainNode = null;
		this.graph = null;
	}

	// ── Public reads / writes ──

	/** Snapshot of every band including the `'Pre'` pseudo-band at index 0. */
	bands(): EqBand[] {
		return this._bands.map(b => ({ ...b }));
	}

	/** Current pre-gain slider value (raw — the `GainNode` carries `value + 1`). */
	preGain(): number;
	/** Set the pre-gain. Snaps to 0 within ±0.05. Clears the selected preset. */
	preGain(gain: number | string): void;
	preGain(gain?: number | string): number | void {
		if (gain === undefined) {
			return this.preGainBand().gain;
		}
		const value = this.snapPreGain(this.toFloat(gain));
		this.writeBand('Pre', value);
		if (this.preGainNode)
			this.rampParam(this.preGainNode.gain, value + 1);
		this._selectedPreset = undefined;
		this.emit('band:changed', {
			band: {
				frequency: 'Pre',
				gain: value,
			},
		});
		this.emitChange();
		this.autoSave();
	}

	/** Gain (dB) of the band whose centre frequency matches `freq`, or `0` if absent. */
	band(freq: EqBandFrequency): number;
	/**
	 * Set the gain (dB) for a single band by frequency. Pass `'Pre'` to delegate
	 * to {@link preGain}. Manual changes clear the selected preset.
	 */
	band(target: EqBand): void;
	band(freq: EqBandFrequency, gain: number | string): void;
	band(targetOrFreq: EqBand | EqBandFrequency, gain?: number | string): number | void {
		if (gain === undefined && typeof targetOrFreq !== 'object') {
			return this.findBand(targetOrFreq as EqBandFrequency)?.gain ?? 0;
		}
		const target: EqBand = typeof targetOrFreq === 'object'
			? targetOrFreq
			: {
					frequency: targetOrFreq as EqBandFrequency,
					gain: this.toFloat(gain ?? 0),
				};
		if (target.frequency === 'Pre') {
			this.preGain(target.gain);
			return;
		}
		const value = this.toFloat(target.gain);
		this.writeBand(target.frequency, value);
		const node = this.findFilter(target.frequency);
		if (node)
			this.rampParam(node.gain, value);
		this._selectedPreset = undefined;
		this.emit('band:changed', {
			band: {
				frequency: target.frequency,
				gain: value,
			},
		});
		this.emitChange();
		this.autoSave();
	}

	/** Q factor of the band at `freq`, or `1` if absent. */
	q(freq: number): number;
	/** Runtime Q factor change for one band. */
	q(freq: number, value: number): void;
	q(freq: number, value?: number): number | void {
		if (value === undefined) {
			return this.findBand(freq)?.q ?? 1;
		}
		const safe = Math.max(0.0001, value);
		const band = this.findBand(freq);
		if (band)
			band.q = safe;
		const node = this.findFilter(freq);
		if (node)
			this.rampParam(node.Q, safe);
	}

	/** Returns the currently selected preset name, or `undefined` if no preset is active. */
	preset(): string | undefined;
	/**
	 * Apply a preset by name, instance, or JSON string. Unknown names return
	 * silently (matches Fillz's reference). The selected preset name is
	 * recorded so `preset()` can mirror it back to UI.
	 */
	preset(target: EqPreset | string): void;
	preset(target?: EqPreset | string): string | undefined | void {
		if (target === undefined) {
			return this._selectedPreset;
		}
		const resolved = this.resolvePreset(target);
		if (!resolved)
			return;
		for (const entry of resolved.values) {
			const value = this.toFloat(entry.gain);
			if (entry.frequency === 'Pre') {
				this.writeBand('Pre', value);
				if (this.preGainNode)
					this.rampParam(this.preGainNode.gain, value + 1);
			}
			else {
				this.writeBand(entry.frequency, value);
				const node = this.findFilter(entry.frequency);
				if (node)
					this.rampParam(node.gain, value);
			}
		}
		this._selectedPreset = resolved.name;
		this.emit('preset:changed', { name: resolved.name });
		this.emitChange();
		this.autoSave();
	}

	/** All available presets — built-ins + custom + opts.presets. */
	presets(): EqPreset[] {
		const out: EqPreset[] = [];
		for (const p of BUILTIN_PRESETS) out.push(this.clonePreset(p));
		for (const p of this.customPresets.values()) out.push(this.clonePreset(p));
		// Consumer-supplied `opts.presets` extends/replaces the catalogue.
		if (this.opts?.presets) {
			const seen = new Set(out.map(p => p.name));
			for (const p of this.opts.presets) {
				if (!seen.has(p.name))
					out.push(this.clonePreset(p));
			}
		}
		return out;
	}

	/** Current slider range configuration for pre-gain and bands. */
	sliderValues(): EqSliderValues {
		return {
			pre: { ...this._sliderValues.pre },
			band: { ...this._sliderValues.band },
		};
	}

	/** Reset every band to the configured defaults and clear the selected preset. */
	reset(): void {
		const fresh = (this.opts?.bands && this.opts.bands.length > 0)
			? this.opts.bands
			: DEFAULT_BANDS;
		this._bands = fresh.map(b => ({ ...b }));
		this._selectedPreset = undefined;
		this.applyAllToNodes();
		this.emit('preset:changed', { name: undefined });
		this.emitChange();
		this.autoSave();
	}

	/** Register or overwrite a custom preset. */
	addCustomPreset(preset: EqPreset): void {
		this.customPresets.set(preset.name, this.clonePreset(preset));
		this.autoSave();
	}

	/** Remove a custom preset. Built-ins are protected. */
	removePreset(name: string): void {
		if (this.customPresets.delete(name))
			this.autoSave();
	}

	// ── Slider helpers (mirror of Fillz's reference component API) ──

	bandSliderMin(freq: EqBandFrequency): number {
		return this.sliderRangeFor(freq).min;
	}

	bandSliderMax(freq: EqBandFrequency): number {
		return this.sliderRangeFor(freq).max;
	}

	bandSliderStep(freq: EqBandFrequency): number {
		return this.sliderRangeFor(freq).step;
	}

	/** Current band gain mapped to a 0-100 percentage for slider rendering. */
	bandSliderValue(freq: EqBandFrequency): number {
		const band = this.findBand(freq);
		if (!band)
			return 0;
		const range = this.sliderRangeFor(freq);
		const offset = freq === 'Pre' ? Math.floor(range.max / 2) : range.max;
		return ((band.gain + offset) / range.totalSteps) * 100;
	}

	// ── Persistence ──

	save(): void {
		const persistKey = this.opts?.persistKey;
		if (!persistKey)
			return;
		const state: PersistedEqState = {
			bands: this._bands.map(b => ({ ...b })),
			selectedPreset: this._selectedPreset,
			customPresets: Array.from(this.customPresets.values()).map(p => this.clonePreset(p)),
		};
		try {
			const raw = JSON.stringify(state);
			void this.storage?.set?.(persistKey, raw);
		}
		catch {
			/* swallow */
		}
		this.emit('saved');
	}

	restore(): void {
		const persistKey = this.opts?.persistKey;
		if (!persistKey)
			return;
		const restored = this.loadPersisted(persistKey);
		if (!restored)
			return;
		if (restored.customPresets) {
			this.customPresets.clear();
			for (const p of restored.customPresets) this.customPresets.set(p.name, p);
		}
		if (restored.bands) {
			this._bands = restored.bands.map(b => ({ ...b }));
			this.applyAllToNodes();
		}
		this._selectedPreset = restored.selectedPreset;
		this.emitChange();
	}

	// ── Internals ──

	private preGainBand(): EqBand {
		const pre = this._bands[0];
		if (pre && pre.frequency === 'Pre')
			return pre;
		return {
			frequency: 'Pre',
			gain: 0,
		};
	}

	private findBand(freq: EqBandFrequency): EqBand | undefined {
		return this._bands.find(b => b.frequency === freq);
	}

	private findFilter(freq: number): BiquadFilterNode | undefined {
		// Filter nodes correspond to the non-Pre bands in order.
		// `_bands` index 0 is Pre, so filter index = band index - 1.
		const idx = this._bands.findIndex(b => b.frequency === freq);
		if (idx < 1)
			return undefined;
		return this.filterNodes[idx - 1];
	}

	private writeBand(freq: EqBandFrequency, gain: number): void {
		const band = this.findBand(freq);
		if (band)
			band.gain = gain;
	}

	private resolvePreset(target: EqPreset | string): EqPreset | undefined {
		if (typeof target === 'string') {
			// Built-in by name first.
			const builtin = BUILTIN_PRESETS.find(p => p.name === target);
			if (builtin)
				return builtin;
			const custom = this.customPresets.get(target);
			if (custom)
				return custom;
			// Consumer-supplied option presets.
			const fromOpts = this.opts?.presets?.find(p => p.name === target);
			if (fromOpts)
				return fromOpts;
			// JSON-string fallback (Fillz parity).
			try {
				const parsed = JSON.parse(target) as EqPreset;
				if (parsed?.name && Array.isArray(parsed.values))
					return parsed;
			}
			catch {
				return undefined;
			}
			return undefined;
		}
		if (target?.name && Array.isArray(target.values))
			return target;
		return undefined;
	}

	private clonePreset(p: EqPreset): EqPreset {
		return {
			name: p.name,
			values: p.values.map(v => ({ ...v })),
		};
	}

	private toFloat(value: number | string): number {
		const n = typeof value === 'number' ? value : Number.parseFloat(`${value}`);
		return Number.isFinite(n) ? n : 0;
	}

	private snapPreGain(value: number): number {
		return Math.abs(value) <= PRE_GAIN_SNAP_THRESHOLD ? 0 : value;
	}

	private smoothingTau(): number {
		return this.opts?.smoothingTimeConstantSeconds ?? 0.05;
	}

	private rampParam(param: AudioParam, target: number): void {
		const ctx = this.graph?.context();
		if (ctx && typeof param.setTargetAtTime === 'function') {
			try {
				param.setTargetAtTime(target, ctx.currentTime, this.smoothingTau());
				return;
			}
			catch { /* fall through to direct set */ }
		}
		param.value = target;
	}

	private applyAllToNodes(): void {
		if (this.preGainNode)
			this.preGainNode.gain.value = this.preGainBand().gain + 1;
		for (const band of this._bands) {
			if (band.frequency === 'Pre')
				continue;
			const node = this.findFilter(band.frequency);
			if (node)
				node.gain.value = band.gain;
		}
	}

	private relinkInternalChain(): void {
		// Audio-graph's rebuild only rewires the head of each effect; the tail
		// of our internal chain (preGain → filter[0] → filter[1] → …) is ours
		// to maintain. Reconnect each link in series.
		if (!this.preGainNode || this.filterNodes.length === 0)
			return;
		try {
			this.preGainNode.connect(this.filterNodes[0]!);
		}
		catch { /* swallow — happy-dom mocks may not implement connect */ }
		for (let i = 0; i < this.filterNodes.length - 1; i++) {
			try {
				this.filterNodes[i]!.connect(this.filterNodes[i + 1]!);
			}
			catch { /* swallow */ }
		}
	}

	private autoSave(): void {
		const enabled = this.opts?.autoSave ?? !!this.opts?.persistKey;
		if (enabled && this.opts?.persistKey)
			this.save();
	}

	private loadPersisted(key: string): PersistedEqState | undefined {
		const autoLoad = this.opts?.autoLoad !== false;
		if (!autoLoad)
			return undefined;
		try {
			const raw = this.storage?.get?.(key);
			if (typeof raw === 'string')
				return JSON.parse(raw) as PersistedEqState;
		}
		catch { /* swallow */ }
		return undefined;
	}

	private sliderRangeFor(freq: EqBandFrequency): SliderRange {
		return freq === 'Pre' ? this._sliderValues.pre : this._sliderValues.band;
	}

	private emitChange(): void {
		this.emit('change', {
			bands: this.bands(),
			selectedPreset: this._selectedPreset,
		});
	}
}

export const equalizerPlugin = EqualizerPlugin;
