import { EventEmitter } from '../events';
import type { IPlatform } from '../platform';
import type { Plugin } from '../plugin';
import type { ITranslator } from '../translator';
import type {
	AuthConfig,
	BaseEventMap,
	BasePlayerConfig,
	BasePlaylistItem,
	PlaybackMetrics,
	PlayerPhase,
	PluginCtorWithId,
	SubtitleStyle,
	UrlResolver,
} from '../types';
import { AudioTrackState, CastState as _CastStateEnum, QualityState } from '../types';
import { CueParserRegistry } from '../cues/parser-registry';
import { CueTracker } from '../cues/tracker';
import type { Cue } from '../cues/cue';
import type { VTTSubtitlePayload } from '../cues/parsers/vtt';
import { LifecycleRegistry } from '../lifecycle';
import { MediaList } from '../medialist';
import { DefaultPreloadStrategy } from '../preload-strategy';
import type { PreloadStrategy, TransitionStrategy } from '../preload-strategy';
import type { StreamRegistry } from '../streams/registry';


// ──────────────────────────────────────────────────────────────────────────
// Sidecar subtitle context — declared here so PlayerCoreState can reference
// it before the mediaTracksMethods block that implements the full feature.
// ──────────────────────────────────────────────────────────────────────────

export interface SidecarSubtitleContext {
	tracker: CueTracker<VTTSubtitlePayload>;
	active: Set<Cue<VTTSubtitlePayload>>;
	language?: string;
}


// ──────────────────────────────────────────────────────────────────────────
// State token unions
// ──────────────────────────────────────────────────────────────────────────

export type PlayStateToken = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';
export type VolumeStateToken = 'unmuted' | 'muted';
export type RepeatStateToken = 'off' | 'all' | 'one';
export type ShuffleStateToken = 'off' | 'on';


// ──────────────────────────────────────────────────────────────────────────
// Internal "this" shape used by mixin methods. Loosely typed on purpose —
// composeMixins copies these onto the player prototype, where they pick up
// the player's full type via call-site inference.
// ──────────────────────────────────────────────────────────────────────────

export interface PlayerCoreState<T extends BasePlaylistItem = BasePlaylistItem, C extends BasePlayerConfig = BasePlayerConfig, E extends BaseEventMap = BaseEventMap> extends EventEmitter<E> {
	className: string;
	playerId: string;
	container: HTMLElement;
	options: C;

	_phase: PlayerPhase;
	_dispatchStack: string[];
	_setupCalled: boolean;
	_readyPromise?: Promise<void>;
	_readyResolve?: () => void;
	_readyReject?: (err: unknown) => void;
	_baseUrl: string | undefined;
	_audioContext: AudioContext | undefined;
	_translator: ITranslator | undefined;
	_cueParsers: CueParserRegistry;
	_overrides: Map<string, { fn: (...args: any[]) => any; by: string }>;

	_playState: PlayStateToken;
	_volumeState: VolumeStateToken;
	_repeatState: RepeatStateToken;
	_shuffleState: ShuffleStateToken;
	_internalVolume: number;
	_volumeBeforeMute: number;
	_internalCurrentTime: number;
	_internalDuration: number;
	_playbackRate: number;

	_queueList: MediaList<T>;
	_backlogList: MediaList<T>;
	_queueWired: boolean;
	_plugins: Array<{ instance: Plugin; lifecycle: LifecycleRegistry; ctor: PluginCtorWithId }>;

	/**
	 * Pre-setup plugin queue. `addPlugin` calls during `'idle'` or `'setup'` phase
	 * push entries here; the `pluginsRegistering` stage drains them, calling
	 * `initialize` then awaiting `use()` for each, bounded by `pluginInitTimeoutMs`.
	 *
	 * Post-setup `addPlugin` runs the same pipeline inline.
	 */
	_pluginQueue: Array<{ ctor: PluginCtorWithId; opts?: unknown }>;

	/** Live `AuthConfig` — readable via `auth()`, mutable via `auth(config)` / `auth(partial)`. */
	_authConfig: AuthConfig | undefined;

	/** Live URL resolver — readable via `urlResolver()`, mutable via `urlResolver(fn)`. */
	_urlResolver: UrlResolver | undefined;

	/** Currently-selected subtitle index, or null when off. Written by `currentSubtitle(idx)`. */
	_currentSubtitleIdx: number | null;

	/** Currently-selected audio track index, or null when no explicit selection. Written by `currentAudioTrack(idx)`. */
	_currentAudioTrackIdx: number | null;

	/** Currently-selected quality index or 'auto'. Written by `currentQuality(idx)`. */
	_currentQualityIdx: number | 'auto';

	/** Currently-selected audio output device id, or null. Written by `currentAudioOutput(deviceId)`. */
	_currentAudioOutputId: string | null;

	/** Quality selection mode. Written by `qualityState(target)`. Defaults to `QualityState.AUTO`. */
	_qualityState: QualityState;

	/** Audio track selection mode. Written by `audioTrackState(idx)`. Defaults to `AudioTrackState.DEFAULT`. */
	_audioTrackState: AudioTrackState;

	/**
	 * Resolved platform bundle. Populated in setup() from `options.platform`
	 * (default `browserPlatform`). Plugins read via `player.platform()`.
	 */
	_platform: IPlatform | undefined;

	/**
	 * Cleanup callbacks for visibility/network/wakeLock subscriptions wired
	 * during setup(). All run on dispose() so policy hooks never leak.
	 */
	_policyCleanup: Array<() => void>;

	/**
	 * Per-player stream factory registry. Lazy — first touch (either via the
	 * `streamsReady` setup stage or via consumer `registerStream`) creates
	 * the registry and seeds it with the kit defaults (`native`, `hls`).
	 */
	_streamRegistry: StreamRegistry | undefined;

	/** Last-known bandwidth estimate (bps). Updated by the active stream source. */
	_bandwidthEstimate: number;

	/** Override estimator function. When set, ABR queries this instead of stream defaults. */
	_bandwidthEstimator: (() => number) | undefined;

	/** Live mutable metrics map. Snapshotted via `metrics()`, written via `recordMetric()`. */
	_metrics: PlaybackMetrics;

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

	/**
	 * Backing map for `experimental.override`. Stored on the instance so
	 * the `getOriginals` helper in `experimentalDescriptor` can find it
	 * without casting to `any`. TypeScript cannot see mixin-installed
	 * instance properties through the prototype chain, so this field is
	 * declared here rather than on the mixin object itself.
	 */
	_overrideOriginals?: Map<string, ((...args: unknown[]) => unknown) | undefined>;

	/** Active cast/handoff state. Written by `transferTo()`; read by `castState()`. */
	_castState?: _CastStateEnum;

	/** Monotonic counter bumped on each `load()` call; stale continuations bail when epoch mismatches. */
	_loadEpoch?: number;

	// ── Preload + transition state ────────────────────────────────────────────

	/** Active preload strategy. Set from config or `setPreloadStrategy()`. */
	_preloadStrategy: PreloadStrategy;

	/** Active transition strategy. Set from config or `setTransitionStrategy()`. */
	_transitionStrategy: TransitionStrategy;

	/** `true` after `shouldPreload` returns `true` for the current cursor position. Reset on `current` change. */
	_preloadFired: boolean;

	/** `true` after `shouldTransition` returns `true` for the current cursor. Reset on `current` change. */
	_transitionFired: boolean;

	/** RAF handle for the per-frame transition ticker. `undefined` when no transition is in progress. */
	_transitionRafHandle: number | undefined;

	/** Monotonically increasing epoch. Bumped whenever the cursor changes. Stale RAF callbacks bail when epoch differs. */
	_preloadEpoch: number;

	/** Monotonic counter bumped on each `_resolveAndEmitChapters` call. */
	_chapterEpoch?: number;

	/** Active sidecar VTT subtitle context. One per player. Torn down on track change or item change. */
	_sidecarSubtitle?: SidecarSubtitleContext;

	/** Subtitle style patch cache. Seeded on first read; mutated by `subtitleStyle(patch)`. */
	_subtitleStyle?: SubtitleStyle;
}

/**
 * Cross-mixin method surface. Every method that one mixin calls on `this`
 * but that lives on a *different* mixin is declared here so we can write
 * `this.play()` inside `lifecycleMethods` without resorting to `as any`.
 *
 * The methods are composed onto the prototype at runtime via `composeMixins`;
 * TypeScript cannot infer this, so we declare the surface explicitly and
 * intersect it into `Internals`.
 */
export interface MixinSurface {
	// playerStateMethods — backend access + phase + guards
	_transitionPhase(next: PlayerPhase): void;
	_resolveBackend(): import('./mixins/player-state').BackendShape | undefined;
	_peekBackend(): unknown;
	_peekBackendTyped<S extends object>(): S | undefined;
	_assertReady(): void;
	_dispatchBefore<TData>(beforeEvent: string, data: TData): Promise<import('../dispatch').BeforeDispatchOutcome<TData>>;
	// mediaTracksMethods — sidecar + chapter helpers
	_disposeSidecarSubtitle(): void;
	resolveItemTrackUrls<T extends BasePlaylistItem>(item: T): Promise<T>;
	_resolveAndEmitChapters(itemId: string | number | undefined): Promise<void>;
	// stateMutatorsMethods — mutation guard
	_emitBeforeMutation(method: string, args: ReadonlyArray<unknown>): boolean;
	// pluginRegistrationMethods — lang loaded tracking
	_pluginLangLoadedSet(): Set<string> | undefined;
	_markPluginLangLoaded(pluginId: string, lang: string): void;
	_registerPlugin(ctor: import('../types').PluginCtorWithId, opts: unknown, timeoutMs: number): Promise<void>;
	// transportMethods
	_seekingTransition(doSeek: () => void): void;
	play(opts?: import('../types').ActionOptions): Promise<void>;
	pause(opts?: import('../types').ActionOptions): Promise<void>;
	// volumeMethods
	mute(): void;
	unmute(): void;
	volume(v?: number): number | void;
	// timeMethods
	duration(): number;
	buffered(): number;
	seekByPercentage(pct: number, opts?: import('../types').ActionOptions): void;
	// queueMethods
	queue(items?: BasePlaylistItem[], opts?: import('../types').ActionOptions): ReadonlyArray<BasePlaylistItem> | void;
	queueLength(): number;
	currentIndex(): number;
	seekToIndex(position: number, opts?: import('../types').ActionOptions): void;
	next(opts?: import('../types').ActionOptions): Promise<void>;
	// loadingMethods — per-library mixin composes this; kit transport methods call it cross-mixin.
	load(item: BasePlaylistItem, opts?: import('../types').ActionOptions): Promise<void>;
	// mediaTracksMethods
	chapters(): ReadonlyArray<import('../types').Chapter>;
	seekToChapter(idx: number, opts?: import('../types').ActionOptions): void;
	current(target?: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean), opts?: import('../types').ActionOptions): BasePlaylistItem | undefined | void;
	currentTime(): number;
	currentTime(t: number, opts?: import('../types').ActionOptions): Promise<void>;
	// pluginRegistrationMethods
	removePluginById(id: string, opts?: { cascade?: boolean }): void;
	// i18nMethods
	addTranslations(bundle: import('../types').Translations): void;
	removeTranslations(prefix: string, lang?: string): void;
	// playerCoreMethods — runtime resolution of the configured platform bundle.
	platform(): IPlatform;
	// i18nMethods — language() lives in i18nMethods mixin, called cross-mixin.
	language(lang?: string): string | Promise<void>;
	// Per-library backend accessor. Optional — kit mixins probe its presence defensively.
	backend?(): unknown;
	// Per-library video element. Optional — only NMVideoPlayer carries it; kit reads defensively.
	videoElement?: HTMLMediaElement & { webkitShowPlaybackTargetPicker?: () => void; remote?: { prompt: () => Promise<void> }; setSinkId?: (id: string) => Promise<void>; sinkId?: string };
	// dispatch helpers exposed by lifecycleMethods.
	listenersOf?(event: string): ReadonlyArray<(data: unknown) => void>;
	pushDispatch?(name: string): void;
	popDispatch?(): string | undefined;
}

export type Internals = PlayerCoreState<BasePlaylistItem, BasePlayerConfig, BaseEventMap> & MixinSurface;


// ──────────────────────────────────────────────────────────────────────────
// State init — call this from the player constructor before resolving the
// three-form id. Populates every `_foo` field with its canonical default.
// ──────────────────────────────────────────────────────────────────────────

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
	target._playState = 'idle';
	target._volumeState = 'unmuted';
	target._repeatState = 'off';
	target._shuffleState = 'off';
	target._internalVolume = 1;
	target._volumeBeforeMute = 1;
	target._internalCurrentTime = 0;
	target._internalDuration = 0;
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
		ttfb: 0,
		ttff: 0,
		rebufferRatio: 0,
		avgBitrate: 0,
		droppedFrames: 0,
		decoderStalls: 0,
		joinTime: 0,
		sessionDurationMs: 0,
	};
	target._metricsStartedAt = 0;
	target._metricsTimer = undefined;
	target._lastProgressEmit = 0;

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


// A no-op transition strategy used as the initial default in initPlayerCoreState.
// Per-library players overwrite this immediately after setup() with their own default
// (CrossfadeTransitionStrategy for music, GaplessTransitionStrategy for video).
const _NOOP_TRANSITION: TransitionStrategy = {
	shouldTransition: () => false,
	tick: () => {},
	start: () => {},
	complete: () => {},
	cancel: () => {},
};
