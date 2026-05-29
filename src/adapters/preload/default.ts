/**
 * Preload + transition strategy interfaces and default implementations.
 *
 * The `IPreloadStrategy` interface drives **when** and **what** to prefetch before the
 * outgoing item ends. The `ITransitionStrategy` interface drives **how** the boundary
 * between outgoing and incoming items is handled — crossfade, hard-cut, gapless, etc.
 *
 * Both are swappable per-player-instance via `BasePlayerConfig` injection, so
 * consumers can override the default behaviour without subclassing the player.
 *
 * Design choices:
 *  - Both interfaces are stateless. Each method receives a full `PreloadContext` /
 *    `TransitionContext` snapshot so callers never reach into private player state.
 *  - Default implementations carry the music-validated values (10 s preload, 3 s
 *    crossfade lead, 3 s tail). Video overrides the defaults in its own player class.
 *  - The `ITransitionBackend` interface is the minimal dual-playback surface. Both
 *    `IAudioBackend` and (in future) `IVideoBackend` can implement it. The transition
 *    engine only requires this surface — not the full backend contract — so it works
 *    across both media types without importing per-library backend types.
 */

import type { BasePlaylistItem } from '../../types';

// ─── Shared context snapshots ────────────────────────────────────────────────

/** Snapshot passed to every `IPreloadStrategy` method. */
export interface PreloadContext {
	/** Current playback position in seconds. */
	readonly currentTime: number;
	/** Total duration of the outgoing item in seconds. `0` when not yet known. */
	readonly duration: number;
	/** The next item in the queue, or `null` when the queue is exhausted. */
	readonly nextItem: BasePlaylistItem | null;
}

/** Snapshot passed to every `ITransitionStrategy` method. */
export interface TransitionContext {
	/** Current playback position of the outgoing item in seconds. */
	readonly currentTime: number;
	/** Total duration of the outgoing item in seconds. */
	readonly duration: number;
	/** The outgoing playlist item. */
	readonly outgoingItem: BasePlaylistItem;
	/** The incoming playlist item. */
	readonly incomingItem: BasePlaylistItem;
	/** Fractional progress through the transition window [0, 1]. */
	readonly fraction: number;
}

// ─── Asset descriptor ────────────────────────────────────────────────────────

/**
 * Describes a single asset to prefetch before the transition fires.
 *
 * `category` mirrors `UrlCategory` from the kit's type system so the player's
 * auth-aware fetch pipeline handles each asset correctly. Categories not listed
 * here pass through as-is via the player's default resolver.
 */
export interface PreloadAsset {
	/** Resolved URL to fetch. The player's `auth` pipeline is applied automatically. */
	url: string;
	/**
	 * Asset category hint. Drives the `urlResolver` and determines which `Request`
	 * headers the auth pipeline attaches. Common values:
	 *  - `'media'`    — main playable URL (HLS manifest or audio source)
	 *  - `'poster'`   — cover art / thumbnail image
	 *  - `'subtitle'` — subtitle / caption sidecar
	 *  - `'sprite'`   — sprite-VTT preview thumbnail strip
	 *  - `'lyrics'`   — lyrics / LRC sidecar
	 */
	category: 'media' | 'poster' | 'subtitle' | 'sprite' | 'lyrics' | (string & {});
	/**
	 * Preload mode forwarded to the browser. `'metadata'` fetches only headers
	 * (suitable for manifests + sidecars); `'auto'` requests the entire resource
	 * (suitable for small images, short audio intros). Default `'metadata'`.
	 */
	mode?: 'metadata' | 'auto';
}

// ─── IPreloadStrategy interface ──────────────────────────────────────────────

/**
 * Controls when and what to preload for the next queue item.
 *
 * Consumers inject a custom implementation via `BasePlayerConfig.preloadStrategy`
 * or call `setPreloadStrategy(strategy)` at runtime. The default implementation
 * (`DefaultPreloadStrategy`) fires at `duration - preloadLeadSeconds` and returns
 * a generic asset list. Music and video players compose domain-specific lists on
 * top by providing their own `assetsToPreload` implementations.
 */
export interface IPreloadStrategy {
	/**
	 * Return `true` when the player should begin prefetching assets for the next
	 * item. Called on every `time` event while a next item is queued.
	 *
	 * Idempotency: the player suppresses repeated calls after the first `true` return
	 * until the cursor moves to a new item.
	 */
	shouldPreload(context: PreloadContext): boolean;

	/**
	 * Return the ordered list of assets to prefetch for `item`. Called once when
	 * `shouldPreload` returns `true`. Return an empty array to suppress prefetch
	 * while still triggering the preload lifecycle events.
	 */
	assetsToPreload(item: BasePlaylistItem): PreloadAsset[];

	/**
	 * Abort any in-flight prefetch initiated by this strategy. The player calls
	 * this when the cursor jumps (shuffle, manual `current()` call, explicit
	 * `next()` before the natural end).
	 */
	cancel(): void;
}

// ─── ITransitionStrategy interface ───────────────────────────────────────────

/**
 * Backend surface required for overlap transitions (crossfade).
 *
 * Both `IAudioBackend` (music) and any future dual-capable `IVideoBackend`
 * must implement this surface to participate in crossfade transitions.
 *
 * The transition engine only requires these five methods — not the full backend
 * contract — so the interface stays small and backend-agnostic.
 */
export interface ITransitionBackend {
	/** `true` when this backend can host a secondary parallel-playback slot. */
	supportsCrossfade(): boolean;

	/** Load `url` into the secondary slot without affecting primary playback. */
	loadSecondary(url: string): Promise<void>;

	/** Prime the secondary (seek + wait for canplay) at `seekMs` (default 0). */
	primeSecondary(seekMs?: number): Promise<void>;

	/**
	 * Execute the transition: ramp primary to silence + secondary to full volume
	 * over `durationMs`. On completion the secondary becomes primary.
	 */
	crossfade(durationMs: number): Promise<void>;

	/** Release secondary slot resources. Idempotent. */
	disposeSecondary(): void;

	/** Read the current gain on the secondary slot [0..1]. */
	secondaryGain(): number;

	/** Write the gain on the secondary slot. Clamped to [0..1]. */
	secondaryGain(value: number): void;
}

/**
 * Controls how the player transitions from the outgoing item to the incoming item.
 *
 * Consumers inject a custom implementation via `BasePlayerConfig.transitionStrategy`
 * or call `setTransitionStrategy(strategy)` at runtime. Two built-in implementations
 * are shipped:
 *
 *  - `CrossfadeTransitionStrategy` (default for music) — linear or equal-power
 *    volume fade over `leadSeconds + tailSeconds`.
 *  - `GaplessTransitionStrategy` (default for video) — hard-cut at natural end;
 *    the incoming item is already preloaded so buffering is minimal.
 */
export interface ITransitionStrategy {
	/**
	 * Return `true` when the player should begin the transition. Called on every
	 * `time` event after preloading is complete and the incoming backend is ready.
	 *
	 * Idempotency: the player suppresses repeated calls after the first `true` return
	 * until `complete()` or `cancel()` is called.
	 */
	shouldTransition(context: PreloadContext): boolean;

	/**
	 * Called by the player each animation frame during the transition window.
	 * Apply volume ramps, crossfade curves, or any per-frame effect here.
	 *
	 * The player calls this between `start()` and `complete()` at the rate of
	 * `requestAnimationFrame` — keep it fast and non-blocking.
	 */
	tick(context: TransitionContext, backend: ITransitionBackend | null): void;

	/**
	 * Invoked once when the transition begins (first `shouldTransition` → `true`).
	 * Use this to emit plugin events, start the incoming backend, or acquire
	 * any resources needed during the transition window.
	 */
	start(outgoing: BasePlaylistItem, incoming: BasePlaylistItem, backend: ITransitionBackend | null): void;

	/**
	 * Invoked once when the transition is complete (the incoming item is the new
	 * primary and the outgoing item is fully disposed). Clean up any resources
	 * acquired in `start()`.
	 */
	complete(from: BasePlaylistItem, to: BasePlaylistItem): void;

	/**
	 * Invoked when the transition is aborted before it could complete — e.g. the
	 * user called `next()` manually or the player was disposed. Release resources
	 * and reset internal state.
	 */
	cancel(reason: string): void;
}

// ─── Default PreloadStrategy ─────────────────────────────────────────────────

/**
 * Default preload strategy: trigger at `duration - leadSeconds`. Returns no
 * assets by default — each player library subclass or per-item resolver
 * provides the domain-specific asset list.
 *
 * Custom strategies extend this class and override `assetsToPreload`.
 */
export class DefaultPreloadStrategy implements IPreloadStrategy {
	private _abortController: AbortController | null = null;

	constructor(private readonly _leadSeconds: number = 10) {}

	shouldPreload(context: PreloadContext): boolean {
		const { currentTime, duration, nextItem } = context;

		if (nextItem === null)
			return false;
		if (duration <= 0)
			return false;

		return currentTime >= duration - this._leadSeconds;
	}

	assetsToPreload(_item: BasePlaylistItem): PreloadAsset[] {
		return [];
	}

	cancel(): void {
		this._abortController?.abort();
		this._abortController = null;
	}
}

// ─── CrossfadeTransitionStrategy ─────────────────────────────────────────────

/**
 * Crossfade transition: outgoing fades to silence while incoming fades in over
 * the overlap window (`leadSeconds` before end + `tailSeconds` after incoming start).
 *
 * This is the default for music. Video uses `GaplessTransitionStrategy` by default
 * but can opt in to audio crossfade by configuring this strategy explicitly.
 *
 * Volume curves:
 *  - `'linear'`       — simple linear ramp (equal to v1 behaviour).
 *  - `'equal-power'`  — cosine-based constant-power fade (perceptually smoother).
 */
export class CrossfadeTransitionStrategy implements ITransitionStrategy {
	private readonly _leadSeconds: number;
	private readonly _tailSeconds: number;
	private readonly _curve: 'linear' | 'equal-power';

	constructor(opts: { leadSeconds?: number; tailSeconds?: number; curve?: 'linear' | 'equal-power' } = {}) {
		this._leadSeconds = opts.leadSeconds ?? 3;
		this._tailSeconds = opts.tailSeconds ?? 3;
		this._curve = opts.curve ?? 'equal-power';
	}

	shouldTransition(context: PreloadContext): boolean {
		const { currentTime, duration, nextItem } = context;

		if (nextItem === null)
			return false;
		if (duration <= 0)
			return false;

		return currentTime >= duration - this._leadSeconds;
	}

	tick(context: TransitionContext, backend: ITransitionBackend | null): void {
		if (backend === null)
			return;
		if (!backend.supportsCrossfade())
			return;

		const { fraction } = context;
		const outGain = this._applyGainCurve(1 - fraction);
		const inGain = this._applyGainCurve(fraction);

		backend.secondaryGain(inGain);

		// Primary gain is controlled through the crossfade call, not directly here.
		// The `tick` is informational — actual ramp is handled by `backend.crossfade()`.
		void outGain;
	}

	start(outgoing: BasePlaylistItem, incoming: BasePlaylistItem, _backend: ITransitionBackend | null): void {
		void outgoing;
		void incoming;
	}

	complete(_from: BasePlaylistItem, _to: BasePlaylistItem): void {}

	cancel(_reason: string): void {}

	private _applyGainCurve(linear: number): number {
		const clamped = Math.max(0, Math.min(1, linear));
		if (this._curve === 'equal-power') {
			return Math.cos((1 - clamped) * 0.5 * Math.PI);
		}
		return clamped;
	}
}

// ─── GaplessTransitionStrategy ───────────────────────────────────────────────

/**
 * Gapless transition: hard-cut at natural end. No audio overlap. The incoming
 * item's assets are already warm from preloading so buffering is near-zero.
 *
 * This is the default for video. Audio crossfade on video is technically possible
 * (duck outgoing audio + raise incoming audio) but requires two active `<video>`
 * elements, which browsers handle inconsistently. Use `CrossfadeTransitionStrategy`
 * explicitly on a video player if you want audio overlap.
 */
export class GaplessTransitionStrategy implements ITransitionStrategy {
	shouldTransition(_context: PreloadContext): boolean {
		return false;
	}

	tick(_context: TransitionContext, _backend: ITransitionBackend | null): void {}

	start(_outgoing: BasePlaylistItem, _incoming: BasePlaylistItem, _backend: ITransitionBackend | null): void {}

	complete(_from: BasePlaylistItem, _to: BasePlaylistItem): void {}

	cancel(_reason: string): void {}
}
