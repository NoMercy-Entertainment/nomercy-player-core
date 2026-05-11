import type { BaseEventMap, IPlayer, RequireSpec } from '../types';
import { PluginError } from '../errors';
import { Plugin } from '../plugin';
import { AudioGraphPlugin } from './audio-graph';

/** Options for {@link MixerPlugin}. */
export interface MixerOptions {
	/** Initial gain in dB. Default `0` (unity). */
	gain?: number;
	/** Initial stereo pan, -1 (full left) to 1 (full right). Default `0` (centre). */
	pan?: number;
	/** Persist gain/pan under this storage key (auto-save on change, restore on `use()`). */
	persistKey?: string;
	/** Symmetric clamp for `setGain` in dB. Default `24`. */
	maxGainDb?: number;
	/** Smoothing time constant for `gain.setTargetAtTime`. Default `0.02` s. */
	smoothingTimeConstantSeconds?: number;
}

/** Events emitted by {@link MixerPlugin}. */
export interface MixerEvents {
	'gain:changed': { gain: number };
	'pan:changed': { pan: number };
	'mute:changed': { muted: boolean };
	'saved': void;
}

interface PersistedMixerState {
	gain?: number;
	pan?: number;
	muted?: boolean;
}

/**
 * Audio-graph mixer stage — pre-gain + stereo pan. Strictly opt-in.
 */
export class MixerPlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, MixerOptions, MixerEvents> {
	static override readonly id: string = 'mixer';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'Opt-in audio chain stage providing pre-gain + stereo pan';

	static override readonly requires: ReadonlyArray<RequireSpec> = [AudioGraphPlugin];

	private gainNode: GainNode | null = null;
	private pannerNode: StereoPannerNode | null = null;
	private currentGainDb: number = 0;
	private currentPan: number = 0;
	private _muted: boolean = false;
	private graph: AudioGraphPlugin | null = null;

	/** Inserts gain and stereo-panner nodes into the audio graph and restores persisted state. */
	override use(): void {
		const graph = this.player.getPlugin?.(AudioGraphPlugin);
		if (!graph) {
			// requires-check should have already prevented this, but guard anyway.
			throw new PluginError({
				code: 'core:plugin/missing-dep',
				severity: 'error',
				scope: {
					kind: 'plugin',
					id: MixerPlugin.id,
				},
				message: 'MixerPlugin requires AudioGraphPlugin to be registered first.',
				context: { dependency: AudioGraphPlugin.id },
			});
		}
		this.graph = graph;

		const ctx = graph.context();
		const gainNode = this.getGainNode(ctx);
		const pannerNode = this.getPannerNode(ctx);
		this.gainNode = gainNode;
		this.pannerNode = pannerNode;

		// Mixer sits at the END of the chain (post): gain → panner → destination.
		graph.insertEffect(gainNode, 'post');
		graph.insertEffect(pannerNode, 'post');

		// Restore persisted state if `persistKey` is set.
		const persistKey = this.opts?.persistKey;
		const restored = persistKey ? this.loadPersisted(persistKey) : undefined;

		const initialGain = restored?.gain ?? this.opts?.gain ?? 0;
		const initialPan = restored?.pan ?? this.opts?.pan ?? 0;
		const initialMuted = restored?.muted ?? false;

		this.currentGainDb = initialGain;
		this.currentPan = initialPan;
		this._muted = initialMuted;

		// Apply initial values (no ramp on initial set — just settle the params).
		gainNode.gain.value = initialMuted ? 0 : this.dbToLinear(initialGain);
		pannerNode.pan.value = this.clampPan(initialPan);
	}

	/** Removes gain and panner nodes from the audio graph and clears internal state. */
	override dispose(): void {
		const graph = this.graph;
		if (graph) {
			if (this.gainNode)
				graph.removeEffect(this.gainNode);
			if (this.pannerNode)
				graph.removeEffect(this.pannerNode);
		}
		this.gainNode = null;
		this.pannerNode = null;
		this.graph = null;
	}

	/**
	 * Read or write gain in dB.
	 *
	 * `gain()` — returns the current gain in dB.
	 * `gain(dB)` — sets gain. `0` = unity, negative attenuates, positive boosts.
	 * Smooth ramp via `setTargetAtTime`.
	 */
	gain(): number;
	gain(dB: number): void;
	gain(dB?: number): number | void {
		if (dB === undefined) {
			return this.currentGainDb;
		}
		const max = this.opts?.maxGainDb ?? 24;
		const clamped = Math.max(-max, Math.min(max, dB));
		this.currentGainDb = clamped;
		const node = this.gainNode;
		if (node) {
			const target = this._muted ? 0 : this.dbToLinear(clamped);
			this.rampParam(node.gain, target);
		}
		this.emit('gain:changed', { gain: clamped });
		this.autoSave();
	}

	/**
	 * Read or write stereo pan.
	 *
	 * `pan()` — returns the current pan value (-1..1).
	 * `pan(value)` — sets pan. `-1` full left, `0` centre, `1` full right.
	 */
	pan(): number;
	pan(value: number): void;
	pan(value?: number): number | void {
		if (value === undefined) {
			return this.currentPan;
		}
		const clamped = this.clampPan(value);
		this.currentPan = clamped;
		const node = this.pannerNode;
		if (node)
			this.rampParam(node.pan, clamped);
		this.emit('pan:changed', { pan: clamped });
		this.autoSave();
	}

	/**
	 * Read or write mute state.
	 *
	 * `muted()` — returns `true` when muted.
	 * `muted(value)` — mutes when `true`, unmutes when `false`.
	 * Gain → 0 when muted; restores configured gain when unmuted.
	 */
	muted(): boolean;
	muted(value: boolean): void;
	muted(value?: boolean): boolean | void {
		if (value === undefined) {
			return this._muted;
		}
		if (this._muted === value)
			return;
		this._muted = value;
		const node = this.gainNode;
		if (node) {
			const target = value ? 0 : this.dbToLinear(this.currentGainDb);
			this.rampParam(node.gain, target);
		}
		this.emit('mute:changed', { muted: value });
		this.autoSave();
	}

	/** Explicitly persist current gain, pan, and mute state to storage (requires `persistKey`). */
	save(): void {
		const persistKey = this.opts?.persistKey;
		if (!persistKey)
			return;
		const state: PersistedMixerState = {
			gain: this.currentGainDb,
			pan: this.currentPan,
			muted: this._muted,
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

	/** Override hook — raw `GainNode` ref. */
	protected getGainNode(ctx: AudioContext): GainNode {
		return ctx.createGain();
	}

	/** Override hook — raw `StereoPannerNode` ref. */
	protected getPannerNode(ctx: AudioContext): StereoPannerNode {
		return ctx.createStereoPanner();
	}

	private clampPan(value: number): number {
		return Math.max(-1, Math.min(1, value));
	}

	private dbToLinear(dB: number): number {
		return 10 ** (dB / 20);
	}

	private rampParam(param: AudioParam, target: number): void {
		const ctx = this.graph?.context();
		const tau = this.opts?.smoothingTimeConstantSeconds ?? 0.02;
		if (ctx && typeof param.setTargetAtTime === 'function') {
			try {
				param.setTargetAtTime(target, ctx.currentTime, tau);
				return;
			}
			catch {
				/* fall through to direct set */
			}
		}
		param.value = target;
	}

	private autoSave(): void {
		if (this.opts?.persistKey)
			this.save();
	}

	private loadPersisted(key: string): PersistedMixerState | undefined {
		try {
			const raw = this.storage?.get?.(key);
			// Storage may be sync OR async. Only synchronous values are honoured
			// at `use()` time — async backends restore lazily on the next setter.
			if (typeof raw === 'string') {
				const parsed: unknown = JSON.parse(raw);
				if (parsed !== null && typeof parsed === 'object') return parsed as PersistedMixerState;
			}
		}
		catch {
			/* swallow */
		}
		return undefined;
	}
}

/** Plugin alias for {@link MixerPlugin}. Pass to `addPlugin(mixerPlugin)`. */
export const mixerPlugin = MixerPlugin;
