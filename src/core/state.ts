// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { EventEmitter } from '../adapters/event-bus/default';
import type { ILogger } from '../adapters/logger/ILogger';
import type { IPlatform } from '../adapters/platform/browser';
import type { ITransitionStrategy } from '../adapters/preload/default';
import type {
	ActionOptions,
	BaseEventMap,
	BasePlayerConfig,
	BasePlaylistItem,
	Chapter,
	CurrentAudioTrackSelection,
	CurrentQualitySelection,
	CurrentSubtitleSelection,
	LoadOptions,
	PlayerPhase,
	PluginCtorWithId,
	ResolvedUrl,
	Translations,
	UrlCategory,
} from '../types';
import type { BeforeDispatchOutcome } from './dispatch';
import type { AbrState } from './mixins/abr';
import type { AudioOutputState } from './mixins/audio-output';
import type { AuthState } from './mixins/auth';
import type { BaseUrlAudioContextState } from './mixins/base-url-audio-context';
import type { CastMixinState } from './mixins/cast';
import type { CueParserState } from './mixins/cue-parser';
import type { ExperimentalState } from './mixins/experimental';
import type { I18nState } from './mixins/i18n';
import type { MediaTracksState, SidecarSubtitleContext } from './mixins/media-tracks';
import type { MetricsState } from './mixins/metrics';
import type { BackendShape, PlayerPhaseState } from './mixins/player-state';
import type { PluginRegistrationState } from './mixins/plugin-registration';
import type { PreloadStrategyState } from './mixins/preload-strategy-mixin';
import type { QueueState } from './mixins/queue';
import type { StateMutatorsState } from './mixins/state-mutators';
import type { StreamRegistrationState } from './mixins/stream-registration';
import type { TimeInternalState } from './mixins/time';
import type { TransportState } from './mixins/transport';
import type { VolumeMixinState } from './mixins/volume';
import type { TokenRegistry } from './title-tokens';
import { CueParserRegistry } from '../adapters/cue-parser/registry';
import { MediaList } from '../adapters/media-list/default';
import { DefaultPreloadStrategy } from '../adapters/preload/default';
import {
	AudioTrackState,
	PlayState,
	QualityState,
	VolumeState,
} from '../types';
import { RepeatState, ShuffleState } from './mixins/state-mutators';

// ──────────────────────────────────────────────────────────────────────────
// Re-exported state slices + tokens
//
// Each `<Mixin>State` slice is declared in its owning mixin file (beside the
// methods that write it) and re-exported here so consumers importing from
// `../state` keep working. The resulting type-only state↔mixin import cycle is
// erased at runtime.
// ──────────────────────────────────────────────────────────────────────────

export type { SidecarSubtitleContext };
export {
	PlayState,
	RepeatState,
	ShuffleState,
	VolumeState,
};

// ──────────────────────────────────────────────────────────────────────────
// PlayerCoreState — the shared internal field surface
// ──────────────────────────────────────────────────────────────────────────

/**
 * Every internal field shared by `NMMusicPlayer`, `NMVideoPlayer`, and the
 * kit's mixin layer. This is NOT the public player API — it is the internal
 * "this" shape that mixins write against.
 *
 * Fields use the `_field` convention so that TypeScript surfaces them as
 * internal and linters can flag direct access outside the kit. The underscore
 * is structural, not cosmetic — do not rename.
 *
 * Generics let per-library subclasses narrow `T` (their playlist item type),
 * `C` (their config), and `E` (their event map) while still accepting kit
 * mixins that operate on the base forms.
 */
export interface PlayerCoreState<T extends BasePlaylistItem = BasePlaylistItem, C extends BasePlayerConfig = BasePlayerConfig, E extends BaseEventMap = BaseEventMap> extends
	EventEmitter<E>,
	VolumeMixinState,
	TransportState,
	TimeInternalState,
	StateMutatorsState,
	QueueState<T>,
	BaseUrlAudioContextState,
	AuthState,
	CastMixinState,
	AbrState,
	AudioOutputState,
	PlayerPhaseState,
	PreloadStrategyState,
	StreamRegistrationState,
	CueParserState,
	I18nState,
	MetricsState,
	ExperimentalState,
	PluginRegistrationState,
	MediaTracksState {

	// ── Identity ─────────────────────────────────────────────────────────────

	/** CSS class name stamped onto the container element during `setup()`. Per-library players set this. */
	className: string;

	/** Unique DOM id for the player instance. Derived from config or auto-generated. Read by plugins that need a stable selector. */
	playerId: string;

	/** Root `HTMLElement` passed into the constructor. Plugins mount their own DOM inside this element. */
	container: HTMLElement;

	/** Full resolved config object. Written once in the constructor; plugins read via `player.options`. */
	options: C;

	// ── Lifecycle ────────────────────────────────────────────────────────────

	/**
	 * Re-entrancy guard for the `before*` dispatch pipeline. Each in-flight
	 * `_dispatchBefore` call pushes its event name; the inner-most async
	 * continuation pops it. Kit code checks this to detect nested dispatches
	 * that would otherwise produce undefined ordering.
	 */
	_dispatchStack: string[];

	/** `true` once `setup()` has been called. Guards against double-initialisation. */
	_setupCalled: boolean;

	/**
	 * Promise that resolves when `setup()` completes. Callers that need to
	 * await player readiness hold a reference to this. `_readyResolve` and
	 * `_readyReject` are stored so the setup flow can settle it from a
	 * different async context.
	 */
	_readyPromise?: Promise<void>;
	_readyResolve?: () => void;
	_readyReject?: (err: unknown) => void;

	// ── Time / duration (backend-written) ─────────────────────────────────────

	/**
	 * Last-known total duration in seconds. Written by the backend when it
	 * resolves the media duration; `0` until then. Read by `duration()`. No
	 * single kit mixin writes this, so it stays central.
	 */
	_internalDuration: number;

	/**
	 * One-shot latch that prevents `itemEndingSoon` from firing more than once
	 * per item. Set to `true` when the event fires; reset to `false` whenever
	 * the cursor changes or a new item begins loading.
	 */
	_itemEndingSoonEmitted: boolean;

	// ── Track selection mode (co-written by player-state + media-tracks) ───────

	/** Quality selection mode. Written by `qualityMode(target)` and `quality(idx)`. Defaults to `QualityState.AUTO`. */
	_qualityState: QualityState;

	/** Audio track selection mode. Written by `audioTrackMode(idx)` and `audioTrack(idx)`. Defaults to `AudioTrackState.DEFAULT`. */
	_audioTrackState: AudioTrackState;

	// ── Platform ──────────────────────────────────────────────────────────────

	/**
	 * Resolved platform bundle. Populated in setup() from `options.platform`
	 * (default `browserPlatform`). Plugins read via `player.platform()`.
	 */
	_platform: IPlatform | undefined;

	// ── Policy hooks ──────────────────────────────────────────────────────────

	/**
	 * Cleanup callbacks for visibility/network/wakeLock subscriptions wired
	 * during setup(). All run on dispose() so policy hooks never leak.
	 */
	_policyCleanup: Array<() => void>;

	// ── Bandwidth / ABR (backend-written) ─────────────────────────────────────

	/** Last-known bandwidth estimate (bps). Updated by the active stream source. */
	_bandwidthEstimate: number;

	// ── Metrics timing (setup-orchestrator-written) ───────────────────────────

	/** Wall-clock timestamp captured in `setup()` — used to compute `sessionDurationMs`. */
	_metricsStartedAt: number;

	/** Periodic emit handle for `playback:metrics`. Cleared via `_policyCleanup` on dispose. */
	_metricsTimer: ReturnType<typeof setInterval> | undefined;

	/**
	 * Wall-clock timestamp of the last `progress` event emit. Used by the
	 * `progressIntervalMs` throttle inside `setup()`. Initialised to 0 so the
	 * first `time` event always fires `progress` (avoids a silent first-interval
	 * gap on short clips).
	 */
	_lastProgressEmit: number;

	// ── Load epoch ────────────────────────────────────────────────────────────

	/** Monotonic counter bumped on each `load()` call; stale continuations bail when epoch mismatches. Bumped by both `loadingMethods` and `queueMethods`. */
	_loadEpoch?: number;

	/**
	 * Per-instance title-token registry. Maps a single letter (e.g. `'S'`, `'E'`)
	 * to the translation key that resolves the token's display text. Empty by
	 * default — core ships no tokens. Per-library players call
	 * `registerTitleTokens()` to populate it. An empty registry makes the ingest
	 * step a guaranteed no-op (zero cost for music player or any consumer that
	 * never registers tokens).
	 */
	_titleTokenRegistry: TokenRegistry;

	/** Root logger built from `options.logger` / `options.logLevel` at setup. Written by `_wireLogger`; core failures and (at debug+) the event firehose log through it. */
	_logger?: ILogger;

	// ── Preload epoch + transition RAF (setup-orchestrator-written) ────────────

	/** RAF handle for the per-frame transition ticker. `undefined` when no transition is in progress. Written by the orchestrator and the strategy swapper. */
	_transitionRafHandle: number | undefined;

	/** Monotonically increasing epoch. Bumped whenever the cursor changes. Stale RAF callbacks bail when epoch differs. */
	_preloadEpoch: number;
}

// ──────────────────────────────────────────────────────────────────────────
// MixinSurface — cross-mixin method declarations
// ──────────────────────────────────────────────────────────────────────────

/**
 * Cross-mixin method surface. Every method that one mixin calls on `this`
 * but that lives on a *different* mixin is declared here so we can write
 * `this.play()` inside `lifecycleMethods` without resorting to `as any`.
 *
 * The methods are composed onto the prototype at runtime via `composeMixins`;
 * TypeScript cannot infer this, so we declare the surface explicitly and
 * intersect it into `Internals`.
 *
 * Section headers below mirror the mixin file that owns each cluster. For
 * full docstrings see the corresponding mixin file.
 */
export interface MixinSurface {

	// playerStateMethods (see mixins/player-state.ts) — backend access + phase + guards + mode reads
	qualityMode(): QualityState;
	qualityMode(target: number | 'auto'): void;
	audioTrackMode(): AudioTrackState;
	audioTrackMode(idx: number): void;
	_transitionPhase(next: PlayerPhase): void;
	_resolveBackend(): BackendShape | undefined;
	_peekBackend(): unknown;
	_peekBackendTyped<S extends object>(): S | undefined;
	_assertReady(): void;
	_dispatchBefore<TData>(beforeEvent: string, data: TData): Promise<BeforeDispatchOutcome<TData>>;

	// authMethods (see mixins/auth.ts) — full URL resolution pipeline
	resolveUrl(url: string, category?: UrlCategory): Promise<ResolvedUrl>;

	// mediaTracksMethods (see mixins/media-tracks.ts) — sidecar + chapter helpers
	_disposeSidecarSubtitle(): void;
	resolveItemTrackUrls<T extends BasePlaylistItem>(item: T): Promise<T>;
	_resolveAndEmitChapters(itemId: string | number | undefined): Promise<void>;

	/**
	 * Package-supplied playlist-item normalizer. Player classes override this
	 * to accept their legacy / server wire format gracefully; the queue runs
	 * it on every item BEFORE the consumer's `transformPlaylistItem` config
	 * callback. Synchronous and idempotent — canonical items pass through
	 * unchanged.
	 */
	normalizePlaylistItem?: (item: BasePlaylistItem) => BasePlaylistItem;

	// stateMutatorsMethods (see mixins/state-mutators.ts) — mutation guard
	_emitBeforeMutation(method: string, args: ReadonlyArray<unknown>): boolean;

	// pluginRegistrationMethods (see mixins/plugin-registration.ts) — lang loaded tracking
	_pluginLangLoadedSet(): Set<string> | undefined;
	_markPluginLangLoaded(pluginId: string, lang: string): void;
	_registerPlugin(ctor: PluginCtorWithId, opts: unknown, timeoutMs: number): Promise<void>;

	// transportMethods (see mixins/transport.ts)
	_seekingTransition(doSeek: () => void): void;
	play(opts?: ActionOptions): Promise<void>;
	pause(opts?: ActionOptions): Promise<void>;

	// volumeMethods (see mixins/volume.ts)
	mute(): Promise<void>;
	unmute(): Promise<void>;
	volume(level?: number): number | Promise<void>;
	_applyVolume(level: number): void;

	// timeMethods (see mixins/time.ts)
	time(): number;
	time(seconds: number, opts?: ActionOptions): Promise<void>;
	duration(): number;
	buffered(): number;
	seekByPercentage(pct: number, opts?: ActionOptions): void;

	// queueMethods (see mixins/queue.ts)
	queue(items?: BasePlaylistItem[], opts?: ActionOptions): ReadonlyArray<BasePlaylistItem> | void;
	queueLength(): number;
	index(): number;
	seekToIndex(position: number, opts?: ActionOptions): void;
	next(opts?: LoadOptions): Promise<void>;

	// loadingMethods — per-library mixin; kit transport methods call it cross-mixin
	load(item: BasePlaylistItem, opts?: LoadOptions): Promise<void>;

	// mediaTracksMethods (see mixins/media-tracks.ts)
	chapters(): ReadonlyArray<Chapter>;
	seekToChapter(idx: number, opts?: ActionOptions): void;
	item(target?: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean), opts?: LoadOptions): BasePlaylistItem | undefined | void;
	subtitle(): CurrentSubtitleSelection | null;
	subtitle(idx: number | null): Promise<void>;
	audioTrack(): CurrentAudioTrackSelection | null;
	audioTrack(idx: number): Promise<void>;
	quality(): CurrentQualitySelection | 'auto';
	quality(idx: number | 'auto'): void;
	chapter(): Chapter | null;
	chapter(idx: number): void;

	// audioOutputMethods (see mixins/audio-output.ts)
	audioOutput(): Promise<string | null>;
	audioOutput(deviceId: string): Promise<void>;

	// pluginRegistrationMethods (see mixins/plugin-registration.ts)
	removePluginById(id: string, opts?: { cascade?: boolean }): void;

	// i18nMethods (see mixins/i18n.ts)
	addTranslations(bundle: Translations): void;
	removeTranslations(prefix: string, lang?: string): void;

	// playerCoreMethods (see mixins/player-core.ts) — runtime platform resolution
	platform(): IPlatform;

	// i18nMethods — language() lives in i18nMethods mixin, called cross-mixin
	language(lang?: string): string | Promise<void>;

	/**
	 * Merge additional letter→key pairs into this player's title-token registry.
	 * Called once per player instance by per-library players that need token
	 * resolution (e.g. video registers `{ S, E }`). Safe to call multiple times —
	 * later calls merge into the existing registry without clearing it.
	 */
	registerTitleTokens(tokens: Record<string, string>): void;

	// Per-library backend accessor. Optional — kit mixins probe its presence defensively.
	backend?(): unknown;

	// Per-library video element. Optional — only NMVideoPlayer carries it; kit reads defensively.
	videoElement?: HTMLMediaElement & { webkitShowPlaybackTargetPicker?: () => void; remote?: { prompt: () => Promise<void> }; setSinkId?: (id: string) => Promise<void>; sinkId?: string };

	// dispatch helpers exposed by lifecycleMethods
	listenersOf?(event: string): ReadonlyArray<(data: unknown) => void>;
	pushDispatch?(name: string): void;
	popDispatch?(): string | undefined;

	// lifecycleMethods (see mixins/lifecycle.ts) — setup completion promise
	ready(): Promise<void>;
}

/**
 * Full internal "this" type used inside every kit mixin. The intersection of
 * `PlayerCoreState` (fields) and `MixinSurface` (cross-mixin methods) gives
 * TypeScript enough information to type-check `this.play()`, `this._phase`,
 * etc. inside a mixin body without any casts.
 */
export type Internals = PlayerCoreState<BasePlaylistItem, BasePlayerConfig, BaseEventMap> & MixinSurface;

// ──────────────────────────────────────────────────────────────────────────
// State initialiser
// ──────────────────────────────────────────────────────────────────────────

/**
 * No-op transition strategy used as the initial `_transitionStrategy` default.
 * Per-library players overwrite this in their constructor after `initPlayerCoreState`
 * runs (music uses `CrossfadeTransitionStrategy`, video uses `GaplessTransitionStrategy`).
 */
const _NOOP_TRANSITION: ITransitionStrategy = {
	shouldTransition: () => false,
	tick: () => {},
	start: () => {},
	complete: () => {},
	cancel: () => {},
};

/**
 * Seeds every internal slot on `player` to its canonical starting value.
 *
 * Called from the player constructor before `setup()` runs, so mixins and
 * plugins always see a fully-initialised state object — no `undefined` field
 * surprises on first access. The `className` seed comes from `opts` because
 * it differs between `NMMusicPlayer` and `NMVideoPlayer`.
 *
 * The function accepts `object` and casts internally so callers don't need
 * to import `Internals` — it is a kit-private type.
 */
export function initPlayerCoreState(player: object, opts: { className: string }): void {
	const target = player as Internals;
	target.className = opts.className;
	target._phase = 'idle';
	target._dispatchStack = [];
	target._setupCalled = false;
	target._baseUrl = undefined;
	target._audioContext = undefined;
	target._translator = undefined;
	target._cueParsers = new CueParserRegistry();
	target._overrides = new Map();
	target._playState = PlayState.IDLE;
	target._volumeState = VolumeState.UNMUTED;
	target._repeatState = RepeatState.OFF;
	target._shuffleState = ShuffleState.OFF;
	target._internalVolume = 100;
	target._volumeBeforeMute = 100;
	target._internalCurrentTime = 0;
	target._internalDuration = 0;
	target._itemEndingSoonEmitted = false;
	target._playbackRate = 1;
	target._queueList = new MediaList();
	target._backlogList = new MediaList();
	target._queueWired = false;
	target._plugins = [];
	target._pluginQueue = [];
	target._authConfig = undefined;
	target._urlResolver = undefined;
	target._currentSubtitleIdx = null;
	target._currentAudioTrackIdx = null;
	target._currentQualityIdx = 'auto';
	target._currentAudioOutputId = null;
	target._qualityState = QualityState.AUTO;
	target._audioTrackState = AudioTrackState.DEFAULT;
	target._platform = undefined;
	target._policyCleanup = [];
	target._streamRegistry = undefined;
	target._bandwidthEstimate = 0;
	target._bandwidthEstimator = undefined;
	target._metrics = {
		ttfb: null,
		ttff: 0,
		rebufferRatio: 0,
		avgBitrate: null,
		droppedFrames: null,
		decoderStalls: null,
		joinTime: 0,
		sessionDurationMs: 0,
	};
	target._metricsStartedAt = 0;
	target._metricsTimer = undefined;
	target._lastProgressEmit = 0;

	target._titleTokenRegistry = {};

	target._preloadStrategy = new DefaultPreloadStrategy(10);
	target._transitionStrategy = _NOOP_TRANSITION;
	target._preloadFired = false;
	target._transitionFired = false;
	target._transitionRafHandle = undefined;
	target._preloadEpoch = 0;
}

/**
 * Kit-internal setter for the player's shared `AudioContext` reference.
 * Used by {@link AudioGraphPlugin} to write back the context it creates so
 * other kit plugins can find it via `player.audioContext()` without going
 * through a cast.
 */
export function setPlayerAudioContext(player: object, ctx: AudioContext | undefined): void {
	(player as Internals)._audioContext = ctx;
}
