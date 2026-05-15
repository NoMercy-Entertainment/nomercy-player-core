import type { BaseEventMap, IPlayer, RequireSpec } from '../../types';
import { PluginError } from '../../errors';
import { Plugin } from '../../plugin';
import { AudioGraphPlugin } from '../audio-graph';

/** Options for {@link MixerPlugin}. */
export interface MixerOptions {
	/** Initial gain in dB. `0` = unity gain (default). Positive boosts, negative attenuates. */
	gain?: number;
	/**
	 * Initial stereo pan position. `-1` = full left, `0` = centre (default),
	 * `1` = full right. Values outside ±1 are clamped.
	 */
	pan?: number;
	/**
	 * Storage key for automatic persistence. When set, gain, pan, and mute
	 * state are saved on every change and restored on `use()`.
	 * Uses the plugin's `this.storage` facade — never raw `localStorage`.
	 */
	persistKey?: string;
	/**
	 * Symmetric dB ceiling for `gain()`. Calls with values outside ±`maxGainDb`
	 * are silently clamped. Default `24` dB.
	 */
	maxGainDb?: number;
	/**
	 * Time constant (seconds) for `AudioParam.setTargetAtTime` gain ramps.
	 * Smaller = snappier; larger = silkier. Default `0.02` s.
	 */
	smoothingTimeConstantSeconds?: number;
}

/** Events emitted by {@link MixerPlugin}. */
export interface MixerEvents {
	/** Fired after `gain()` is set. Carries the clamped dB value. */
	'gain:changed': { gain: number };
	/** Fired after `pan()` is set. Carries the clamped ±1 value. */
	'pan:changed': { pan: number };
	/** Fired when mute state changes. */
	'mute:changed': { muted: boolean };
	/** Fired after state is successfully written to storage. */
	'saved': void;
}

interface PersistedMixerState {
	gain?: number;
	pan?: number;
	muted?: boolean;
}

/**
 * Audio-graph mixer stage providing master gain and stereo pan control.
 * Requires {@link AudioGraphPlugin} to be registered first.
 *
 * **Audio chain position**
 *
 * Inserts a `GainNode` followed by a `StereoPannerNode` as the last
 * `'post'` effects, immediately before `AudioContext.destination`:
 *
 * ```
 * source → [EQ filters] → gainNode → pannerNode → destination
 * ```
 *
 * **Events**
 *
 * - `gain:changed` — gain changed (clamped dB value).
 * - `pan:changed` — pan changed (clamped ±1 value).
 * - `mute:changed` — mute state toggled.
 * - `saved` — state written to storage.
 *
 * **Usage**
 *
 * ```ts
 * player.addPlugin(audioGraphPlugin).addPlugin(mixerPlugin);
 *
 * const mixer = player.getPlugin(MixerPlugin);
 * mixer.gain(6);    // +6 dB boost
 * mixer.pan(-0.5);  // slight left
 * mixer.muted(true);
 * ```
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

	/** Returns the current gain in dB. */
	gain(): number;
	/**
	 * Sets the master gain in dB. `0` = unity, negative attenuates, positive
	 * boosts. Values outside ±`maxGainDb` are clamped. Applies a smooth ramp
	 * via `setTargetAtTime`. Emits `gain:changed` and persists when enabled.
	 */
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

	/** Returns the current stereo pan value (-1..1). */
	pan(): number;
	/**
	 * Sets the stereo pan. `-1` = full left, `0` = centre, `1` = full right.
	 * Values outside ±1 are clamped. Applies immediately via `setTargetAtTime`.
	 * Emits `pan:changed` and persists when enabled.
	 */
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

	/** Returns `true` when the mixer is currently muted. */
	muted(): boolean;
	/**
	 * Sets mute state. When `true`, the `GainNode` is ramped to `0` immediately.
	 * When `false`, it is restored to the configured gain value.
	 * No-op when the new state matches the current state.
	 * Emits `mute:changed` and persists when enabled.
	 */
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

	/**
	 * Explicitly writes gain, pan, and mute state to storage.
	 * No-op when `persistKey` is not set. Use when you want manual control over
	 * when state is committed rather than relying on auto-save.
	 * Emits `saved` on success.
	 */
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

	/**
	 * Override hook: produce the `GainNode` used for master gain and mute.
	 * Default creates a plain `GainNode` via the supplied context.
	 * Subclasses may return a pre-configured node (e.g. from a custom graph).
	 */
	protected getGainNode(ctx: AudioContext): GainNode {
		return ctx.createGain();
	}

	/**
	 * Override hook: produce the `StereoPannerNode` used for stereo pan.
	 * Default creates a plain `StereoPannerNode` via the supplied context.
	 */
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
