import type { BaseEventMap, IPlayer } from '../types';
import { BrowserPolicyError, PluginError } from '../errors';
import { setPlayerAudioContext } from '../base-player';
import { Plugin } from '../plugin';

/** Options for {@link AudioGraphPlugin}. */
export interface AudioGraphOptions {
	/** Initial latency hint passed to `new AudioContext({ latencyHint })`. Default `'playback'`. */
	latencyHint?: AudioContextLatencyCategory;
	/** Default analyser FFT size used by `getAnalyserSource()` consumers. Default `2048`. */
	fftSize?: 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384;
	/** Default analyser smoothing 0..1. Default `0.8`. */
	smoothing?: number;
}

/** Events emitted by {@link AudioGraphPlugin}. */
export interface AudioGraphEvents {
	'context:ready': { sampleRate: number };
	'context:closed': void;
	'chain:rebuilt': void;
	'unsupported': { reason: string };
}

/** Resolve a global AudioContext constructor across browsers. Returns `undefined` if unsupported. */
function resolveAudioContextCtor(): (new (opts?: AudioContextOptions) => AudioContext) | undefined {
	const g = globalThis as unknown as {
		AudioContext?: new (opts?: AudioContextOptions) => AudioContext;
		webkitAudioContext?: new (opts?: AudioContextOptions) => AudioContext;
	};
	return g.AudioContext ?? g.webkitAudioContext;
}

/**
 * Foundation plugin for the Web Audio signal chain. Strictly opt-in.
 *
 * On `use()`:
 *  - lazily creates the player's `AudioContext`
 *  - wires the active backend's media element into a `MediaElementSourceNode`
 *    (when a backend is available)
 *  - connects source → destination as the baseline chain
 *  - exposes hooks for downstream audio-graph plugins
 */
export class AudioGraphPlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, AudioGraphOptions, AudioGraphEvents> {
	static override readonly id: string = 'audio-graph';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'AudioContext + signal chain owner — opt-in foundation for every Web Audio plugin';

	private ctx: AudioContext | null = null;
	private source: AudioNode | null = null;
	private destination: AudioNode | null = null;
	private analyser: AnalyserNode | null = null;
	/** Insertion-ordered effect chains. `pre` sits between source and post; `post` sits between pre and destination. */
	private preEffects: AudioNode[] = [];
	private postEffects: AudioNode[] = [];
	/** Manual route map — pairs created via `route()` so we can disconnect on dispose. */
	private routes: Array<[AudioNode, AudioNode]> = [];

	/** Creates the AudioContext, mounts the media element source, and wires the baseline chain. */
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

		// Reuse an existing player-owned context when present.
		const existing = this.player.audioContext?.();
		const ctx = existing ?? this.createContext();

		// Write the context back onto the player so other plugins / accessors see it.
		setPlayerAudioContext(this.player, ctx);
		this.ctx = ctx;

		// Source: try the active backend's mediaElement, else use a silent
		// placeholder gain node (lets effects-only chains work in tests).
		const element = this.resolveMediaElement();
		this.source = element
			? this.mountSource(ctx, element)
			: ctx.createGain();
		this.destination = ctx.destination;

		this.rebuildChain();

		this.lifecycle.addCleanup(() => this.tearDownGraph());

		this.emit('context:ready', { sampleRate: ctx.sampleRate });
	}

	/** Disconnects all graph nodes, closes the AudioContext, and clears internal state. */
	override dispose(): void {
		this.tearDownGraph();
	}

	/** Player-owned `AudioContext`. Lazily created on first call. */
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

	/** The current head of the chain (the last node before destination). */
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

	/** A shared `AnalyserNode` tap inserted at the head of the chain. */
	analyserSource(): AnalyserNode {
		if (this.analyser)
			return this.analyser;
		const ctx = this.context();
		const analyser = ctx.createAnalyser();
		analyser.fftSize = this.opts?.fftSize ?? 2048;
		analyser.smoothingTimeConstant = this.opts?.smoothing ?? 0.8;
		this.analyser = analyser;
		// Tap the analyser parallel to the chain — connect source → analyser
		// so the analyser sees signal but isn't part of the destination path.
		if (this.source) {
			try {
				this.source.connect(analyser);
			}
			catch { /* already connected — ignore */ }
		}
		return analyser;
	}

	/**
	 * Insert an effect node into the chain. Returns the inserted node so the
	 * caller can disconnect it later. Tracked so dispose tears them down.
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

	/** Remove a previously inserted effect node. Idempotent. */
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

	/** Convenience for `insertEffect(node, 'pre')`. */
	pre(node: AudioNode): AudioNode {
		return this.insertEffect(node, 'pre');
	}

	/** Convenience for `insertEffect(node, 'post')`. */
	post(node: AudioNode): AudioNode {
		return this.insertEffect(node, 'post');
	}

	/** Manual node connection for advanced graphs. Tracked for dispose. */
	route(from: AudioNode, to: AudioNode): void {
		try {
			from.connect(to);
		}
		catch { /* swallow — duplicate connect is idempotent in spec but throws on some engines */ }
		this.routes.push([from, to]);
	}

	/** Tear down a manual connection set up via `route()`. */
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
		const player = this.player as unknown as {
			backend?: () => { mediaElement?: () => HTMLMediaElement | null | undefined } | null | undefined;
		};
		try {
			const backend = player.backend?.();
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
		const player = this.player as unknown as {
			backend?: () => { outputNode?: (ctx: AudioContext) => AudioNode } | null | undefined;
		};
		try {
			const backend = player.backend?.();
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

		// Reattach analyser tap (parallel from source) if present.
		if (this.analyser) {
			try {
				this.source.connect(this.analyser);
			}
			catch { /* swallow */ }
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
		for (const node of [this.source, this.analyser, ...this.preEffects, ...this.postEffects]) {
			if (!node)
				continue;
			this.disconnectSafe(node);
		}
		this.preEffects = [];
		this.postEffects = [];
		this.routes = [];
		this.analyser = null;
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
