// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { BaseEventMap, IPlayer } from '../../types';
import { setPlayerAudioContext } from '../../base-player';
import { Plugin } from '../../core/plugin';
import { BrowserPolicyError, PluginError } from '../../errors';

/** Options for {@link AudioGraphPlugin}. */
export interface AudioGraphOptions {
	/**
	 * Latency hint passed to `new AudioContext({ latencyHint })`.
	 * Use `'playback'` (default) for music/video — the browser optimises buffer
	 * sizes for lowest power rather than lowest latency.
	 * Use `'interactive'` when round-trip latency matters (e.g. live instruments).
	 */
	latencyHint?: AudioContextLatencyCategory;
	/**
	 * FFT size for the shared `AnalyserNode` returned by `analyserSource()`.
	 * Higher values give finer frequency resolution at the cost of time resolution.
	 * Default `2048` (1024 bins).
	 */
	fftSize?: 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384;
	/**
	 * Smoothing time constant 0..1 for the shared analyser.
	 * Higher values make spectrum output lag behind transients.
	 * Default `0.8`.
	 */
	smoothing?: number;
}

/** Events emitted by {@link AudioGraphPlugin}. */
export interface AudioGraphEvents {
	/** Fired once after the `AudioContext` is created and the baseline chain is wired. */
	'context:ready': { sampleRate: number };
	/** Fired when the `AudioContext` is closed — either on dispose or when the browser suspends it. */
	'context:closed': void;
	/** Fired every time `insertEffect` / `removeEffect` causes the full chain to be reconnected. */
	'chain:rebuilt': void;
	/** Fired when `AudioContext` is not available in the current environment. Plugin will not activate. */
	'unsupported': { reason: string };
}

/** Resolve a global AudioContext constructor across browsers. Returns `undefined` if unsupported. */
function resolveAudioContextCtor(): (new (opts?: AudioContextOptions) => AudioContext) | undefined {
	const audioGlobal = globalThis as unknown as {
		AudioContext?: new (opts?: AudioContextOptions) => AudioContext;
		webkitAudioContext?: new (opts?: AudioContextOptions) => AudioContext;
	};
	return audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;
}

/**
 * Foundation plugin that owns the Web Audio signal chain. Every other audio
 * plugin in the kit depends on this one being registered first.
 *
 * **What it does**
 *
 * On `use()` it creates (or reuses) an `AudioContext`, wraps the backend's
 * media element in a `MediaElementAudioSourceNode`, and connects the baseline
 * chain: `source → destination`. Subsequent plugins extend the chain by calling
 * `insertEffect()` or `pre()` / `post()`.
 *
 * **Chain topology**
 *
 * ```
 * [media element / backend output]
 *   └─ source node
 *       ├─ (parallel tap) → shared AnalyserNode   (read by SpectrumPlugin)
 *       ├─ preEffects[0..n]                        (e.g. EQ BiquadFilters)
 *       └─ postEffects[0..n]                       (e.g. MixerPlugin gain/pan)
 *           └─ AudioContext.destination
 * ```
 *
 * **Events**
 *
 * - `context:ready` — `AudioContext` is live; includes `sampleRate`.
 * - `context:closed` — context was closed on dispose.
 * - `chain:rebuilt` — emitted every time the effect list changes; downstream
 *   plugins that maintain internal serial connections (e.g. EQ filter chain)
 *   listen to this event to re-link their own nodes.
 * - `unsupported` — `AudioContext` is unavailable in this environment.
 *
 * **Browser autoplay policy**
 *
 * Browsers start `AudioContext` in `'suspended'` state. This plugin resumes
 * it on the first `play` event — which always fires inside or immediately after
 * a user gesture, satisfying the activation requirement.
 *
 * **Configuration**
 *
 * Pass `AudioGraphOptions` as the second argument to `addPlugin`:
 *
 * ```ts
 * player.addPlugin(audioGraphPlugin, { latencyHint: 'playback', fftSize: 2048 });
 * ```
 */
export class AudioGraphPlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, AudioGraphOptions, AudioGraphEvents> {
	static override readonly id: string = 'audio-graph';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'AudioContext + signal chain owner — opt-in foundation for every Web Audio plugin';

	private ctx: AudioContext | null = null;
	private source: AudioNode | null = null;
	private destination: AudioNode | null = null;
	private analyser: AnalyserNode | null = null;
	/**
	 * The node whose output is tapped into the AnalyserNode. When the backend
	 * exposes `analysisNode()`, this is the pre-volume raw source so spectrum
	 * magnitudes are volume-independent. Falls back to `this.source` (the volume
	 * GainNode) for backends that don't expose a separate pre-volume tap.
	 */
	private _analysisSource: AudioNode | null = null;
	/** Insertion-ordered effect chains. `pre` sits between source and post; `post` sits between pre and destination. */
	private preEffects: AudioNode[] = [];
	private postEffects: AudioNode[] = [];
	/** Manual route map — pairs created via `route()` so we can disconnect on dispose. */
	private routes: Array<[AudioNode, AudioNode]> = [];

	/**
	 * Creates (or reuses) the `AudioContext`, mounts the media element source,
	 * wires the baseline `source → destination` chain, and registers the
	 * autoplay-policy resume handler.
	 *
	 * Throws `BrowserPolicyError` and emits `unsupported` when `AudioContext` is
	 * not available (non-browser environments, locked contexts).
	 */
	override use(): void {
		const Ctor = resolveAudioContextCtor();
		if (!Ctor) {
			this.emit('unsupported', { reason: 'AudioContext not available in this environment' });
			throw new BrowserPolicyError({
				code: 'core:policy/audioContextUnsupported',
				severity: 'error',
				scope: {
					kind: 'plugin',
					id: (this.constructor as typeof Plugin).id,
				},
				message: 'AudioContext is not available in this environment.',
				suggestion: 'Web Audio plugins require a browser environment with AudioContext support.',
			});
		}

		// Reuse an existing player-owned context when present. When the backend
		// is a WebAudioBackend, the player already has its context registered via
		// _wireBackend before any plugin's use() runs — so `existing` is the
		// backend's context. This is the single-context invariant: backend
		// context === player context === plugin context.
		const existing = this.player.audioContext?.();
		let ctx = existing ?? this.createContext();

		// Write the context back onto the player so other plugins / accessors see it.
		setPlayerAudioContext(this.player, ctx);
		this.ctx = ctx;

		// Source: try the active backend's output node (preferred — avoids a
		// second createMediaElementSource call on the same element), else try
		// the backend's mediaElement directly, else use a silent placeholder
		// gain node (lets effects-only chains work in tests).
		//
		// IMPORTANT: resolveMediaElement() may lazily initialise the backend,
		// which registers its own AudioContext on the player via _wireBackend /
		// setPlayerAudioContext. If that happens, `ctx` is now stale (it was
		// created before the backend existed and belongs to a different
		// AudioContext). Re-read the player's context after the backend call so
		// that `this.source` and `this.destination` are always in the SAME
		// AudioContext instance.
		const element = this.resolveMediaElement();
		const ctxAfterBackend = this.player.audioContext?.();
		if (ctxAfterBackend && ctxAfterBackend !== ctx) {
			ctx = ctxAfterBackend;
			this.ctx = ctx;
			setPlayerAudioContext(this.player, ctx);
		}

		this.source = element
			? this.mountSource(ctx, element)
			: ctx.createGain();
		this.destination = ctx.destination;

		// Resolve the pre-volume analysis tap. When the backend exposes
		// `analysisNode(ctx)` we tap the AnalyserNode there — before the volume
		// GainNode — so spectrum magnitudes are independent of the volume fader.
		// Falls back to `this.source` for backends without a separate raw tap
		// (AudioElementBackend, test mocks).
		this._analysisSource = this.resolveBackendAnalysisNode(ctx) ?? this.source;

		this.rebuildChain();

		// Browser autoplay policy: AudioContext starts in 'suspended' state.
		// Resume on the first player 'play' event — that event fires inside or
		// immediately after a user-gesture callback, satisfying the browser's
		// activation requirement. Without this, the graph is wired but silent.
		// Reference this.ctx rather than the closed-over ctx so the correct
		// context is resumed even when ctx was updated by backend lazy-init above.
		const resumeOnPlay = (): void => {
			if (this.ctx && this.ctx.state === 'suspended') {
				this.ctx.resume().catch(() => { /* best-effort — policy blocks are silent */ });
			}
		};
		this.player.on('play', resumeOnPlay);
		this.lifecycle.addCleanup(() => this.player.off('play', resumeOnPlay));

		// Bug 3 fix — crossfade source-swap remount:
		// After a crossfade, WebAudioBackend promotes the secondary element to
		// primary and emits 'backend:sourceswap' with the new source node. If
		// this plugin's source still references the old (now-disconnected) node,
		// the EQ / mixer chain is fed by a dead source. Re-mount on the new node.
		//
		// The payload also carries `analysisNode` when the backend exposes a
		// pre-volume raw source. We update `_analysisSource` from the payload so
		// the AnalyserNode stays tapped pre-volume after the swap.
		const onSourceSwap = (payload: { sourceNode: AudioNode; analysisNode?: AudioNode }): void => {
			this.source = payload.sourceNode;
			this._analysisSource = payload.analysisNode ?? payload.sourceNode;
			this.rebuildChain();
		};

		try {
			const backend = this.player.backend?.() as
				| { on?: (event: string, fn: (p: { sourceNode: AudioNode; analysisNode?: AudioNode }) => void) => void; off?: (event: string, fn: (p: { sourceNode: AudioNode; analysisNode?: AudioNode }) => void) => void }
				| undefined;

			if (typeof backend?.on === 'function') {
				backend.on('backend:sourceswap', onSourceSwap);
				this.lifecycle.addCleanup(() => {
					backend.off?.('backend:sourceswap', onSourceSwap);
				});
			}
		}
		catch { /* player may have no backend in test environments — safe to ignore */ }

		this.lifecycle.addCleanup(() => this.tearDownGraph());

		this.emit('context:ready', { sampleRate: ctx.sampleRate });
	}

	/**
	 * Disconnects every graph node, closes the `AudioContext`, and clears all
	 * internal state. Emits `context:closed` and removes the player-level
	 * context reference so the next `use()` starts clean.
	 */
	override dispose(): void {
		this.tearDownGraph();
	}

	/**
	 * Returns the player's `AudioContext`.
	 *
	 * If `use()` has already run, the existing context is returned immediately.
	 * If called before `use()` (unusual — prefer registering the plugin first),
	 * a new context is created and registered on the player.
	 *
	 * Throws `BrowserPolicyError` in environments without `AudioContext`.
	 */
	context(): AudioContext {
		if (this.ctx)
			return this.ctx;
		const Ctor = resolveAudioContextCtor();
		if (!Ctor) {
			throw new BrowserPolicyError({
				code: 'core:policy/audioContextUnsupported',
				severity: 'error',
				scope: {
					kind: 'plugin',
					id: (this.constructor as typeof Plugin).id,
				},
				message: 'AudioContext is not available in this environment.',
			});
		}
		const ctx = this.createContext();
		setPlayerAudioContext(this.player, ctx);
		this.ctx = ctx;
		return ctx;
	}

	/**
	 * Returns the last node in the effect chain — the node currently wired
	 * directly to `AudioContext.destination`. Useful for downstream plugins that
	 * want to tap or extend the tail of the chain without calling `insertEffect`.
	 *
	 * Throws `PluginError` if called before `use()` (no source node exists yet).
	 */
	outputNode(): AudioNode {
		const last = this.postEffects[this.postEffects.length - 1]
			?? this.preEffects[this.preEffects.length - 1]
			?? this.source;
		if (!last) {
			throw new PluginError({
				code: 'core:plugin/state-uninitialized',
				severity: 'error',
				scope: {
					kind: 'plugin',
					id: AudioGraphPlugin.id,
				},
				message: 'AudioGraphPlugin: chain has no source — call use() first.',
			});
		}
		return last;
	}

	/**
	 * Returns the shared `AnalyserNode` tapped parallel to the pre-volume
	 * analysis source.
	 *
	 * The analyser is created once and reused — multiple consumers (e.g.
	 * `SpectrumPlugin`, custom visualisers) all read from the same node.
	 * FFT size and smoothing are set from `AudioGraphOptions` on first call.
	 *
	 * When the backend exposes `analysisNode()`, the AnalyserNode is wired to
	 * the raw `MediaElementAudioSourceNode` BEFORE the volume GainNode, making
	 * spectrum/FFT magnitudes volume-independent. Backends without a dedicated
	 * pre-volume node fall back to tapping `this.source` (the volume GainNode).
	 *
	 * The analyser is a parallel tap — it never interrupts the main signal path
	 * to `destination`.
	 */
	analyserSource(): AnalyserNode {
		if (this.analyser)
			return this.analyser;
		const ctx = this.context();
		const analyser = ctx.createAnalyser();
		analyser.fftSize = this.opts?.fftSize ?? 2048;
		analyser.smoothingTimeConstant = this.opts?.smoothing ?? 0.8;
		this.analyser = analyser;
		// Tap the analyser to the pre-volume analysis source so FFT magnitudes
		// are not scaled by the volume fader. Falls back to `this.source` when
		// no dedicated pre-volume node is available.
		const tapNode = this._analysisSource ?? this.source;
		if (tapNode) {
			try {
				tapNode.connect(analyser);
			}
			catch { /* already connected — ignore */ }
		}
		return analyser;
	}

	/**
	 * Appends an effect node to the signal chain and triggers a full chain
	 * rebuild so the new node is immediately wired between its neighbours and
	 * `destination`.
	 *
	 * `position`:
	 * - `'pre'` — inserted before any `'post'` effects (e.g. EQ filter banks).
	 * - `'post'` — inserted after all `'pre'` effects (default; e.g. master gain).
	 *
	 * The plugin tracks every inserted node and disconnects them all on dispose.
	 * Returns the same node for convenience so callers can store a reference.
	 */
	insertEffect(node: AudioNode, position: 'pre' | 'post' = 'post'): AudioNode {
		if (position === 'pre') {
			this.preEffects.push(node);
		}
		else {
			this.postEffects.push(node);
		}
		this.rebuildChain();
		return node;
	}

	/**
	 * Removes a previously inserted effect node from the chain.
	 *
	 * Disconnects the node and triggers a full chain rebuild so the gap is
	 * closed. Safe to call with a node that was never inserted — no-op in that
	 * case. Also safe to call during dispose.
	 */
	removeEffect(node: AudioNode): void {
		const preIdx = this.preEffects.indexOf(node);
		if (preIdx >= 0) {
			this.preEffects.splice(preIdx, 1);
		}
		const postIdx = this.postEffects.indexOf(node);
		if (postIdx >= 0) {
			this.postEffects.splice(postIdx, 1);
		}
		try {
			node.disconnect();
		}
		catch { /* swallow */ }
		this.rebuildChain();
	}

	/**
	 * Shorthand for `insertEffect(node, 'pre')`.
	 * Places the node before any `'post'` effects in the signal path.
	 */
	pre(node: AudioNode): AudioNode {
		return this.insertEffect(node, 'pre');
	}

	/**
	 * Shorthand for `insertEffect(node, 'post')`.
	 * Places the node after all `'pre'` effects in the signal path.
	 */
	post(node: AudioNode): AudioNode {
		return this.insertEffect(node, 'post');
	}

	/**
	 * Manually connects two nodes outside the managed effect chain.
	 *
	 * Use for advanced topologies — e.g. a side-chain compressor that taps the
	 * source but delivers output to a separate destination. All connections
	 * registered here are disconnected on dispose.
	 */
	route(from: AudioNode, to: AudioNode): void {
		try {
			from.connect(to);
		}
		catch { /* swallow — duplicate connect is idempotent in spec but throws on some engines */ }
		this.routes.push([from, to]);
	}

	/**
	 * Disconnects a manual node pair previously registered with `route()`.
	 * Safe to call if the pair was never routed — no-op in that case.
	 */
	unroute(from: AudioNode, to: AudioNode): void {
		const idx = this.routes.findIndex(([f, t]) => f === from && t === to);
		if (idx >= 0)
			this.routes.splice(idx, 1);
		try {
			from.disconnect(to);
		}
		catch { /* swallow */ }
	}

	/** Override hook: produce the `AudioContext`. Default uses `new AudioContext({ latencyHint })`. */
	protected createContext(): AudioContext {
		const Ctor = resolveAudioContextCtor()!;
		const latencyHint = this.opts?.latencyHint ?? 'playback';
		return new Ctor({ latencyHint });
	}

	/**
	 * Override hook: produce the source node for the graph.
	 *
	 * When the backend already owns a `MediaElementAudioSourceNode` (i.e. it
	 * exposes `outputNode(ctx)`), we reuse that node as our source rather than
	 * calling `createMediaElementSource(element)` a second time. A second call on
	 * the same element returns a silent node in Chrome without throwing — the
	 * browser silently stops routing audio through the new node.
	 *
	 * The backend's outputGain becomes this plugin's source. `rebuildChain` then
	 * connects it through any registered effects to `ctx.destination`, replacing
	 * the backend's own baseline `outputGain → destination` connection.
	 */
	protected mountSource(ctx: AudioContext, element: HTMLMediaElement): AudioNode {
		const backendOutputNode = this.resolveBackendOutputNode(ctx);
		if (backendOutputNode !== null) {
			return backendOutputNode;
		}
		return ctx.createMediaElementSource(element);
	}

	/** Best-effort lookup of the backend's media element. Returns null if no backend / no element. */
	private resolveMediaElement(): HTMLMediaElement | null {
		try {
			const backend = this.player.backend?.();
			const el = backend?.mediaElement?.();
			return el ?? null;
		}
		catch {
			return null;
		}
	}

	/**
	 * Best-effort lookup of the backend's pre-built output node.
	 *
	 * The backend contract (`IAudioBackend`) exposes `outputNode(ctx)` — when
	 * present and callable, it returns the tail of the backend's internal graph
	 * (e.g. `AudioElementBackend`'s `outputGain`). We extend the chain from that
	 * node instead of creating a second `MediaElementAudioSourceNode`.
	 *
	 * Returns `null` when:
	 *  - the player has no `backend()` method (kit-only mock player)
	 *  - the backend doesn't expose `outputNode` (non-audio-element backend)
	 *  - any access throws
	 */
	private resolveBackendOutputNode(ctx: AudioContext): AudioNode | null {
		try {
			const backend = this.player.backend?.();
			if (backend?.outputNode && typeof backend.outputNode === 'function') {
				return backend.outputNode(ctx);
			}
			return null;
		}
		catch {
			return null;
		}
	}

	/**
	 * Best-effort lookup of the backend's pre-volume analysis node.
	 *
	 * When the backend exposes `analysisNode(ctx)`, returns the raw audio source
	 * node BEFORE the volume GainNode. AudioGraphPlugin taps the AnalyserNode
	 * there so spectrum/FFT magnitudes are volume-independent.
	 *
	 * Returns `null` when:
	 *  - the backend doesn't implement `analysisNode` (AudioElementBackend, mocks)
	 *  - the player has no backend (test environments)
	 *  - any access throws
	 */
	private resolveBackendAnalysisNode(ctx: AudioContext): AudioNode | null {
		try {
			const backend = this.player.backend?.();
			if (backend && 'analysisNode' in backend && typeof (backend as { analysisNode: unknown }).analysisNode === 'function') {
				return (backend as { analysisNode: (audioContext: AudioContext) => AudioNode }).analysisNode(ctx);
			}
			return null;
		}
		catch {
			return null;
		}
	}

	/**
	 * Reconnect the entire chain in canonical order:
	 *  source → preEffects[0..n] → postEffects[0..n] → destination
	 *
	 * Disconnects every node first so the chain is rebuilt cleanly. The shared
	 * analyser tap (if present) is reattached parallel to the source.
	 */
	private rebuildChain(): void {
		if (!this.source || !this.destination)
			return;

		// Disconnect every owned node from any prior wiring.
		this.disconnectSafe(this.source);
		for (const n of this.preEffects) this.disconnectSafe(n);
		for (const n of this.postEffects) this.disconnectSafe(n);

		const chain: AudioNode[] = [this.source, ...this.preEffects, ...this.postEffects];
		for (let i = 0; i < chain.length - 1; i++) {
			try {
				chain[i]!.connect(chain[i + 1]!);
			}
			catch { /* swallow — happy-dom mocks may not implement connect */ }
		}
		try {
			chain[chain.length - 1]!.connect(this.destination);
		}
		catch { /* swallow */ }

		// Reattach analyser tap from the pre-volume analysis source (not this.source
		// which is the volume GainNode). This keeps FFT magnitudes volume-independent.
		// Falls back to this.source for backends without a dedicated pre-volume tap.
		if (this.analyser) {
			const tapNode = this._analysisSource ?? this.source;
			if (tapNode) {
				try {
					tapNode.connect(this.analyser);
				}
				catch { /* swallow */ }
			}
		}

		// Reapply manual routes.
		for (const [from, to] of this.routes) {
			try {
				from.connect(to);
			}
			catch { /* swallow */ }
		}

		this.emit('chain:rebuilt');
	}

	private disconnectSafe(node: AudioNode): void {
		try {
			node.disconnect();
		}
		catch { /* swallow */ }
	}

	private tearDownGraph(): void {
		// Disconnect the analysis source tap when it differs from this.source
		// (i.e. it's the pre-volume raw source node from the backend). The raw
		// source node itself is owned by the backend — we must NOT call disconnect()
		// on it globally, only disconnect the analyser connection from it.
		if (this.analyser && this._analysisSource && this._analysisSource !== this.source) {
			try {
				this._analysisSource.disconnect(this.analyser);
			}
			catch { /* swallow */ }
		}

		for (const node of [this.source, this.analyser, ...this.preEffects, ...this.postEffects]) {
			if (!node)
				continue;
			this.disconnectSafe(node);
		}
		this.preEffects = [];
		this.postEffects = [];
		this.routes = [];
		this.analyser = null;
		this._analysisSource = null;
		this.source = null;
		this.destination = null;

		const ctx = this.ctx;
		if (ctx) {
			try {
				if (ctx.state !== 'closed' && typeof ctx.close === 'function') {
					void ctx.close();
				}
			}
			catch { /* swallow */ }
			this.emit('context:closed');
		}

		// Clear the player-level reference so the next `use()` starts clean.
		if (this.player.audioContext?.() === ctx) {
			setPlayerAudioContext(this.player, undefined);
		}
		this.ctx = null;
	}
}

/** Plugin alias for {@link AudioGraphPlugin}. Pass to `addPlugin(audioGraphPlugin)`. */
export const audioGraphPlugin = AudioGraphPlugin;
