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

/** Options for {@link EqualizerPlugin}. */
export interface EqualizerOptions {
	/**
	 * Initial band layout. Element 0 must be `{ frequency: 'Pre', gain }` (the
	 * pre-gain pseudo-band). Defaults to {@link DEFAULT_BANDS} (10 standard
	 * frequencies + pre-gain).
	 */
	bands?: ReadonlyArray<EqBand>;
	/**
	 * Name of a built-in or custom preset to apply immediately on `use()`.
	 * When omitted, the chain starts at the configured `bands` values (or
	 * at whatever state was persisted under `persistKey`).
	 */
	preset?: string;
	/**
	 * Additional or replacement presets to merge into the catalogue returned
	 * by `presets()`. Built-in presets remain available unless you supply a
	 * preset with the same name to override it.
	 */
	presets?: ReadonlyArray<EqPreset>;
	/**
	 * Override the min/max/step ranges used by the slider helper methods
	 * (`bandSliderMin`, `bandSliderMax`, etc.). Useful when a UI uses a
	 * narrower dB range than the built-in ±12 dB band range.
	 */
	sliderValues?: EqSliderValues;
	/**
	 * Storage key for automatic persistence. When set, band state and custom
	 * presets are saved on every change and restored on `use()`.
	 * Uses the plugin's `this.storage` facade — never raw `localStorage`.
	 */
	persistKey?: string;
	/**
	 * Whether to read persisted state on `use()`. Default `true`.
	 * Set to `false` to always start from `bands` / `preset` opts even when
	 * previous state is stored.
	 */
	autoLoad?: boolean;
	/**
	 * Whether to persist state after every `band()` / `preGain()` / `preset()`
	 * call. Default `true` when `persistKey` is set.
	 */
	autoSave?: boolean;
	/**
	 * Time constant (seconds) for `AudioParam.setTargetAtTime` gain ramps.
	 * Smaller = snappier response; larger = silkier transitions.
	 * Default `0.05` s.
	 */
	smoothingTimeConstantSeconds?: number;
}

/** Events emitted by {@link EqualizerPlugin}. */
export interface EqualizerEvents {
	/** Fired at the end of `use()` once the filter chain is wired and any persisted state is restored. */
	'ready': void;
	/** Fired when a single band's gain changes — carries the updated `EqBand`. */
	'band:changed': { band: EqBand };
	/** Fired when a preset is applied or cleared. `name` is `undefined` after `reset()`. */
	'preset:changed': { name: string | undefined };
	/** Aggregate change event — carries the full band snapshot and the active preset name. */
	'change': { bands: EqBand[]; selectedPreset: string | undefined };
	/** Fired after state is successfully written to storage. */
	'saved': void;
}

interface PersistedEqState {
	bands?: EqBand[];
	selectedPreset?: string | undefined;
	customPresets?: EqPreset[];
}

/**
 * 10-band parametric equalizer with pre-gain, built-in presets, and
 * persistence support. Requires {@link AudioGraphPlugin} to be registered first.
 *
 * **Audio chain position**
 *
 * Inserts a `GainNode` (pre-gain) followed by 10 peaking `BiquadFilterNode`s
 * as `'post'` effects in the audio graph:
 *
 * ```
 * source → [preGain → filter[0] → … → filter[9]] → [MixerPlugin] → destination
 * ```
 *
 * **Band model**
 *
 * The `bands` array always starts at index 0 with `{ frequency: 'Pre', gain }`
 * — the pre-gain pseudo-band. Consumer UIs render it alongside the frequency
 * bands using the same slider primitives.
 *
 * Pre-gain is offset by +1 internally: a slider at `0` sets the `GainNode` to
 * unity gain (`1.0`). The pre-gain also has a sticky-zero snap: any value
 * within ±0.05 is snapped to exactly `0`.
 *
 * Presets target bands by frequency, not positional index, so a preset can
 * update a subset of the chain without overwriting unrelated bands.
 *
 * **Events**
 *
 * - `ready` — chain wired and initial state applied.
 * - `band:changed` — single band updated.
 * - `preset:changed` — preset applied or cleared.
 * - `change` — full snapshot after any mutation.
 * - `saved` — state written to storage.
 *
 * **Usage**
 *
 * ```ts
 * player
 *   .addPlugin(audioGraphPlugin)
 *   .addPlugin(equalizerPlugin)
 *   .addPlugin(mixerPlugin);
 *
 * const eq = player.getPlugin(EqualizerPlugin);
 * eq.preset('Rock');
 * eq.band({ frequency: 32, gain: 3 });
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

	/** Builds the biquad filter chain, inserts it into the audio graph, and restores persisted state. */
	override use(): void {
		const graph = this.player.getPlugin?.(AudioGraphPlugin);
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

	/** Persists current state, removes effect nodes from the audio graph, and clears internal state. */
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

	/**
	 * Returns a snapshot of all bands as a new array.
	 * Element 0 is always the `'Pre'` pseudo-band (pre-gain).
	 * Mutating the returned array has no effect on the internal state.
	 */
	bands(): EqBand[] {
		return this._bands.map(b => ({ ...b }));
	}

	/**
	 * Returns the current pre-gain value.
	 * This is the raw slider value; the underlying `GainNode` receives `value + 1`
	 * so that `0` maps to unity gain.
	 */
	preGain(): number;
	/**
	 * Sets the pre-gain. Values within ±0.05 snap to exactly `0` (sticky detent).
	 * Clears the active preset and emits `band:changed` + `change`.
	 */
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

	/**
	 * Returns the current gain (dB) of the band whose centre frequency matches
	 * `freq`. Returns `0` when the frequency is not present in the band layout.
	 */
	band(freq: EqBandFrequency): number;
	/**
	 * Sets the gain for a single band using an `EqBand` object.
	 * Passing `{ frequency: 'Pre', gain }` delegates to `preGain()`.
	 * Clears the active preset and emits `band:changed` + `change`.
	 */
	band(target: EqBand): void;
	/**
	 * Sets the gain for the band at `freq` to `gain` dB.
	 * Passing `'Pre'` as `freq` delegates to `preGain()`.
	 * Clears the active preset and emits `band:changed` + `change`.
	 */
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

	/** Returns the Q factor of the band at `freq`, or `1` when the band is absent. */
	q(freq: number): number;
	/**
	 * Sets the Q factor (resonance width) for the band at `freq`.
	 * Values below `0.0001` are clamped upward. Affects the live `BiquadFilterNode`
	 * immediately via `setTargetAtTime`.
	 */
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

	/** Returns the name of the currently active preset, or `undefined` when no preset is selected. */
	preset(): string | undefined;
	/**
	 * Applies a preset by name, by `EqPreset` object, or by JSON string.
	 *
	 * Resolution order: built-in by name → custom by name → `opts.presets` by
	 * name → JSON parse fallback. Unknown names return silently without error.
	 *
	 * Emits `preset:changed` and `change`. Persists when `autoSave` is enabled.
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

	/**
	 * Returns all available presets as a cloned array: built-ins first, then
	 * custom presets registered via `addCustomPreset`, then any additional
	 * presets from `EqualizerOptions.presets`. Presets with duplicate names are
	 * deduplicated (first occurrence wins).
	 */
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

	/**
	 * Returns the active slider range configuration for both pre-gain and
	 * frequency bands. Use this to drive `<input type="range">` min/max/step
	 * attributes without hardcoding values in the UI.
	 */
	sliderValues(): EqSliderValues {
		return {
			pre: { ...this._sliderValues.pre },
			band: { ...this._sliderValues.band },
		};
	}

	/**
	 * Resets every band gain to the values from `EqualizerOptions.bands` (or the
	 * built-in defaults when none were provided) and clears the active preset.
	 * Emits `preset:changed` (with `name: undefined`) and `change`.
	 */
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

	/**
	 * Adds or replaces a custom preset in the runtime catalogue.
	 * The preset becomes immediately available from `presets()` and can be
	 * applied by name via `preset(name)`. Persists the updated catalogue when
	 * `autoSave` is enabled.
	 */
	addCustomPreset(preset: EqPreset): void {
		this.customPresets.set(preset.name, this.clonePreset(preset));
		this.autoSave();
	}

	/**
	 * Removes a custom preset by name. Built-in presets cannot be removed.
	 * No-op when the name is not in the custom catalogue.
	 * Persists the updated catalogue when `autoSave` is enabled.
	 */
	removePreset(name: string): void {
		if (this.customPresets.delete(name))
			this.autoSave();
	}

	// ── Slider helpers ──

	/**
	 * Minimum raw gain value for an `<input type="range">` bound to `freq`.
	 * Derived from `EqualizerOptions.sliderValues` or the built-in defaults.
	 */
	bandSliderMin(freq: EqBandFrequency): number {
		return this.sliderRangeFor(freq).min;
	}

	/**
	 * Maximum raw gain value for an `<input type="range">` bound to `freq`.
	 * Derived from `EqualizerOptions.sliderValues` or the built-in defaults.
	 */
	bandSliderMax(freq: EqBandFrequency): number {
		return this.sliderRangeFor(freq).max;
	}

	/**
	 * Step increment for an `<input type="range">` bound to `freq`.
	 * Derived from `EqualizerOptions.sliderValues` or the built-in defaults.
	 */
	bandSliderStep(freq: EqBandFrequency): number {
		return this.sliderRangeFor(freq).step;
	}

	/**
	 * Current band gain mapped to a 0–100 percentage, suitable for feeding
	 * a slider's `value` attribute. The centre position (0 gain) maps to 50%.
	 */
	bandSliderValue(freq: EqBandFrequency): number {
		const band = this.findBand(freq);
		if (!band)
			return 0;
		const range = this.sliderRangeFor(freq);
		const offset = freq === 'Pre' ? Math.floor(range.max / 2) : range.max;
		return ((band.gain + offset) / range.totalSteps) * 100;
	}

	// ── Persistence ──

	/**
	 * Explicitly writes the current band state and custom presets to storage.
	 * No-op when `persistKey` is not set. Use when `autoSave` is disabled but
	 * you want manual control over when state is committed.
	 * Emits `saved` on success.
	 */
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

	/**
	 * Reads persisted band state and custom presets from storage and applies
	 * them immediately to the live audio nodes. No-op when `persistKey` is not
	 * set or when storage contains nothing for the key.
	 *
	 * Use when `autoLoad` is disabled but you want to trigger a manual restore
	 * at a specific moment (e.g. after the user logs in).
	 */
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
				const raw: unknown = JSON.parse(target);
				if (raw !== null && typeof raw === 'object' && 'name' in raw && Array.isArray((raw as EqPreset).values))
					return raw as EqPreset;
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
			if (typeof raw === 'string') {
				const parsed: unknown = JSON.parse(raw);
				if (parsed !== null && typeof parsed === 'object')
					return parsed as PersistedEqState;
			}
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

/** Plugin alias for {@link EqualizerPlugin}. Pass to `addPlugin(equalizerPlugin)`. */
export const equalizerPlugin = EqualizerPlugin;
