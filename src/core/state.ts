import type { VTTSubtitlePayload } from '../adapters/cue-parser/vtt';
import type { EventEmitter } from '../adapters/event-bus/default';
import type { LifecycleRegistry } from '../adapters/lifecycle-registry/default';
import type { IPlatform } from '../adapters/platform/browser';
import type { PreloadStrategy, TransitionStrategy } from '../adapters/preload/default';
import type { StreamRegistry } from '../adapters/stream/registry';
import type { ITranslator } from '../adapters/translator/translator';
import type { Cue } from '../cues/cue';
import type { CueTracker } from '../cues/tracker';
import type { Plugin } from '../plugin';
import type {
	CastState as _CastStateEnum,
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
import { CueParserRegistry } from '../adapters/cue-parser/registry';
import { MediaList } from '../adapters/media-list/default';
import { DefaultPreloadStrategy } from '../adapters/preload/default';
import { AudioTrackState, QualityState } from '../types';

// ──────────────────────────────────────────────────────────────────────────
// Sidecar subtitle context
// ──────────────────────────────────────────────────────────────────────────

/**
 * Runtime state for one active sidecar VTT subtitle track.
 *
 * Lives on `PlayerCoreState._sidecarSubtitle`. The `mediaTracksMethods` mixin
 * is the sole writer; the subtitle renderer reads `active` on each cue event.
 * Torn down and replaced whenever the track selection changes or the queue
 * moves to a new item.
 */
export interface SidecarSubtitleContext {
	tracker: CueTracker<VTTSubtitlePayload>;
	active: Set<Cue<VTTSubtitlePayload>>;
	language?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// State token unions
// ──────────────────────────────────────────────────────────────────────────

/**
 * Coarse playback lifecycle token. Written by `transportMethods` / `lifecycleMethods`.
 * Read by the consumer (via `playState()`) and by container-class emit logic.
 *
 * - `'idle'` — player constructed, `setup()` not yet called.
 * - `'loading'` — item is being fetched / initialised by the backend.
 * - `'playing'` — backend is actively advancing the clock.
 * - `'paused'` — playback is suspended; position held.
 * - `'stopped'` — playback stopped; position may be reset.
 * - `'error'` — unrecoverable failure; consumer should surface a message.
 */
export type PlayStateToken = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

/**
 * Mute state token. Written by `volumeMethods.mute` / `volumeMethods.unmute`.
 * Read by `volume()` (returns 0 when `'muted'`) and the container-class emitter.
 */
export type VolumeStateToken = 'unmuted' | 'muted';

/**
 * Repeat mode token. Written by `stateMutatorsMethods.repeat()`.
 * Read by `queueMethods.next()` / `queueMethods.previous()` to decide
 * whether to wrap or stop at the end of the queue.
 *
 * - `'off'` — no repeat.
 * - `'all'` — loop the whole queue.
 * - `'one'` — loop only the current item.
 */
export type RepeatStateToken = 'off' | 'all' | 'one';

/**
 * Shuffle mode token. Written by `stateMutatorsMethods.shuffle()`.
 * Read by `queueMethods` when picking the next item.
 */
export type ShuffleStateToken = 'off' | 'on';

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
export interface PlayerCoreState<T extends BasePlaylistItem = BasePlaylistItem, C extends BasePlayerConfig = BasePlayerConfig, E extends BaseEventMap = BaseEventMap> extends EventEmitter<E> {

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
	 * Current lifecycle phase. Written only by `_transitionPhase()` inside
	 * `playerStateMethods`. Consumers read via `player.phase()`. Drives
	 * guard checks (e.g. `_assertReady`) and container-class updates.
	 */
	_phase: PlayerPhase;

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

	// ── Networking / media base ──────────────────────────────────────────────

	/**
	 * Optional base URL prepended to relative media paths. Written by
	 * `baseUrlAudioContextMethods.baseUrl(url)`. Undefined when no prefix is
	 * configured.
	 */
	_baseUrl: string | undefined;

	/**
	 * Shared `AudioContext` for the Web Audio graph. Written by
	 * {@link setPlayerAudioContext} (called by `AudioGraphPlugin`). Kit plugins
	 * that want to insert nodes (EQ, spectrum) read this and bail when it is
	 * `undefined` — they depend on the audio-graph plugin being present.
	 */
	_audioContext: AudioContext | undefined;

	// ── i18n ─────────────────────────────────────────────────────────────────

	/**
	 * Active translator instance. Written by `i18nMethods` during `setup()` and
	 * whenever `language()` triggers a bundle load. `undefined` until the first
	 * translation bundle resolves; kit code that calls `this.t(...)` guards on
	 * this before forwarding.
	 */
	_translator: ITranslator | undefined;

	// ── Cue / subtitle infrastructure ────────────────────────────────────────

	/**
	 * Registry of cue-format parsers available to this player instance.
	 * Pre-seeded with VTT in `initPlayerCoreState`; consumers or plugins can
	 * register additional formats via `player.registerCueParser()`.
	 */
	_cueParsers: CueParserRegistry;

	// ── Experimental override map ─────────────────────────────────────────────

	/**
	 * Method override table written by `experimental.override()`. Maps method
	 * name → `{ fn, by }` where `by` is the plugin id that installed the
	 * override, for debugging. Declared on the state interface (rather than the
	 * `experimentalMethods` mixin object) so `getOriginals` can locate it on
	 * the instance without a cast.
	 */
	_overrides: Map<string, { fn: (...args: any[]) => any; by: string }>;

	// ── Playback state tokens ─────────────────────────────────────────────────

	/** Coarse play-state label. Written by transport / lifecycle methods; read by `playState()` and the container-class emitter. */
	_playState: PlayStateToken;

	/** Mute state. Written by `volumeMethods`; read by `volume()` (returns 0 when muted) and the container-class emitter. */
	_volumeState: VolumeStateToken;

	/** Repeat mode. Written by `stateMutatorsMethods.repeat()`; read by queue advancement logic. */
	_repeatState: RepeatStateToken;

	/** Shuffle mode. Written by `stateMutatorsMethods.shuffle()`; read by queue advancement logic. */
	_shuffleState: ShuffleStateToken;

	/** Stored on the 0-100 scale to match the public volume() API. */
	_internalVolume: number;

	/** Stored on the 0-100 scale to match the public volume() API. */
	_volumeBeforeMute: number;

	/**
	 * Last-known current-time position in seconds. Written by `timeMethods`
	 * on each `time` event from the backend, and by seek operations before the
	 * backend confirms. Read by `currentTime()`.
	 */
	_internalCurrentTime: number;

	/**
	 * Last-known total duration in seconds. Written by the backend when it
	 * resolves the media duration; `0` until then. Read by `duration()`.
	 */
	_internalDuration: number;

	/**
	 * Current playback rate multiplier (1 = normal). Written by
	 * `stateMutatorsMethods.playbackRate()`; forwarded to the backend at write
	 * time. Read by `playbackRate()`.
	 */
	_playbackRate: number;

	// ── Queue ─────────────────────────────────────────────────────────────────

	/**
	 * The live play queue. Written by `queueMethods.queue()` and queue
	 * mutators; read by `current()`, `next()`, `previous()`, and every
	 * consumer that calls `player.queue()`. The `MediaList` wrapper provides
	 * cursor tracking and shuffle-safe iteration.
	 */
	_queueList: MediaList<T>;

	/**
	 * Items removed from the queue by auto-advance or manual removes.
	 * Held so `previous()` can reach back past the queue head. Cleared when
	 * the queue is replaced.
	 */
	_backlogList: MediaList<T>;

	/**
	 * `true` once the queue event listeners (item-change, end-of-list) have
	 * been attached to `_queueList`. Guards against double-wiring when
	 * `setup()` or `queue()` is called multiple times.
	 */
	_queueWired: boolean;

	// ── Plugins ───────────────────────────────────────────────────────────────

	/**
	 * Live plugin registry. Each entry holds the plugin instance, its
	 * `LifecycleRegistry` (for disposal), and the constructor (for `getPlugin`
	 * type-safe lookup). Written by `pluginRegistrationMethods._registerPlugin`.
	 */
	_plugins: Array<{ instance: Plugin; lifecycle: LifecycleRegistry; ctor: PluginCtorWithId }>;

	/**
	 * Pre-setup plugin queue. `addPlugin` calls during `'idle'` or `'setup'` phase
	 * push entries here; the `pluginsRegistering` stage drains them, calling
	 * `initialize` then awaiting `use()` for each, bounded by `pluginInitTimeoutMs`.
	 *
	 * Post-setup `addPlugin` runs the same pipeline inline.
	 */
	_pluginQueue: Array<{ ctor: PluginCtorWithId; opts?: unknown }>;

	// ── Auth + URL resolution ─────────────────────────────────────────────────

	/** Live `AuthConfig` — readable via `auth()`, mutable via `auth(config)` / `auth(partial)`. */
	_authConfig: AuthConfig | undefined;

	/** Live URL resolver — readable via `urlResolver()`, mutable via `urlResolver(fn)`. */
	_urlResolver: UrlResolver | undefined;

	// ── Track selection ───────────────────────────────────────────────────────

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

	// ── Streaming ─────────────────────────────────────────────────────────────

	/**
	 * Per-player stream factory registry. Lazy — first touch (either via the
	 * `streamsReady` setup stage or via consumer `registerStream`) creates
	 * the registry and seeds it with the kit defaults (`native`, `hls`).
	 */
	_streamRegistry: StreamRegistry | undefined;

	// ── Bandwidth / ABR ──────────────────────────────────────────────────────

	/** Last-known bandwidth estimate (bps). Updated by the active stream source. */
	_bandwidthEstimate: number;

	/** Override estimator function. When set, ABR queries this instead of stream defaults. */
	_bandwidthEstimator: (() => number) | undefined;

	// ── Metrics ───────────────────────────────────────────────────────────────

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

	// ── Experimental ─────────────────────────────────────────────────────────

	/**
	 * Backing map for `experimental.override`. Stored on the instance so
	 * the `getOriginals` helper in `experimentalDescriptor` can find it
	 * without casting to `any`. TypeScript cannot see mixin-installed
	 * instance properties through the prototype chain, so this field is
	 * declared here rather than on the mixin object itself.
	 */
	_overrideOriginals?: Map<string, ((...args: unknown[]) => unknown) | undefined>;

	// ── Cast / handoff ────────────────────────────────────────────────────────

	/** Active cast/handoff state. Written by `transferTo()`; read by `castState()`. */
	_castState?: _CastStateEnum;

	// ── Load epoch ────────────────────────────────────────────────────────────

	/** Monotonic counter bumped on each `load()` call; stale continuations bail when epoch mismatches. */
	_loadEpoch?: number;

	/**
	 * Monotonic counter bumped on each `current()` write call. The autoplay
	 *  continuation in `current()` checks this before calling `play()` so that
	 *  a superseded navigation (rapid episode clicks) does not fire a spurious
	 *  play() once its stale load silently resolves.
	 */
	_currentEpoch?: number;

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

	// ── Chapter ───────────────────────────────────────────────────────────────

	/** Monotonic counter bumped on each `_resolveAndEmitChapters` call. Stale chapter fetches bail when epoch differs. */
	_chapterEpoch?: number;

	// ── Sidecar subtitle ─────────────────────────────────────────────────────

	/** Active sidecar VTT subtitle context. One per player. Torn down on track change or item change. */
	_sidecarSubtitle?: SidecarSubtitleContext;

	// ── Subtitle style ────────────────────────────────────────────────────────

	/** Subtitle style patch cache. Seeded on first read; mutated by `subtitleStyle(patch)`. */
	_subtitleStyle?: SubtitleStyle;
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

	// playerStateMethods (see mixins/player-state.ts) — backend access + phase + guards
	_transitionPhase(next: PlayerPhase): void;
	_resolveBackend(): import('./mixins/player-state').BackendShape | undefined;
	_peekBackend(): unknown;
	_peekBackendTyped<S extends object>(): S | undefined;
	_assertReady(): void;
	_dispatchBefore<TData>(beforeEvent: string, data: TData): Promise<import('./dispatch').BeforeDispatchOutcome<TData>>;

	// mediaTracksMethods (see mixins/media-tracks.ts) — sidecar + chapter helpers
	_disposeSidecarSubtitle(): void;
	resolveItemTrackUrls<T extends BasePlaylistItem>(item: T): Promise<T>;
	_resolveAndEmitChapters(itemId: string | number | undefined): Promise<void>;

	// stateMutatorsMethods (see mixins/state-mutators.ts) — mutation guard
	_emitBeforeMutation(method: string, args: ReadonlyArray<unknown>): boolean;

	// pluginRegistrationMethods (see mixins/plugin-registration.ts) — lang loaded tracking
	_pluginLangLoadedSet(): Set<string> | undefined;
	_markPluginLangLoaded(pluginId: string, lang: string): void;
	_registerPlugin(ctor: import('../types').PluginCtorWithId, opts: unknown, timeoutMs: number): Promise<void>;

	// transportMethods (see mixins/transport.ts)
	_seekingTransition(doSeek: () => void): void;
	play(opts?: import('../types').ActionOptions): Promise<void>;
	pause(opts?: import('../types').ActionOptions): Promise<void>;

	// volumeMethods (see mixins/volume.ts)
	mute(): void;
	unmute(): void;
	volume(v?: number): number | void;

	// timeMethods (see mixins/time.ts)
	duration(): number;
	buffered(): number;
	seekByPercentage(pct: number, opts?: import('../types').ActionOptions): void;

	// queueMethods (see mixins/queue.ts)
	queue(items?: BasePlaylistItem[], opts?: import('../types').ActionOptions): ReadonlyArray<BasePlaylistItem> | void;
	queueLength(): number;
	currentIndex(): number;
	seekToIndex(position: number, opts?: import('../types').ActionOptions): void;
	next(opts?: import('../types').ActionOptions): Promise<void>;

	// loadingMethods — per-library mixin; kit transport methods call it cross-mixin
	load(item: BasePlaylistItem, opts?: import('../types').ActionOptions): Promise<void>;

	// mediaTracksMethods (see mixins/media-tracks.ts)
	chapters(): ReadonlyArray<import('../types').Chapter>;
	seekToChapter(idx: number, opts?: import('../types').ActionOptions): void;
	current(target?: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean), opts?: import('../types').ActionOptions): BasePlaylistItem | undefined | void;
	currentTime(): number;
	currentTime(t: number, opts?: import('../types').ActionOptions): Promise<void>;

	// pluginRegistrationMethods (see mixins/plugin-registration.ts)
	removePluginById(id: string, opts?: { cascade?: boolean }): void;

	// i18nMethods (see mixins/i18n.ts)
	addTranslations(bundle: import('../types').Translations): void;
	removeTranslations(prefix: string, lang?: string): void;

	// playerCoreMethods (see mixins/player-core.ts) — runtime platform resolution
	platform(): IPlatform;

	// i18nMethods — language() lives in i18nMethods mixin, called cross-mixin
	language(lang?: string): string | Promise<void>;

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
const _NOOP_TRANSITION: TransitionStrategy = {
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
	target._playState = 'idle';
	target._volumeState = 'unmuted';
	target._repeatState = 'off';
	target._shuffleState = 'off';
	target._internalVolume = 100;
	target._volumeBeforeMute = 100;
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
