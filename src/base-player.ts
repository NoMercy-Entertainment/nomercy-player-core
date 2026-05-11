/**
 * Shared player core — the **logic** that both NMMusicPlayer and NMVideoPlayer
 * exhibit. Lives in the kit so neither library can drift from the spec, and so
 * any behavior change lands once and applies everywhere.
 *
 * This file is NOT a base class. It is a set of:
 *
 *  - **Error helpers** (`stateError`, `resourceError`, `pluginErrorFactory`)
 * 		— every player throw goes through these, so we
 *    never end up with raw `Error` strings sneaking in.
 *  - **Constructor resolution** (`resolvePlayerConstructor`) — the three-form
 *    factory contract, identical across libraries.
 *  - **State init** (`initPlayerCoreState`) — populates every internal `_foo`
 *    field on a fresh player instance with the canonical defaults.
 *  - **Mixin modules** (`lifecycleMethods`, `transportMethods`, `queueMethods`,
 *    `volumeMethods`, `stateMethods`, `timeMethods`, `i18nMethods`,
 *    `cueParserMethods`, `baseUrlAudioContextMethods`, `experimentalDescriptor`,
 *    `pluginRegistrationMethods`) — composed onto each player's prototype via
 *    the kit's `composeMixins` helper.
 *
 * Player classes own only:
 *  - The per-library registry (own static `_instances` Map)
 *  - The constructor wiring (call `initPlayerCoreState` + resolve via
 *    `resolvePlayerConstructor`)
 *  - Library-specific state fields (e.g. `videoElement` on video)
 *  - Library-specific stubs / typed state-enum overrides
 *
 * That's it. Nothing else should be duplicated.
 */

import type { CueParser } from './cues/parser-registry';
import { EventEmitter } from './events';
import type { IPlatform } from './platform';
import type { Plugin } from './plugin';
import type { StreamFactory } from './streams/source';
import type { ITranslator } from './translator';
import type {
	ActionOptions,
	AuthConfig,
	BaseEventMap,
	BasePlayerConfig,
	BasePlaylistItem,
	CanPlayResult,
	Chapter,
	DeviceCapabilities,
	IPlayer,
	LoadOptions,
	PlaybackMetrics,
	PlayerExperimental,
	PlayerPhase,
	PluginCtorWithId,
	ResolvedUrl,
	SubtitleCue as SubtitleCuePayload,
	SubtitleTrack,
	TimeState,
	Translations,
	UrlCategory,
	UrlResolver,
	UrlResolverContext,
} from './types';
import { authFetch } from './auth-fetch';
import {
	addClasses as domAddClasses,
	createButton as domCreateButton,
	createElement as domCreateElement,
	createSVG as domCreateSVG,
	removeClasses as domRemoveClasses,
} from './dom';
import { CueParserRegistry } from './cues/parser-registry';
import { builtInCueParsers } from './cues/parsers/built-ins';
import type { Cue } from './cues/cue';
import { CueTracker } from './cues/tracker';
import { parseVtt, parseVttSubtitles, type VTTSubtitlePayload } from './cues/parsers/vtt';
import { runDispatchBefore } from './dispatch';
import {
	BrowserPolicyError,
	MediaFormatError,
	PluginError,
	ResourceError,
	StateError,
} from './errors';
import { LifecycleRegistry } from './lifecycle';
import { MediaList } from './medialist';
import { browserPlatform } from './platform';
import { buildResolvedUrl } from './resolved-url';
import { hlsFactory } from './streams/hls';
import { nativeFactory } from './streams/native';
import { StreamRegistry } from './streams/registry';
import { getLazyTranslationLoader } from './translations-glob';
import { bcp47FallbackChain, DefaultTranslator } from './translator';
import { AudioTrackState, BufferState, CastState as _CastStateEnum, NetworkState, QualityState, SetupState, VisibilityState } from './types';
import type { PreloadAsset, PreloadStrategy, TransitionBackend, TransitionStrategy } from './preload-strategy';
import { DefaultPreloadStrategy } from './preload-strategy';

// ──────────────────────────────────────────────────────────────────────────
// Sidecar subtitle context — declared here so PlayerCoreState can reference
// it before the mediaTracksMethods block that implements the full feature.
// ──────────────────────────────────────────────────────────────────────────

interface SidecarSubtitleContext {
	tracker: CueTracker<VTTSubtitlePayload>;
	active: Set<Cue<VTTSubtitlePayload>>;
	language?: string;
}


// ──────────────────────────────────────────────────────────────────────────
// Error helpers
// ──────────────────────────────────────────────────────────────────────────

export function stateError(code: string, message: string, context?: Record<string, unknown>): StateError {
	return new StateError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}

export function resourceError(code: string, message: string, context?: Record<string, unknown>): ResourceError {
	return new ResourceError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}

export function pluginErrorFactory(code: string, message: string, context?: Record<string, unknown>): PluginError {
	return new PluginError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}

/**
 * The kit's own version. Plugins declare `static readonly minCoreVersion` and
 * `addPlugin` rejects with `core:plugin/incompatible-core-version` when the
 * plugin's required minimum exceeds this. Bump alongside the kit's package.json
 * version on every release.
 */
export const KIT_VERSION = '0.1.0';

/**
 * Three-way semver compare: returns -1, 0, or +1 for `a` vs `b`. Tolerates
 * missing patch / minor (`'2'` → `'2.0.0'`). Pre-release tags (`-rc.1`) are
 * compared as strings after the numeric trio.
 */
function _compareSemver(a: string, b: string): -1 | 0 | 1 {
	const parse = (v: string): { nums: number[]; pre: string } => {
		const [main, pre = ''] = v.split('-', 2);
		const nums = (main ?? '').split('.').map(s => Number.parseInt(s, 10) || 0);
		while (nums.length < 3) nums.push(0);
		return {
			nums,
			pre,
		};
	};
	const aP = parse(a);
	const bP = parse(b);
	for (let i = 0; i < 3; i++) {
		const an = aP.nums[i] ?? 0;
		const bn = bP.nums[i] ?? 0;
		if (an < bn)
			return -1;
		if (an > bn)
			return 1;
	}
	if (aP.pre === bP.pre)
		return 0;
	if (!aP.pre && bP.pre)
		return 1; // a is final, b is pre-release
	if (aP.pre && !bP.pre)
		return -1;
	return aP.pre < bP.pre ? -1 : 1;
}

// ──────────────────────────────────────────────────────────────────────────
// Three-form constructor resolution
// ──────────────────────────────────────────────────────────────────────────

export type PlayerCtorResolution<C>
	= | { kind: 'existing'; instance: C }
		| { kind: 'mount'; id: string; div: HTMLDivElement };

function _isHTMLDivElement(el: Element): el is HTMLDivElement {
	return el.tagName === 'DIV';
}

export function resolvePlayerConstructor<C>(
	id: string | number | undefined,
	instances: Map<string, C>,
	className: string,
): PlayerCtorResolution<C> {
	if (id === undefined) {
		if (instances.size === 0) {
			throw stateError('core:player/no-element', `No ${className} instance has been created yet. Pass a div id first.`);
		}
		const first = instances.values().next().value;
		if (!first)
			throw stateError('core:player/no-element', 'Registry empty.');
		return {
			kind: 'existing',
			instance: first,
		};
	}

	if (typeof id === 'number') {
		const list = Array.from(instances.values());
		const target = list[id];
		if (!target) {
			throw stateError('core:player/not-found', `No ${className} instance at index ${id} (registry size: ${list.length}).`);
		}
		return {
			kind: 'existing',
			instance: target,
		};
	}

	if (typeof id !== 'string') {
		throw stateError('core:player/invalid-id-type', `Player id must be a string or number; got ${typeof id}.`);
	}

	const existing = instances.get(id);
	if (existing) {
		return {
			kind: 'existing',
			instance: existing,
		};
	}

	const element = typeof document !== 'undefined' ? document.getElementById(id) : null;
	if (!element) {
		throw resourceError('core:player/element-missing', `No element found with id "${id}".`);
	}
	if (!_isHTMLDivElement(element)) {
		throw stateError('core:player/element-not-div', `Element with id "${id}" is a <${element.tagName.toLowerCase()}>, not a <div>.`);
	}

	return {
		kind: 'mount',
		id,
		div: element,
	};
}

// ──────────────────────────────────────────────────────────────────────────
// Internal "this" shape used by mixin methods. Loosely typed on purpose —
// composeMixins copies these onto the player prototype, where they pick up
// the player's full type via call-site inference.
// ──────────────────────────────────────────────────────────────────────────

export type PlayStateToken = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';
export type VolumeStateToken = 'unmuted' | 'muted';
export type RepeatStateToken = 'off' | 'all' | 'one';
export type ShuffleStateToken = 'off' | 'on';

interface PlayerCoreState<T extends BasePlaylistItem = BasePlaylistItem, C extends BasePlayerConfig = BasePlayerConfig, E extends BaseEventMap = BaseEventMap> extends EventEmitter<E> {
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
	_subtitleStyle?: Record<string, unknown>;
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
interface MixinSurface {
	// transportMethods
	play(opts?: ActionOptions): Promise<void>;
	pause(opts?: ActionOptions): Promise<void>;
	// volumeMethods
	mute(): void;
	unmute(): void;
	volume(v?: number): number | void;
	// timeMethods
	duration(): number;
	buffered(): number;
	seekByPercentage(pct: number, opts?: ActionOptions): void;
	// queueMethods
	queue(items?: BasePlaylistItem[], opts?: ActionOptions): ReadonlyArray<BasePlaylistItem> | void;
	queueLength(): number;
	currentIndex(): number;
	seekToIndex(position: number, opts?: ActionOptions): void;
	next(opts?: ActionOptions): Promise<void>;
	// loadingMethods — per-library mixin composes this; kit transport methods call it cross-mixin.
	load(item: BasePlaylistItem, opts?: ActionOptions): Promise<void>;
	// mediaTracksMethods
	chapters(): ReadonlyArray<Chapter>;
	seekToChapter(idx: number, opts?: ActionOptions): void;
	current(target?: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean), opts?: ActionOptions): BasePlaylistItem | undefined | void;
	currentTime(): number;
	currentTime(t: number, opts?: ActionOptions): Promise<void>;
	// pluginRegistrationMethods
	removePluginById(id: string, opts?: { cascade?: boolean }): void;
	// i18nMethods
	addTranslations(bundle: Translations): void;
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

type Internals = PlayerCoreState<BasePlaylistItem, BasePlayerConfig, BaseEventMap> & MixinSurface;

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


// ──────────────────────────────────────────────────────────────────────────
// Preload + transition orchestration helpers
// ──────────────────────────────────────────────────────────────────────────

async function _runPreload(player: Internals, nextItem: BasePlaylistItem, strategy: PreloadStrategy): Promise<void> {
	const capturedEpoch = player._preloadEpoch;
	const assets = strategy.assetsToPreload(nextItem);

	player.emit('preloadStart', {
		item: nextItem,
		assets: assets.map(asset => ({ url: asset.url, category: asset.category })),
	});

	let loaded = 0;
	const total = assets.length;

	if (total === 0) {
		player.emit('preloadComplete', { item: nextItem });
		return;
	}

	const fetchAsset = async (asset: PreloadAsset): Promise<void> => {
		if (player._preloadEpoch !== capturedEpoch) return;

		try {
			const request = new Request(asset.url, {
				method: 'HEAD',
				mode: 'no-cors',
			});
			await fetch(request).catch(() => {});

			loaded += 1;

			if (player._preloadEpoch !== capturedEpoch) return;

			player.emit('preloadProgress', { item: nextItem, loaded, total });

			if (loaded === total) {
				player.emit('preloadComplete', { item: nextItem });
			}
		}
		catch (error: unknown) {
			if (player._preloadEpoch !== capturedEpoch) return;
			player.emit('preloadError', { item: nextItem, error });
		}
	};

	await Promise.all(assets.map(fetchAsset));
}

function _runTransition(player: Internals, outgoing: BasePlaylistItem, incoming: BasePlaylistItem): void {
	const backend = _resolveTransitionBackend(player);

	player._transitionStrategy.start(outgoing, incoming, backend);
	player.emit('transitionStart', { outgoing, incoming });

	const capturedEpoch = player._preloadEpoch;
	const crossfadeLeadSeconds = player.options.crossfadeLeadSeconds ?? 3;
	const crossfadeTailSeconds = player.options.crossfadeTailSeconds ?? 3;
	const totalWindowSeconds = crossfadeLeadSeconds + crossfadeTailSeconds;

	const tick = (): void => {
		if (player._preloadEpoch !== capturedEpoch) return;
		if (player._phase === 'disposed' || player._phase === 'disposing') return;

		const currentTime = player._internalCurrentTime;
		const duration = player._internalDuration;
		const elapsed = currentTime - (duration - crossfadeLeadSeconds);
		const fraction = totalWindowSeconds > 0 ? Math.max(0, Math.min(1, elapsed / totalWindowSeconds)) : 1;

		const context = { currentTime, duration, outgoingItem: outgoing, incomingItem: incoming, fraction };

		player._transitionStrategy.tick(context, backend);
		player.emit('transitionProgress', { outgoing, incoming, fraction });

		if (fraction >= 1) {
			player._transitionStrategy.complete(outgoing, incoming);
			player.emit('transitionComplete', { from: outgoing, to: incoming });
			player._transitionRafHandle = undefined;
			return;
		}

		player._transitionRafHandle = requestAnimationFrame(tick);
	};

	player._transitionRafHandle = requestAnimationFrame(tick);
}

function _resolveTransitionBackend(player: Internals): import('./preload-strategy').TransitionBackend | null {
	const backend = player.backend?.();
	if (!backend) return null;
	const candidate = backend as Partial<import('./preload-strategy').TransitionBackend>;
	if (typeof candidate.supportsCrossfade === 'function') {
		return candidate as import('./preload-strategy').TransitionBackend;
	}
	return null;
}


// ──────────────────────────────────────────────────────────────────────────
// Mixin: lifecycle (setup, ready, dispose, setupState, phase, dispatching,
// _transitionPhase, _assertReady, _dispatchBefore)
// ──────────────────────────────────────────────────────────────────────────

export const lifecycleMethods = {
	setup(this: Internals, config: BasePlayerConfig): unknown {
		// Spec §14: re-setup is `dispose → setup again`. Calling `setup()` twice
		// is a programmer error.
		if (this._setupCalled) {
			throw stateError('core:lifecycle/already-setup', 'setup() called twice. Re-setup requires dispose() first.');
		}
		if (this._phase === 'disposed' || this._phase === 'disposing') {
			throw stateError('core:player/disposed', 'setup() called after dispose().');
		}
		this._setupCalled = true;

		this.options = { ...config };

		// Spec §G: deprecated `debug: true` → `logLevel = 'debug'` when no
		// explicit logLevel set. Explicit value always wins.
		if (this.options.debug === true && this.options.logLevel === undefined) {
			this.options.logLevel = 'debug';
		}

		// Spec §G + spec §12: deprecated `accessToken` → `auth.bearerToken`
		// shim. Lifts the v1 alias into the v2 auth pipeline. If `auth` is
		// already supplied, accessToken does NOT override an existing
		// bearerToken — explicit auth always wins.
		if (this.options.accessToken !== undefined) {
			const existing = this.options.auth ?? {};
			if (existing.bearerToken === undefined) {
				this.options.auth = {
					...existing,
					bearerToken: this.options.accessToken,
				};
			}
		}

		// Snapshot the auth config so runtime mutators (`auth(config)` / `auth(partial)`)
		// have a live source of truth. Frozen on read via `auth()`.
		this._authConfig = this.options.auth ? { ...this.options.auth } : undefined;

		// Capture the consumer-supplied URL resolver, if any. Falls back to
		// the built-in default at call time when undefined.
		this._urlResolver = this.options.urlResolver;

		if (this.options.baseUrl)
			this._baseUrl = this.options.baseUrl;

		if (typeof this.options.defaultVolume === 'number') {
			this._internalVolume = Math.max(0, Math.min(1, this.options.defaultVolume));
			this._volumeBeforeMute = this._internalVolume;
		}

		this._translator = this.options.translator ?? new DefaultTranslator({
			language: this.options.language,
			translations: this.options.translations,
			loadTranslations: this.options.loadTranslations,
			onMissingTranslation: this.options.onMissingTranslation,
		});

		// Spec §G + §24.7: kit-default parsers (LRC, VTT-subtitle, sprite-VTT)
		// register first. Resolution walks newest → oldest, so built-ins act as
		// the LOW-priority fallback while consumer-supplied parsers (registered
		// AFTER) win the resolution. Both go to the back of the list — order
		// is "consumer pushed last, checked first."
		for (const parser of builtInCueParsers) {
			this._cueParsers.register(parser);
		}
		if (this.options.cueParsers) {
			for (const parser of this.options.cueParsers) {
				this._cueParsers.register(parser);
			}
		}

		// Spec §G: resolve platform bundle. Default is browserPlatform but
		// consumers can swap (Capacitor, Tauri, Electron) or partially override
		// (`{ ...browserPlatform, wakeLock: customWakeLock }`).
		this._platform = this.options.platform ?? browserPlatform;

		// Spec §G — pauseWhenHidden: subscribe to the platform's visibility
		// monitor; pause when the page goes hidden. Default is `false` for
		// both libraries so we wire ONLY when explicitly enabled.
		if (this.options.pauseWhenHidden) {
			const unsubscribe = this._platform.visibility.subscribe((visible) => {
				if (!visible) {
					this.pause({ source: 'platform' }).catch(() => { /* swallow */ });
				}
				if (visible) {
					this.emit('visibility:visible');
				}
				else {
					this.emit('visibility:hidden');
				}
			});
			this._policyCleanup.push(unsubscribe);
		}

		// Spec §G — onOffline: subscribe to the platform's network monitor and
		// react per the configured policy. `'pause'` calls pause() on offline;
		// `'continue-buffered'` (default) emits the network events but doesn't
		// touch transport; `'ignore'` skips emission entirely.
		const onOffline = this.options.onOffline ?? 'continue-buffered';
		if (onOffline !== 'ignore') {
			const unsubscribe = this._platform.network.subscribe((state) => {
				if (state.online) {
					this.emit('network:online');
				}
				else {
					this.emit('network:offline');
					if (onOffline === 'pause') {
						this.pause({ source: 'platform' }).catch(() => { /* swallow */ });
					}
				}
			});
			this._policyCleanup.push(unsubscribe);
		}

		// Spec §G — wakeLock policy:
		//   `'never'`    — no acquire ever
		//   `'always'`   — acquire at setup, release at dispose
		//   `'auto'`     — track via phase events; acquire when entering
		//                  `playing`/`starting`, release when exiting
		const wakeLockPolicy = this.options.wakeLock ?? 'never';
		if (wakeLockPolicy === 'always') {
			void this._platform.wakeLock.acquire().catch(() => { /* unsupported */ });
			this._policyCleanup.push(() => {
				void this._platform?.wakeLock.release().catch(() => { /* defensive */ });
			});
		}
		else if (wakeLockPolicy === 'auto') {
			const platform = this._platform;
			const phaseHandler = ({ to }: { to: PlayerPhase }): void => {
				if (to === 'playing' || to === 'starting') {
					if (!platform.wakeLock.isHeld()) {
						void platform.wakeLock.acquire().catch(() => { /* unsupported */ });
					}
				}
				else if (to === 'paused' || to === 'stopped' || to === 'ended' || to === 'disposed') {
					if (platform.wakeLock.isHeld()) {
						void platform.wakeLock.release().catch(() => { /* defensive */ });
					}
				}
			};
			this.on('phase', phaseHandler);
			this._policyCleanup.push(() => {
				this.off('phase', phaseHandler);
				if (platform.wakeLock.isHeld()) {
					void platform.wakeLock.release().catch(() => { /* defensive */ });
				}
			});
		}

		// Spec §T — periodic metrics emit + per-event instrumentation.
		// `_metricsStartedAt` anchors session-duration; per-event hooks below
		// populate TTFF / joinTime / rebufferRatio as the player runs.
		this._metricsStartedAt = Date.now();

		// TTFF instrumentation: capture `play()` timestamp, compute delta on
		// first `firstFrame` event. Single-shot — only the FIRST play→frame
		// pair counts; subsequent plays don't reset TTFF.
		let ttffStartTs = 0;
		let ttffRecorded = false;
		const onPlay = (): void => {
			if (ttffStartTs === 0)
				ttffStartTs = Date.now();
		};
		const onFirstFrame = (): void => {
			if (!ttffRecorded && ttffStartTs > 0) {
				this._metrics.ttff = Date.now() - ttffStartTs;
				ttffRecorded = true;
				// joinTime aggregates: ready→firstFrame total.
				if (this._metricsStartedAt > 0) {
					this._metrics.joinTime = Date.now() - this._metricsStartedAt;
				}
			}
		};
		this.on('play', onPlay);
		this.on('firstFrame', onFirstFrame);

		// Rebuffer instrumentation: `backend:waiting` starts a stall timer;
		// `backend:loaded`/`play` ends it. Sum the stall durations and divide
		// by session duration on each metrics-snapshot read.
		let stallStartTs = 0;
		let cumulativeStallMs = 0;
		const onWaiting = (): void => {
			if (stallStartTs === 0)
				stallStartTs = Date.now();
		};
		const onResume = (): void => {
			if (stallStartTs > 0) {
				cumulativeStallMs += Date.now() - stallStartTs;
				stallStartTs = 0;
				const sessionMs = Date.now() - this._metricsStartedAt;
				if (sessionMs > 0) {
					this._metrics.rebufferRatio = cumulativeStallMs / sessionMs;
				}
			}
		};
		this.on('backend:waiting', onWaiting);
		this.on('backend:loaded', onResume);
		this.on('play', onResume);

		this._policyCleanup.push(() => {
			this.off('play', onPlay);
			this.off('firstFrame', onFirstFrame);
			this.off('backend:waiting', onWaiting);
			this.off('backend:loaded', onResume);
			this.off('play', onResume);
		});

		const interval = this.options.metricsIntervalMs ?? 10_000;
		if (interval > 0) {
			this._metricsTimer = setInterval(() => {
				// Refresh sessionDurationMs on every emit so listeners see
				// current numbers without calling metrics() explicitly.
				this._metrics.sessionDurationMs = Date.now() - this._metricsStartedAt;
				this.emit('playback:metrics', this._metrics);
			}, interval);
			this._policyCleanup.push(() => {
				if (this._metricsTimer)
					clearInterval(this._metricsTimer);
				this._metricsTimer = undefined;
			});
		}

		const onTimeSync = ({ time }: { time: number }): void => {
			this._internalCurrentTime = time;
		};
		this.on('time', onTimeSync);
		this._policyCleanup.push(() => {
			this.off('time', onTimeSync);
		});

		const onDurationSync = ({ duration }: { duration: number }): void => {
			this._internalDuration = duration;
		};
		this.on('duration', onDurationSync);
		this._policyCleanup.push(() => {
			this.off('duration', onDurationSync);
		});

		// Spec §P4-V5: throttled progress event. `time` fires every animation
		// frame — too noisy for server-side watch-position saves. We subscribe
		// to the player's own `time` event and re-emit `progress` at most every
		// `progressIntervalMs` (default 5000ms, 0 = disabled). `_lastProgressEmit`
		// starts at 0 so the first `time` event always fires `progress`.
		const progressInterval = this.options.progressIntervalMs ?? 5_000;
		if (progressInterval > 0) {
			const onTime = ({ time }: { time: number }): void => {
				const now = Date.now();
				if (now - this._lastProgressEmit < progressInterval) return;
				this._lastProgressEmit = now;
				const duration = this.duration();
				const percentage = duration > 0 ? (time / duration) * 100 : 0;
				this.emit('progress', { time, duration, percentage });
			};
			this.on('time', onTime);
			this._policyCleanup.push(() => {
				this.off('time', onTime);
			});
		}

		// ── Preload + transition orchestration ────────────────────────────────
		// Override strategies from config if supplied. Per-library players set
		// their own defaults AFTER initPlayerCoreState; config injection always
		// wins over library defaults when both are present.
		if (this.options.preloadStrategy) {
			this._preloadStrategy = this.options.preloadStrategy;
		}
		if (this.options.transitionStrategy) {
			this._transitionStrategy = this.options.transitionStrategy;
		}

		// Apply config-level lead times to the default strategy when no custom
		// strategy has been injected. We rebuild the default strategy so the
		// per-library player's preloadLeadSeconds takes effect here.
		const configuredLeadSeconds = this.options.preloadLeadSeconds ?? 10;
		if (!this.options.preloadStrategy) {
			this._preloadStrategy = new DefaultPreloadStrategy(configuredLeadSeconds);
		}

		// Cursor-change guard: reset preload/transition flags whenever the active
		// item changes so the next item gets a fresh cycle.
		const onCurrentChange = (): void => {
			this._preloadFired = false;
			this._transitionFired = false;
			this._preloadStrategy.cancel();
			this._transitionStrategy.cancel('cursor-changed');
			this._preloadEpoch += 1;

			if (this._transitionRafHandle !== undefined) {
				cancelAnimationFrame(this._transitionRafHandle);
				this._transitionRafHandle = undefined;
			}
		};
		this.on('current', onCurrentChange);
		this._policyCleanup.push(() => {
			this.off('current', onCurrentChange);
		});

		// Time-driven orchestration: check preload + transition on every time tick.
		const onTimeOrchestration = ({ time }: { time: number }): void => {
			const duration = this._internalDuration;
			const nextItem: BasePlaylistItem | null = this._queueList.peekNext() ?? null;
			const context = { currentTime: time, duration, nextItem };

			// Preload gate.
			if (!this._preloadFired && this._preloadStrategy.shouldPreload(context) && nextItem !== null) {
				this._preloadFired = true;
				_runPreload(this, nextItem, this._preloadStrategy);
			}

			// Transition gate.
			const crossfadeEnabled = this.options.crossfadeEnabled ?? false;
			if (crossfadeEnabled && !this._transitionFired && this._transitionStrategy.shouldTransition(context) && nextItem !== null) {
				this._transitionFired = true;
				const outgoing: BasePlaylistItem | null = this._queueList.current() ?? null;
				if (outgoing !== null) {
					_runTransition(this, outgoing, nextItem);
				}
			}
		};
		this.on('time', onTimeOrchestration);
		this._policyCleanup.push(() => {
			this.off('time', onTimeOrchestration);
		});

		if (this.options.expose === true && typeof window !== 'undefined') {
			Object.assign(window, { player: this });
			this._policyCleanup.push(() => {
				if (Object.is(Reflect.get(window, 'player'), this)) {
					Reflect.deleteProperty(window, 'player');
				}
			});
		}

		if (this.container && typeof this.container.classList !== 'undefined') {
			this.container.classList.add('nomercyplayer', 'paused');
		}

		// Pre-pipeline ceremony: beforeSetup fires synchronously so consumers
		// can attach last-mile listeners before the pipeline actually runs.
		this.emit('beforeSetup');
		_transitionPhase(this, 'setup');

		// Kick off the async pipeline fire-and-forget. `ready()` is the public
		// signal that the pipeline finished — internal `_readyResolve` /
		// `_readyReject` get wired below before the pipeline runs.
		_runSetupPipeline(this);

		return this;
	},

	ready(this: Internals): Promise<void> {
		if (this._readyPromise)
			return this._readyPromise;
		this._readyPromise = new Promise<void>((resolve, reject) => {
			if (this._phase === 'ready') {
				resolve();
				return;
			}
			if (this._phase === 'disposed' || this._phase === 'disposing') {
				reject(stateError('core:player/disposed', 'ready() called after dispose()'));
				return;
			}
			this._readyResolve = resolve;
			this._readyReject = reject;
		});
		return this._readyPromise;
	},

	dispose(this: Internals): void {
		if (this._phase === 'disposed' || this._phase === 'disposing')
			return;
		_transitionPhase(this, 'disposing');
		// Tear down policy subscriptions (visibility / network / wakeLock)
		// BEFORE the disposed phase so handlers see a sensible final state.
		for (const cleanup of this._policyCleanup) {
			try {
				cleanup();
			}
			catch { /* defensive */ }
		}
		this._policyCleanup = [];
		this._readyReject?.(stateError('core:player/disposed', 'dispose() called before ready'));
		this.emit('dispose');
		_transitionPhase(this, 'disposed');
		this.off('all');
	},

	setupState(this: Internals): SetupState {
		switch (this._phase) {
			case 'idle':
				return SetupState.NOT_SETUP;
			case 'setup':
				return SetupState.SETTING_UP;
			case 'disposing':
			case 'disposed':
				return SetupState.DISPOSED;
			default:
				return SetupState.READY;
		}
	},

	phase(this: Internals): PlayerPhase {
		return this._phase;
	},

	dispatching(this: Internals): ReadonlyArray<string> {
		return [...this._dispatchStack];
	},

	/**
	 * Push an event name onto the dispatch stack. Used by the shared
	 * `runDispatchBefore` helper from both kit transport mixins AND
	 * `Plugin.dispatchBefore`. Pairs with `popDispatch`.
	 */
	pushDispatch(this: Internals, name: string): void {
		this._dispatchStack.push(name);
	},

	/** Pop the most recently pushed dispatch name. Returns the popped name or `undefined`. */
	popDispatch(this: Internals): string | undefined {
		return this._dispatchStack.pop();
	},

	/**
	 * Resolved platform bundle. Defaults to `browserPlatform`; consumers swap
	 * via `setup({ platform: capacitorPlatform })`. Lazy fallback during
	 * pre-setup reads.
	 */
	platform(this: Internals): IPlatform {
		return this._platform ?? browserPlatform;
	},
} as const;

const PLAY_STATE_CLASSES: ReadonlyArray<string> = ['playing', 'paused', 'stopped', 'ended', 'loading', 'buffering'] as const;

type ContainerClassRule =
	| { kind: 'swap'; add: string; remove: readonly string[] }
	| { kind: 'drop'; remove: readonly string[] }
	| { kind: 'toggle'; cls: string; payloadKey: string }
	| { kind: 'binary'; whenTrue: string; whenFalse: string; payloadKey: string }
	| { kind: 'phase' };

const CONTAINER_CLASS_RULES: ReadonlyMap<string, ContainerClassRule> = new Map<string, ContainerClassRule>([
	['play', { kind: 'swap', add: 'playing', remove: PLAY_STATE_CLASSES.filter(c => c !== 'playing') }],
	['pause', { kind: 'swap', add: 'paused', remove: PLAY_STATE_CLASSES.filter(c => c !== 'paused') }],
	['stop', { kind: 'swap', add: 'stopped', remove: PLAY_STATE_CLASSES.filter(c => c !== 'stopped') }],
	['ended', { kind: 'swap', add: 'ended', remove: PLAY_STATE_CLASSES.filter(c => c !== 'ended') }],
	['waiting', { kind: 'swap', add: 'buffering', remove: ['playing'] }],
	['stalled', { kind: 'swap', add: 'buffering', remove: ['playing'] }],
	['canplay', { kind: 'drop', remove: ['buffering'] }],
	['mute', { kind: 'toggle', cls: 'muted', payloadKey: 'muted' }],
	['fullscreen', { kind: 'toggle', cls: 'fullscreen', payloadKey: 'active' }],
	['pip', { kind: 'toggle', cls: 'pip', payloadKey: 'active' }],
	['theater', { kind: 'toggle', cls: 'theater', payloadKey: 'active' }],
	['phase', { kind: 'phase' }],
	['activity', { kind: 'binary', whenTrue: 'active', whenFalse: 'inactive', payloadKey: 'active' }],
]);

function _applyContainerClassRule(container: HTMLElement | undefined, rule: ContainerClassRule, data: unknown): void {
	if (!container || typeof container.classList === 'undefined') return;

	if (rule.kind === 'swap') {
		for (const cls of rule.remove) container.classList.remove(cls);
		container.classList.add(rule.add);
		return;
	}

	if (rule.kind === 'drop') {
		for (const cls of rule.remove) container.classList.remove(cls);
		return;
	}

	if (rule.kind === 'toggle') {
		const payload: Record<string, unknown> = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
		container.classList.toggle(rule.cls, Boolean(payload[rule.payloadKey]));
		return;
	}

	if (rule.kind === 'binary') {
		const payload: Record<string, unknown> = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
		const on = Boolean(payload[rule.payloadKey]);
		container.classList.add(on ? rule.whenTrue : rule.whenFalse);
		container.classList.remove(on ? rule.whenFalse : rule.whenTrue);
		return;
	}

	if (rule.kind === 'phase') {
		const phasePayload = typeof data === 'object' && data !== null && 'to' in data
			? (data as { to: PlayerPhase })
			: undefined;
		if (!phasePayload) return;

		if (PLAY_STATE_CLASSES.includes(phasePayload.to)) {
			for (const cls of PLAY_STATE_CLASSES) container.classList.remove(cls);
			container.classList.add(phasePayload.to);
			return;
		}

		if (phasePayload.to === 'ready') {
			for (const cls of PLAY_STATE_CLASSES) container.classList.remove(cls);
			container.classList.add('paused');
		}
	}
}

export const containerClassEmitMethods = {
	emit(this: Internals, event: any, data?: any): void {
		const rule = CONTAINER_CLASS_RULES.get(String(event));
		if (rule) {
			_applyContainerClassRule(this.container, rule, data);
		}
		EventEmitter.prototype.emit.call(this, event, data);
	},
} as const;


function _transitionPhase(self: Internals, next: PlayerPhase): void {
	const from = self._phase;
	if (from === next)
		return;
	self._phase = next;

	self.emit('phase', {
		from,
		to: next,
	});
}

/**
 * Hot-path mutations that skip `beforeMutation` by default — they fire too
 * often to be worth guarding unless the consumer opts in via
 * `setup({ mutationGuards: 'all' })` or names them in a string array.
 */
const HOT_MUTATIONS: ReadonlyArray<string> = ['currentTime', 'volume', 'playbackRate', 'bandwidth', 'recordMetric'] as const;

/**
 * Decide whether a given mutation method should fire `beforeMutation` based on
 * `setup({ mutationGuards })` config:
 *   - `false`        → never fire (fast path)
 *   - `'all'`        → always fire
 *   - `string[]`     → fire for normal-list methods + named hot methods
 *   - `undefined`    → fire for normal-list methods, skip hot list (default)
 */
function _shouldGuardMutation(self: Internals, method: string): boolean {
	const cfg = self.options?.mutationGuards;
	if (cfg === false)
		return false;
	if (cfg === 'all')
		return true;
	const isHot = HOT_MUTATIONS.includes(method);
	if (Array.isArray(cfg)) {
		// Normal mutations always fire when config is a string[] (the array adds hot methods).
		if (!isHot)
			return true;
		return cfg.includes(method);
	}
	// Default: normal mutations fire, hot ones don't.
	return !isHot;
}

/**
 * Synchronously dispatch `beforeMutation` for a mutation method. Returns true
 * if the mutation should proceed, false if a listener cancelled it (in which
 * case `mutationPrevented` was emitted by this helper). Async `delay()` is
 * NOT supported here — mutations are sync by spec and dispatchBefore's full
 * async contract only applies to transport `before*` events.
 *
 * Also auto-fires every `static advisories` entry that matches the method +
 * current phase + currently-dispatching event names. Advisories surface as
 * `info`/`warning`/`error` events with code `plugin:<plugin-id>/<reason>`.
 */
interface _BackendShape {
	play?: () => Promise<void> | void;
	pause?: () => void;
	stop?: () => void;
	load?: (url: string) => Promise<void>;
	currentTime?: (t: number) => void;
	buffered?: () => number;
	bufferedRanges?: () => TimeRanges;
	volume?: (v: number) => void;
	mute?: () => void;
	unmute?: () => void;
	playbackRate?: (rate: number) => void;
}

function _isBackendShape(value: unknown): value is _BackendShape {
	return typeof value === 'object' && value !== null;
}

function _backend(self: Internals): _BackendShape | undefined {
	if (typeof self.backend !== 'function') return undefined;
	const result = self.backend();
	return _isBackendShape(result) ? result : undefined;
}

function _emitBeforeMutation(self: Internals, method: string, args: ReadonlyArray<unknown>): boolean {
	if (!_shouldGuardMutation(self, method))
		return true;

	let prevented = false;
	const evt = {
		get data() {
			return {
				method,
				args,
				phase: self._phase,
				dispatchStack: [...self._dispatchStack],
			};
		},
		set data(_value) { /* immutable for mutation events — args mutate via the method itself */ },
		preventDefault(): void { prevented = true; },
		isDefaultPrevented(): boolean { return prevented; },
		stopImmediatePropagation(): void { /* no-op for mutation guards */ },
		isPropagationStopped(): boolean { return false; },
		delay(): void { /* sync-only — delay is ignored for mutation events */ },
		isDelayed(): boolean { return false; },
	};

	const listeners = self.listenersOf('beforeMutation');
	for (const fn of listeners) {
		try {
			fn(evt);
		}
		catch (err) {
			if (typeof console !== 'undefined' && console.error) {
				console.error(`[beforeMutation:${method}] listener threw:`, err);
			}
		}
	}

	// Spec §C: auto-fire matching advisories. Walk every registered plugin's
	// `static advisories`, match on (method, duringPhase, duringEvent), and
	// emit on the matching severity channel.
	for (const { instance, ctor } of self._plugins) {
		if (!instance.enabled())
			continue;
		const advisories = ctor.advisories;
		if (!advisories)
			continue;
		for (const advisory of advisories) {
			if (advisory.method !== method)
				continue;
			if (advisory.duringPhase !== undefined) {
				const phases = Array.isArray(advisory.duringPhase) ? advisory.duringPhase : [advisory.duringPhase];
				if (!phases.includes(self._phase))
					continue;
			}
			if (advisory.duringEvent !== undefined) {
				const events = Array.isArray(advisory.duringEvent) ? advisory.duringEvent : [advisory.duringEvent];
				const inFlight = self._dispatchStack;
				if (!events.some(e => inFlight.includes(e)))
					continue;
			}
			const code = `plugin:${ctor.id}/${advisory.reason}`;
			const errorPayload = {
				error: new PluginError({
					code,
					severity: advisory.severity,
					scope: {
						kind: 'plugin',
						id: ctor.id,
					},
					message: advisory.message,
					context: {
						method,
						args,
						phase: self._phase,
					},
				}),
				severity: advisory.severity,
				scope: {
					kind: 'plugin',
					id: ctor.id,
				},
				timestamp: Date.now(),
				markHandled: () => {},
				isHandled: () => false,
				stopImmediatePropagation: () => {},
				isPropagationStopped: () => false,
				preventDefault: () => {},
				isDefaultPrevented: () => false,
			};
			self.emit(advisory.severity, errorPayload);
		}
	}

	if (prevented) {
		self.emit('mutationPrevented', {
			method,
			reason: 'listener-prevented',
		});
		return false;
	}
	return true;
}

/**
 * Wrap a synchronous seek action with a `seeking` phase round-trip. Per spec
 * §D, the player enters `seeking` while a seek is in flight and returns to
 * the prior phase (`playing` / `paused`) once resolved. With no real backend
 * the seek "resolves" immediately — when a backend lands, this helper grows
 * to await the backend's `seeked` callback.
 *
 * Phase transitions happen ONLY when the prior phase is `playing` or
 * `paused` — seeks during `setup`/`ready` (e.g. consumer pre-seeking before
 * play) skip the round-trip to avoid noisy `seeking` blips.
 */
function _seekingTransition(self: Internals, doSeek: () => void): void {
	const prior = self._phase;
	const shouldTransition = prior === 'playing' || prior === 'paused' || prior === 'starting';
	if (shouldTransition) {
		_transitionPhase(self, 'seeking');
	}
	doSeek();
	if (shouldTransition) {
		_transitionPhase(self, prior);
	}
}

/**
 * Run a setup stage. Emits the success event on completion; on failure emits
 * the matching `<stage>Error` event AND a severity-tier `error`/`fatal` event,
 * then re-throws so the pipeline driver can bail.
 */
async function _runStage(
	self: Internals,
	stage: string,
	errorEvent: string,
	work: () => void | Promise<void>,
	successPayload?: unknown,
): Promise<void> {
	try {
		await work();
		if (successPayload !== undefined) {
			self.emit(stage, successPayload);
		}
		else {
			self.emit(stage);
		}
	}
	catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		const payload = {
			error,
			severity: 'error' as const,
			scope: { kind: 'core' as const },
			timestamp: Date.now(),
			markHandled: () => {},
			isHandled: () => false,
			stopImmediatePropagation: () => {},
			isPropagationStopped: () => false,
			preventDefault: () => {},
			isDefaultPrevented: () => false,
		};
		self.emit(errorEvent, payload);
		self.emit('error', payload);
		throw err;
	}
}

/**
 * Drives the async setup pipeline. Each stage runs in order; failure short-
 * circuits the rest. Plugin queue is drained during `pluginsRegistering`,
 * with each plugin's `use()` bounded by `pluginInitTimeoutMs` (default 30s).
 *
 * Pipeline event order (spec §14):
 *   setupStart → configResolved → pluginsRegistering → pluginsRegistered →
 *   streamsReady → authReady → playlistResolving? → playlistReady →
 *   mediaReady → ready
 */
function _runSetupPipeline(self: Internals): void {
	const pipeline = async (): Promise<void> => {
		try {
			await _runStage(self, 'setupStart', 'setupStartError', () => {}, { container: self.container });
			await _runStage(self, 'configResolved', 'configResolvedError', () => {}, { config: self.options });
			await _runStage(self, 'pluginsRegistering', 'pluginsRegisteringError', async () => {
				// Drain the queue. New plugins added during a `use()` (rare) get
				// processed in the same pass — splicing the array catches them.
				const timeoutMs = self.options.pluginInitTimeoutMs ?? 30_000;
				while (self._pluginQueue.length > 0) {
					const entry = self._pluginQueue.shift()!;
					await _registerPlugin(self, entry.ctor, entry.opts, timeoutMs);
				}
			});
			await _runStage(self, 'pluginsRegistered', 'pluginsRegisteredError', () => {});
			await _runStage(self, 'streamsReady', 'streamsReadyError', () => {
				// Spec §I: kit defaults (native + hls) auto-register here.
				// Resolution order is most-recent-first; pushing native first so
				// HLS (registered after) wins when a URL matches both.
				const reg = _ensureStreamRegistry(self);
				reg.register(nativeFactory);
				reg.register(hlsFactory);
			});
			await _runStage(self, 'authReady', 'authReadyError', () => {});

			// Playlist stage — spec §14 says fire `playlistReady` with `length: 0`
			// even when no playlist is configured. URL form (string) is reserved
			// for §L impl; for now treat any non-string as inline.
			const playlist = self.options.playlist;
			if (typeof playlist === 'string') {
				self.emit('playlistResolving', { url: playlist });
				// Fetch+parse lands with §L; emit ready with length 0 for now.
				self.emit('playlistReady', { length: 0 });
			}
			else if (Array.isArray(playlist)) {
				self.emit('playlistReady', { length: playlist.length });
			}
			else {
				self.emit('playlistReady', { length: 0 });
			}

			await _runStage(self, 'mediaReady', 'mediaReadyError', () => {});

			_transitionPhase(self, 'ready');
			self.emit('ready');
			self._readyResolve?.();
		}
		catch (err) {
			self._readyReject?.(err);
		}
	};

	// Eager start, fire-and-forget. The promise itself is captured by `ready()`
	// via `_readyResolve` / `_readyReject` wiring set up before the pipeline runs.
	void pipeline();
}

/**
 * Find every plugin (registered OR queued) whose `static requires` includes
 * the given id. Returns plugin ids in dependency-tree order (caller is the
 * leaf, deepest dependent first). Used by `removePlugin` to enforce the
 * has-dependents rule and by `_cascadeDisable` to walk the reverse graph.
 */
function _findDependents(self: Internals, id: string): string[] {
	const directDependents: string[] = [];

	const requiresId = (ctor: PluginCtorWithId, target: string): boolean => {
		const requires = ctor.requires ?? [];
		for (const spec of requires) {
			const requiredCtor: PluginCtorWithId = typeof spec === 'function' ? spec : spec.plugin;
			if (requiredCtor.id === target)
				return true;
		}
		return false;
	};

	for (const { ctor } of self._plugins) {
		if (ctor.id === id)
			continue;
		if (requiresId(ctor, id))
			directDependents.push(ctor.id);
	}
	for (const { ctor } of self._pluginQueue) {
		if (ctor.id === id)
			continue;
		if (requiresId(ctor, id))
			directDependents.push(ctor.id);
	}

	// Recurse to find indirect dependents.
	const collected: string[] = [];
	for (const dep of directDependents) {
		const indirect = _findDependents(self, dep);
		// Indirect dependents come BEFORE the direct one (deepest-first).
		for (const i of indirect) {
			if (!collected.includes(i))
				collected.push(i);
		}
		if (!collected.includes(dep))
			collected.push(dep);
	}
	return collected;
}

/**
 * Disable every plugin that transitively depends on `failedId`, with reason
 * `reason`. Used when a dependency's `use()` rejects or it gets explicitly
 * disabled via `disable()` from a cascade upstream.
 */
function _cascadeDisable(self: Internals, failedId: string, reason: string): void {
	const dependents = _findDependents(self, failedId);
	for (const depId of dependents) {
		const entry = self._plugins.find(p => p.ctor.id === depId);
		if (!entry)
			continue;
		if (!entry.instance.enabled())
			continue; // already disabled
		try {
			entry.instance.disable(reason);
		}
		catch { /* defensive */ }
	}
}

/**
 * Register a single plugin: instantiate, initialize, merge static translations,
 * await `use()` (bounded by timeout), push onto the registered list, emit
 * `plugin:installed`. Failures emit `plugin:failed`, mark plugin disabled, and
 * do NOT block the rest of the pipeline.
 */
async function _registerPlugin(
	self: Internals,
	ctor: PluginCtorWithId,
	opts: unknown,
	timeoutMs: number,
): Promise<void> {
	const id = ctor.id;
	if (self._plugins.some(p => p.ctor.id === id)) {
		// Already registered (post-setup `addPlugin` checks this earlier; queue
		// drain double-checks defensively).
		return;
	}

	type _InstantiableCtor = new () => Plugin;
	const lifecycle = new LifecycleRegistry();
	let instance: Plugin;
	try {
		instance = new (ctor as unknown as _InstantiableCtor)();
		instance.initialize(self as unknown as IPlayer<BaseEventMap>, opts, lifecycle);
	}
	catch (err) {
		// Hard failure during construction / initialize — surface and bail.
		self.emit('plugin:failed', {
			id,
			error: err instanceof Error ? err : new Error(String(err)),
		});
		throw err;
	}

	// Walk the prototype chain so EVERY ancestor's `static translations`
	// gets registered, not just the subclass's. Without this, declaring
	// `static translations` on a subclass shadows the parent's static and
	// the parent's bundle is silently dropped. Subclasses ship ONLY their
	// own keys; the kit composes the chain.
	//
	// Each ancestor's bundle can be either eager (pre-resolved keys for
	// every language) OR lazy (the `LAZY_TRANSLATIONS_MARKER` is stamped
	// by `translationsFromGlob` when modules are function loaders). For
	// lazy bundles we ONLY fetch the active language + its BCP-47 parent
	// chain — Chinese never enters memory when the user wants Dutch.
	{
		const stack: Translations[] = [];
		let cur: unknown = ctor;
		while (cur && cur !== Function.prototype) {
			if (Object.prototype.hasOwnProperty.call(cur, 'translations')) {
				const withT = cur as { translations?: Translations };
				if (withT.translations) stack.unshift(withT.translations);
			}
			cur = Object.getPrototypeOf(cur);
		}
		const currentLang = String(self.language());
		const langChain = bcp47FallbackChain(currentLang);
		// Apply base → subclass so subclass keys override on collision.
		for (const t of stack) {
			const lazy = getLazyTranslationLoader(t);
			if (lazy) {
				// Lazy: load only the active language + parents. Static-translation
				// bundles ship keys with the `plugin.<id>.` prefix already
				// applied (matching the eager path) — we DO NOT re-namespace
				// here, otherwise keys end up as `plugin.<id>.plugin.<id>.foo`.
				for (const tag of langChain) {
					const bundle = await lazy(tag);
					if (!bundle)
						continue;
					self.addTranslations({ [tag]: bundle });
					_markPluginLangLoaded(self, id, tag);
				}
			}
			else {
				// Eager: register the whole bundle as before.
				self.addTranslations(t);
			}
		}
	}

	// Await `use()` with timeout. Per spec, a plugin failure does NOT block the
	// player from reaching `ready` — the plugin is marked failed and skipped.
	let useFailed = false;
	let useError: unknown;
	try {
		const result = instance.use();
		if (result instanceof Promise) {
			let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
			const timeout = new Promise<never>((_, reject) => {
				timeoutHandle = setTimeout(
					() => reject(stateError('core:plugin/init-timeout', `Plugin "${id}" use() exceeded ${timeoutMs}ms`, {
						id,
						timeoutMs,
					})),
					timeoutMs,
				);
			});
			try {
				await Promise.race([result, timeout]);
			}
			finally {
				if (timeoutHandle)
					clearTimeout(timeoutHandle);
			}
		}
	}
	catch (err) {
		useFailed = true;
		useError = err;
	}

	if (useFailed) {
		// Soft-fail: dispose the partially-initialised instance so any DOM
		// mounted before the throw is removed, then emit plugin:failed and
		// cascade. Do NOT push onto _plugins — a plugin whose use() threw is
		// not usable and removePlugin would double-dispose it.
		try { instance.dispose(); }
		catch { /* defensive */ }
		try { lifecycle.dispose(); }
		catch { /* defensive */ }
		const failPayload = {
			id,
			error: useError instanceof Error ? useError : new Error(String(useError)),
		};
		self.emit('plugin:failed', failPayload);
		self.emit(`plugin:${id}:failed`, failPayload);
		// Spec §C cascade: every plugin transitively depending on this one
		// gets disabled with reason `dep-failed:<id>`.
		_cascadeDisable(self, id, `dep-failed:${id}`);
		return;
	}

	self._plugins.push({
		instance,
		lifecycle,
		ctor,
	});
	const installedPayload = {
		id,
		version: ctor.version,
	};
	self.emit('plugin:installed', installedPayload);
	self.emit(`plugin:${id}:installed`, installedPayload);
}

function _assertReady(self: Internals): void {
	if (self._phase === 'idle') {
		throw stateError('core:player/not-ready', 'Player has not been setup() yet.');
	}
	if (self._phase === 'disposed' || self._phase === 'disposing') {
		throw stateError('core:player/disposed', 'Player has been disposed.');
	}
}

/**
 * Thin adapter around the shared `runDispatchBefore` helper that resolves the
 * per-call `timeoutMs` from the player's `beforeEventTimeoutMs` config so the
 * kit and `Plugin.dispatchBefore` apply the same default.
 */
async function _dispatchBefore<TData>(self: Internals, beforeEvent: string, data: TData): Promise<{ data: TData; prevented: boolean; reason?: 'listener-prevented' | 'delay-rejected' | 'delay-timeout'; cause?: unknown }> {
	const timeoutMs = self.options?.beforeEventTimeoutMs;
	return runDispatchBefore<TData>(self, beforeEvent, data, timeoutMs !== undefined ? { timeoutMs } : undefined);
}

// ──────────────────────────────────────────────────────────────────────────
// Mixin: base URL + audio context
// ──────────────────────────────────────────────────────────────────────────

export const baseUrlAudioContextMethods = {
	baseUrl(this: Internals, url?: string): string | undefined | void {
		if (url === undefined)
			return this._baseUrl;
		this._baseUrl = url;
	},
	audioContext(this: Internals): AudioContext | undefined {
		return this._audioContext;
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: experimental override surface (descriptor with a getter)
// ──────────────────────────────────────────────────────────────────────────

export const experimentalDescriptor = {
	get experimental(): PlayerExperimental {
		const self = this as unknown as Internals;
		const overrides = self._overrides;
		const player: Record<string, unknown> = self as unknown as Record<string, unknown>;
		const getOriginals = (): Map<string, ((...args: unknown[]) => unknown) | undefined> => {
			let originals = self._overrideOriginals;
			if (!originals) {
				originals = new Map<string, ((...args: unknown[]) => unknown) | undefined>();
				self._overrideOriginals = originals;
			}
			return originals;
		};
		const restoreInstanceMethod = (method: string): void => {
			const originals = getOriginals();
			const orig = originals.get(method);
			if (orig) {
				Object.defineProperty(player, method, {
					value: orig,
					writable: true,
					configurable: true,
				});
			}
			else {
				delete player[method];
			}
			originals.delete(method);
		};
		return {
			override: <K extends string>(method: K, fn: (...args: unknown[]) => unknown): (() => void) => {
				const originals = getOriginals();
				if (!originals.has(method)) {
					// Resolve original via the prototype chain so we capture the
					// mixin-installed method. If the instance already owns the
					// property (unlikely for kit-composed methods), we still capture
					// whatever `player[method]` resolves to today.
					const raw: unknown = player[method];
					const typed: ((...args: unknown[]) => unknown) | undefined = typeof raw === 'function' ? raw as (...args: unknown[]) => unknown : undefined;
					originals.set(method, typed);
				}
				overrides.set(method, {
					fn,
					by: 'consumer',
				});
				Object.defineProperty(player, method, {
					value: (...args: unknown[]) => {
						const entry = overrides.get(method);
						if (entry)
							return entry.fn.apply(self, args);
						const orig = getOriginals().get(method);
						return orig?.apply(self, args);
					},
					writable: true,
					configurable: true,
				});
				return () => {
					if (overrides.get(method)?.fn === fn) {
						overrides.delete(method);
						restoreInstanceMethod(method);
					}
				};
			},
			restore: (method: string): void => {
				if (!overrides.has(method))
					return;
				overrides.delete(method);
				restoreInstanceMethod(method);
			},
			overrides: (): Array<{ method: string; by: string | 'consumer' }> => {
				return Array.from(overrides.entries()).map(([method, { by }]) => ({
					method,
					by,
				}));
			},
		};
	},
};

// ──────────────────────────────────────────────────────────────────────────
// Mixin: i18n
// ──────────────────────────────────────────────────────────────────────────

function _ensureTranslator(self: Internals): ITranslator {
	if (!self._translator)
		self._translator = new DefaultTranslator();
	return self._translator;
}

/**
 * Per-player set of plugin-id|lang pairs whose runtime translation bundle has
 * already been loaded. Prevents `loadTranslations` from being invoked twice
 * for the same plugin+language pair when consumers call `setLanguage` repeatedly.
 */
const _pluginLangLoaded = new WeakMap<Internals, Set<string>>();

function _markPluginLangLoaded(self: Internals, pluginId: string, lang: string): void {
	let set = _pluginLangLoaded.get(self);
	if (!set) {
		set = new Set();
		_pluginLangLoaded.set(self, set);
	}
	set.add(`${pluginId}::${lang}`);
}

function _hasPluginLangLoaded(self: Internals, pluginId: string, lang: string): boolean {
	return _pluginLangLoaded.get(self)?.has(`${pluginId}::${lang}`) ?? false;
}

type _LoadTranslationsFn = (lang: string) => Promise<Record<string, string> | undefined>;

function _getLoadTranslations(instance: unknown): _LoadTranslationsFn | undefined {
	if (typeof instance !== 'object' || instance === null)
		return undefined;
	if (!('loadTranslations' in instance))
		return undefined;
	const fn: unknown = (instance as { loadTranslations: unknown }).loadTranslations;
	return typeof fn === 'function' ? (fn as _LoadTranslationsFn) : undefined;
}

export const i18nMethods = {
	t(this: Internals, key: string, vars?: Record<string, string>): string {
		return _ensureTranslator(this).t(key, vars);
	},
	language(this: Internals, lang?: string): string | Promise<void> {
		if (lang === undefined) return _ensureTranslator(this).language();
		return (async () => {
			await _ensureTranslator(this).language(lang);
			// Walk the BCP-47 chain on language switch — `pt-BR` triggers loads
			// for both `pt-BR` and `pt`, so regional variants get the parent
			// bundle in memory as natural fallback.
			const langChain = bcp47FallbackChain(lang);

			for (const { instance, ctor } of this._plugins) {
				const pluginId = ctor.id;

				// (1) Lazy `static translations` chain — pull bundles for every
				// tag in the BCP-47 chain that hasn't been loaded yet. Walks the
				// prototype chain so subclass + base lazy bundles both get hit.
				let cur: unknown = ctor;
				while (cur && cur !== Function.prototype) {
					if (Object.prototype.hasOwnProperty.call(cur, 'translations')) {
						const withT = cur as { translations?: Translations };
						const lazy = withT.translations ? getLazyTranslationLoader(withT.translations) : undefined;
						if (lazy) {
							for (const tag of langChain) {
								if (_hasPluginLangLoaded(this, pluginId, tag))
									continue;
								try {
									const bundle = await lazy(tag);
									_markPluginLangLoaded(this, pluginId, tag);
									if (!bundle)
										continue;
									// Static bundles include the `plugin.<id>.` prefix already.
									this.addTranslations({ [tag]: bundle });
								}
								catch (err) {
									if (typeof console !== 'undefined' && console.error) {
										console.error(`[language] plugin "${pluginId}" lazy translations threw:`, err);
									}
								}
							}
						}
					}
					cur = Object.getPrototypeOf(cur);
				}

				// (2) Spec §U: instance-level `loadTranslations(lang)` hook —
				// runtime sources (CDN, dynamic JSON). Per-plugin+lang dedupe.
				// loadTranslations is protected — reflect via unknown to bypass visibility without widening to any.
				const hook = _getLoadTranslations(instance);
				if (typeof hook !== 'function')
					continue;
				if (_hasPluginLangLoaded(this, pluginId, lang))
					continue;
				try {
					const bundle = await hook.call(instance, lang);
					_markPluginLangLoaded(this, pluginId, lang);
					if (!bundle)
						continue;
					const namespaced: Record<string, string> = {};
					for (const [key, value] of Object.entries(bundle)) {
						namespaced[`plugin.${pluginId}.${key}`] = value;
					}
					this.addTranslations({ [lang]: namespaced });
				}
				catch (err) {
					if (typeof console !== 'undefined' && console.error) {
						console.error(`[language] plugin "${pluginId}".loadTranslations threw:`, err);
					}
				}
			}
		})();
	},
	addTranslations(this: Internals, bundle: Translations): void {
		_ensureTranslator(this).addTranslations(bundle);
	},
	/**
	 * Read or write a single translation key.
	 *
	 * `translation(lang, key)` — returns the resolved translation string for
	 * the given language and key, or the key itself when no value is found.
	 *
	 * `translation(lang, key, value)` — set a single key under a single
	 * language. Persists for the player's lifetime.
	 */
	translation(this: Internals, lang: string, key: string, value?: string): string | undefined | void {
		if (value === undefined) {
			return _ensureTranslator(this).translation(lang, key);
		}
		_ensureTranslator(this).translation(lang, key, value);
	},
	removeTranslations(this: Internals, prefix: string, lang?: string): void {
		_ensureTranslator(this).removeTranslations(prefix, lang);
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: cue parser registry
// ──────────────────────────────────────────────────────────────────────────

export const cueParserMethods = {
	registerCueParser(this: Internals, parser: CueParser, prepend?: boolean): void {
		this._cueParsers.register(parser, prepend);
	},
	unregisterCueParser(this: Internals, id: string): void {
		this._cueParsers.unregister(id);
	},
	resolveCueParser(this: Internals, url: string): CueParser | undefined {
		return this._cueParsers.resolve(url);
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: transport
// ──────────────────────────────────────────────────────────────────────────

export const transportMethods = {
	async play(this: Internals, opts: ActionOptions = {}): Promise<void> {
		_assertReady(this);
		const result = await _dispatchBefore<ActionOptions>(this, 'beforePlay', { ...opts });
		if (result.prevented) {
			this.emit('playPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}
		this._playState = 'playing';
		if (this._phase === 'ready' || this._phase === 'paused') {
			_transitionPhase(this, 'starting');
		}
		this.emit('play', result.data);

		await _backend(this)?.play?.();
	},

	async pause(this: Internals, opts: ActionOptions = {}): Promise<void> {
		_assertReady(this);
		const result = await _dispatchBefore<ActionOptions>(this, 'beforePause', { ...opts });
		if (result.prevented) {
			this.emit('pausePrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}
		this._playState = 'paused';
		if (this._phase === 'playing' || this._phase === 'starting') {
			_transitionPhase(this, 'paused');
		}
		this.emit('pause', result.data);

		_backend(this)?.pause?.();
	},

	async stop(this: Internals, opts: ActionOptions = {}): Promise<void> {
		_assertReady(this);
		const result = await _dispatchBefore<ActionOptions>(this, 'beforeStop', { ...opts });
		if (result.prevented) {
			this.emit('stopPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}
		this._playState = 'stopped';
		_transitionPhase(this, 'stopped');
		this.emit('stop', result.data);

		_backend(this)?.stop?.();
	},

	async togglePlayback(this: Internals, opts?: ActionOptions): Promise<void> {
		_assertReady(this);
		if (this._playState === 'playing')
			await this.pause(opts);
		else await this.play(opts);
	},

	async next(this: Internals, opts: ActionOptions = {}): Promise<void> {
		_assertReady(this);
		const result = await _dispatchBefore<ActionOptions>(this, 'beforeNext', { ...opts });
		if (result.prevented) {
			this.emit('nextPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}

		const nextItem = this._queueList.peekNext();
		if (!nextItem) {
			this.emit('queue:exhausted');
			return;
		}

		this.emit('next', result.data);

		await this.load(nextItem, { source: result.data?.source });
		void this.play({ source: result.data?.source });
	},

	async previous(this: Internals, opts: ActionOptions = {}): Promise<void> {
		_assertReady(this);
		const result = await _dispatchBefore<ActionOptions>(this, 'beforePrevious', { ...opts });
		if (result.prevented) {
			this.emit('previousPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}

		const prevItem = this._queueList.peekPrevious();
		if (!prevItem) {
			return;
		}

		this.emit('previous', result.data);

		await this.load(prevItem, { source: result.data?.source });
		void this.play({ source: result.data?.source });
	},

	async rewind(this: Internals, seconds = 5, opts: ActionOptions = {}): Promise<void> {
		_assertReady(this);
		const result = await _dispatchBefore<{ time: number; source?: string }>(this, 'beforeSeek', {
			time: -seconds,
			source: opts.source,
		});
		if (result.prevented) {
			this.emit('seekPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}
		_seekingTransition(this, () => {
			this._internalCurrentTime = Math.max(0, this._internalCurrentTime - seconds);
			this.emit('seek', {
				time: this._internalCurrentTime,
				source: result.data.source,
			});
		});

		_backend(this)?.currentTime?.(this._internalCurrentTime);

		this.emit('seeked', { time: this._internalCurrentTime });
	},

	async forward(this: Internals, seconds = 5, opts: ActionOptions = {}): Promise<void> {
		_assertReady(this);
		const result = await _dispatchBefore<{ time: number; source?: string }>(this, 'beforeSeek', {
			time: seconds,
			source: opts.source,
		});
		if (result.prevented) {
			this.emit('seekPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}
		_seekingTransition(this, () => {
			this._internalCurrentTime = this._internalCurrentTime + seconds;
			this.emit('seek', {
				time: this._internalCurrentTime,
				source: result.data.source,
			});
		});

		_backend(this)?.currentTime?.(this._internalCurrentTime);

		this.emit('seeked', { time: this._internalCurrentTime });
	},

	async restart(this: Internals, opts: ActionOptions = {}): Promise<void> {
		_assertReady(this);
		const seekResult = await _dispatchBefore<{ time: number; source?: string }>(this, 'beforeSeek', {
			time: 0,
			source: opts.source,
		});
		if (seekResult.prevented) {
			// If the seek-to-zero was cancelled, restart is also cancelled — emit
			// a `seekPrevented` event and bail; do NOT play unconditionally.
			this.emit('seekPrevented', {
				reason: seekResult.reason ?? 'listener-prevented',
				cause: seekResult.cause,
			});
			return;
		}
		_seekingTransition(this, () => {
			this._internalCurrentTime = 0;
			this.emit('seek', {
				time: 0,
				source: seekResult.data.source,
			});
		});
		// Spec §P4-V1: emit `seeked` after the seek-to-zero settles.
		this.emit('seeked', { time: 0 });
		await this.play(opts);
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: time / position
// ──────────────────────────────────────────────────────────────────────────

function _emptyTimeRanges(): TimeRanges {
	return { length: 0, start: (): number => 0, end: (): number => 0 } as unknown as TimeRanges;
}

export const timeMethods = {
	currentTime(this: Internals, t?: number, opts: ActionOptions = {}): number | Promise<void> {
		if (t === undefined) return this._internalCurrentTime;
		const target = Math.max(0, t);
		// Async setter — returns Promise<void> so callers can await delay() resolution.
		return (async () => {
			const result = await _dispatchBefore<{ time: number; source?: string }>(this, 'beforeSeek', {
				time: target,
				source: opts.source,
			});
			if (result.prevented) {
				this.emit('seekPrevented', {
					reason: result.reason ?? 'listener-prevented',
					cause: result.cause,
				});
				return;
			}
			_seekingTransition(this, () => {
				this._internalCurrentTime = Math.max(0, result.data.time);
				this.emit('seek', {
					time: this._internalCurrentTime,
					source: result.data.source,
				});
			});

			_backend(this)?.currentTime?.(this._internalCurrentTime);

			this.emit('seeked', { time: this._internalCurrentTime });
		})();
	},

	duration(this: Internals): number {
		return this._internalDuration;
	},
	buffered(this: Internals): number {
		return _backend(this)?.buffered?.() ?? 0;
	},
	bufferedRanges(this: Internals): TimeRanges {
		return _backend(this)?.bufferedRanges?.() ?? _emptyTimeRanges();
	},
	seekable(this: Internals): TimeRanges {
		return _emptyTimeRanges();
	},
	timeData(this: Internals): TimeState {
		const position = this._internalCurrentTime;
		const duration = this.duration();
		const buffered = this.buffered();
		return {
			position,
			duration,
			buffered,
			remaining: Math.max(0, duration - position),
			percentage: duration > 0 ? (position / duration) * 100 : 0,
		};
	},

	/**
	 * Seek to a position expressed as a percentage (0–100) of the total duration.
	 *
	 * `pct` is clamped to [0, 100]. No-op when duration is zero or non-finite
	 * (metadata not yet loaded). Delegates to `currentTime(duration * pct / 100)`.
	 * V1 parity — mirrors `seekByPercentage(pct)` on the v1 player surface.
	 */
	seekByPercentage(this: Internals, pct: number, opts?: ActionOptions): void {
		const clamped = Math.max(0, Math.min(100, pct));
		const d = this.duration();
		if (!Number.isFinite(d) || d <= 0) return;
		const ret = this.currentTime(d * clamped / 100, opts);
		if (ret instanceof Promise)
			void ret;
	},

	playbackRate(this: Internals, rate?: number): number | void {
		if (rate === undefined)
			return this._playbackRate;
		this._playbackRate = rate;
		this.emit('backend:ratechange', { rate });

		_backend(this)?.playbackRate?.(rate);
	},
	playbackRates(this: Internals): number[] {
		return [0.5, 0.75, 1, 1.25, 1.5, 2];
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: volume
// ──────────────────────────────────────────────────────────────────────────

export const volumeMethods = {
	volume(this: Internals, v?: number): number | void {
		if (v === undefined) {
			return this._volumeState === 'muted' ? 0 : this._internalVolume;
		}
		if (!_emitBeforeMutation(this, 'volume', [v]))
			return;
		this._internalVolume = Math.max(0, Math.min(1, v));
		if (this._volumeState !== 'muted') {
			this._volumeBeforeMute = this._internalVolume;
		}
		this.emit('volume', { level: this._internalVolume });

		_backend(this)?.volume?.(this._internalVolume);
	},
	mute(this: Internals): void {
		if (this._volumeState === 'muted')
			return;
		this._volumeBeforeMute = this._internalVolume;
		this._volumeState = 'muted';
		this.emit('mute', { muted: true });

		_backend(this)?.mute?.();
	},
	unmute(this: Internals): void {
		if (this._volumeState === 'unmuted')
			return;
		this._volumeState = 'unmuted';
		this._internalVolume = this._volumeBeforeMute;
		this.emit('mute', { muted: false });

		_backend(this)?.unmute?.();
	},
	toggleMute(this: Internals): void {
		if (this._volumeState === 'muted')
			this.unmute();
		else this.mute();
	},
	volumeUp(this: Internals, step = 0.05): void {
		this.volume(this._internalVolume + step);
	},
	volumeDown(this: Internals, step = 0.05): void {
		this.volume(this._internalVolume - step);
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: state-enum read accessors. Subclasses override only when they need
// to type the return value as the library's own enum.
// ──────────────────────────────────────────────────────────────────────────

export const stateMethods = {
	playState(this: Internals): PlayStateToken {
		return this._playState;
	},
	volumeState(this: Internals): VolumeStateToken {
		return this._volumeState;
	},
	repeatState(this: Internals, state?: RepeatStateToken): RepeatStateToken | void {
		if (state === undefined)
			return this._repeatState;
		this._repeatState = state;
		this.emit('repeat', { state });
	},
	shuffleState(this: Internals, state?: ShuffleStateToken | boolean): ShuffleStateToken | void {
		if (state === undefined)
			return this._shuffleState;
		const next = typeof state === 'boolean' ? (state ? 'on' : 'off') : state;
		this._shuffleState = next;
		this.emit('shuffle', { state: next });
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: shared buffer / network / stream / visibility / quality / audioTrack
// state reads. Both NMMusicPlayer and NMVideoPlayer exhibit these identically.
// The per-library `_backend` is accessed via `_peekBackend` so this mixin is
// backend-agnostic and does not need to know whether it runs in a music or
// video context.
// ──────────────────────────────────────────────────────────────────────────

interface _BackendWithState { state?: () => string }
interface _BackendWithSetQuality { setQuality?: (idx: number | 'auto') => void }
interface _BackendWithSetAudioTrack { setAudioTrack?: (idx: number) => void }
interface _BackendWithSubtitleTracks {
	setSubtitleTrack?: (idx: number | null) => void;
	subtitleTracks?: () => SubtitleTrack[];
}
interface _BackendWithAudioTrack { setAudioTrack?: (idx: number) => void }
interface _BackendWithQualityLevels { qualityLevels?: (opts?: { includeUnsupported?: true }) => unknown }
interface _BackendWithSetQualityLevel { setQuality?: (idx: number | 'auto') => void }
interface _BackendWithAudioTracks { audioTracks?: () => unknown }
interface _BackendWithMediaElement { mediaElement?: () => HTMLMediaElement & { setSinkId?: (id: string) => Promise<void>; sinkId?: string } }

function _peekBackendTyped<S extends object>(self: Internals): S | undefined {
	return _peekBackend(self) as S | undefined;
}

export const playerStateMethods = {
	bufferState(this: Internals): BufferState {
		const backend = _peekBackendTyped<_BackendWithState>(this);
		switch (backend?.state?.()) {
			case 'loading': return BufferState.LOADING;
			case 'seeking': return BufferState.SEEKING;
			case 'stalled': return BufferState.STALLED;
			default: return BufferState.IDLE;
		}
	},

	networkState(this: Internals): NetworkState {
		const monitor = this._platform?.network;
		if (!monitor)
			return NetworkState.ONLINE;
		if (!monitor.isOnline())
			return NetworkState.OFFLINE;
		const downlink = monitor.downlinkMbps?.();
		if (typeof downlink === 'number' && downlink > 0 && downlink < 1.5)
			return NetworkState.SLOW;
		return NetworkState.ONLINE;
	},

	streamState(this: Internals): string {
		const backend = _peekBackendTyped<_BackendWithState>(this);
		if (!backend)
			return 'idle';
		return backend.state?.() ?? 'idle';
	},

	visibilityState(this: Internals): VisibilityState {
		const visible = this._platform?.visibility?.isVisible() ?? true;
		return visible ? VisibilityState.VISIBLE : VisibilityState.HIDDEN;
	},

	qualityState(this: Internals, target?: number | 'auto'): QualityState | void {
		if (target === undefined)
			return this._qualityState;
		this._qualityState = target === 'auto' ? QualityState.AUTO : QualityState.MANUAL;
		const backend = _peekBackendTyped<_BackendWithSetQuality>(this);
		backend?.setQuality?.(target);
		this.emit('qualityState', { state: this._qualityState });
	},

	audioTrackState(this: Internals, idx?: number): AudioTrackState | void {
		if (idx === undefined)
			return this._audioTrackState;
		this._audioTrackState = AudioTrackState.MANUAL;
		const backend = _peekBackendTyped<_BackendWithSetAudioTrack>(this);
		backend?.setAudioTrack?.(idx);
		this.emit('audioTrackState', { state: this._audioTrackState });
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: queue + cursor + backlog (delegates to MediaList<T>)
// ──────────────────────────────────────────────────────────────────────────

function _wireQueue(self: Internals): void {
	if (self._queueWired)
		return;
	self._queueWired = true;

	self._queueList.on('change', ({ items }) => self.emit('queue', items));
	self._queueList.on('append', data => self.emit('queue:append', data));
	self._queueList.on('prepend', data => self.emit('queue:prepend', data));
	self._queueList.on('insert', data => self.emit('queue:insert', data));
	self._queueList.on('remove', data => self.emit('queue:remove', data));
	self._queueList.on('move', data => self.emit('queue:move', data));
	self._queueList.on('clear', data => self.emit('queue:clear', data));
	self._queueList.on('shuffle', () => self.emit('queue:shuffle'));
	self._queueList.on('sort', () => self.emit('queue:sort'));
	self._queueList.on('current', (data) => {
		// Item changed → drop any in-flight sidecar subtitle context
		// (its CueTracker is bound to the old item's time stream and
		// would emit stale cues against the new media). Renderers will
		// receive a fresh `subtitleCue` event when the next selection
		// happens (via `currentSubtitle` from a UI / preferences plugin).
		_disposeSidecarSubtitle(self);
		self.emit('current', data);

		// Ensure chapter data is populated for the new item and announce it.
		// Fire-and-forget: load() already calls _resolveItemTrackUrls before
		// moving the cursor, so this is a no-op for the initial load path.
		// For cursor-only switches (player.current(i), next, previous) where
		// load() was never called for that item, this is the only trigger.
		void _resolveAndEmitChapters(self, data.item?.id);
	});

	self._backlogList.on('change', ({ items }) => self.emit('backlog', items));
	self._backlogList.on('append', data => self.emit('backlog:append', data));
	self._backlogList.on('remove', data => self.emit('backlog:remove', data));
	self._backlogList.on('clear', data => self.emit('backlog:clear', data));
}

export const queueMethods = {
	queue(this: Internals, items?: BasePlaylistItem[], _opts?: ActionOptions): ReadonlyArray<BasePlaylistItem> | void {
		_wireQueue(this);
		if (items === undefined)
			return this._queueList.get();
		this._queueList.set(items);
	},
	queueAppend(this: Internals, item: BasePlaylistItem | BasePlaylistItem[], _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.append(item);
	},
	queuePrepend(this: Internals, item: BasePlaylistItem | BasePlaylistItem[], _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.prepend(item);
	},
	queueInsert(this: Internals, item: BasePlaylistItem | BasePlaylistItem[], index: number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.insert(item, index);
	},
	queueRemove(this: Internals, id: string | number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.remove(id);
	},
	queueRemoveAt(this: Internals, index: number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.removeAt(index);
	},
	queueMove(this: Internals, from: number, to: number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.move(from, to);
	},
	queueClear(this: Internals, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.clear();
	},
	queueShuffle(this: Internals, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.shuffle();
	},
	queueSort(this: Internals, compare: (a: BasePlaylistItem, b: BasePlaylistItem) => number, _opts?: ActionOptions): void {
		_wireQueue(this);
		this._queueList.sort(compare);
	},
	peekNext(this: Internals): BasePlaylistItem | undefined {
		return this._queueList.peekNext();
	},
	peekPrevious(this: Internals): BasePlaylistItem | undefined {
		return this._queueList.peekPrevious();
	},
	queueLength(this: Internals): number {
		return this._queueList.length();
	},
	queueIndexOf(this: Internals, id: string | number): number {
		return this._queueList.get().findIndex(item => item.id === id);
	},

	/**
	 * Read or write the active queue cursor.
	 *
	 * `current()` — returns the active playlist item, or `undefined` when the
	 * queue is empty.
	 *
	 * `current(target, opts?)` — move the cursor to `target` (item ref, id
	 * string, or index). Fires `beforeMutation` so advisory plugins can cancel
	 * the change. Emits the `current` event when the cursor moves.
	 */
	current(this: Internals, target?: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean), opts?: ActionOptions): BasePlaylistItem | undefined | void {
		if (target === undefined) {
			return this._queueList.current();
		}
		_wireQueue(this);
		if (!_emitBeforeMutation(this, 'current', [target]))
			return;

		// Invalidate any in-flight load() so its cursor-move continuation does
		// not overwrite the position we're about to set here. This covers the
		// case where current(B) is called while a previous load(A) is awaiting
		// the backend — readyToLoad is false so we skip calling load() again,
		// but without bumping the epoch the load(A) continuation would move the
		// cursor back to A once it resolves.
		this._loadEpoch = (this._loadEpoch ?? 0) + 1;

		this._queueList.setCurrent(target);

		const readyToLoad = this._phase === 'ready'
			|| this._phase === 'playing'
			|| this._phase === 'paused'
			|| this._phase === 'ended'
			|| this._phase === 'stopped';
		if (!readyToLoad) return;

		const item = this._queueList.current();
		if (!item) return;

		void this.load(item as BasePlaylistItem & { url?: string }, { source: opts?.source }).then(() => {
			if (opts?.autoplay) {
				void this.play({ source: opts.source });
			}
		}).catch(() => { /* load errors surface via the 'error' event; suppress unhandled rejection */ });
	},
	currentIndex(this: Internals): number {
		return this._queueList.currentIndex();
	},

	/**
	 * Navigate to a playlist item by 1-based ordinal position.
	 *
	 * `seekToIndex(1)` loads the first item, `seekToIndex(queueLength())` loads
	 * the last. Out-of-range values are silently ignored (no cursor move).
	 * Fires the same `beforeMutation` / `current` lifecycle as `current(target)`.
	 *
	 * @throws {RangeError} when `position` is not a positive integer.
	 */
	seekToIndex(this: Internals, position: number, opts?: ActionOptions): void {
		if (!Number.isInteger(position) || position < 1) {
			throw new RangeError(`seekToIndex: position must be a positive integer, got ${position}`);
		}

		const zeroBasedIndex = position - 1;
		const items = this._queueList.get();

		if (zeroBasedIndex >= items.length) return;

		_wireQueue(this);
		if (!_emitBeforeMutation(this, 'current', [zeroBasedIndex]))
			return;

		this._queueList.setCurrent(zeroBasedIndex);
	},

	backlog(this: Internals, items?: BasePlaylistItem[]): ReadonlyArray<BasePlaylistItem> | void {
		_wireQueue(this);
		if (items === undefined)
			return this._backlogList.get();
		this._backlogList.set(items);
	},
	backlogAppend(this: Internals, item: BasePlaylistItem | BasePlaylistItem[]): void {
		_wireQueue(this);
		this._backlogList.append(item);
	},
	backlogRemove(this: Internals, id: string | number): void {
		_wireQueue(this);
		this._backlogList.remove(id);
	},
	backlogClear(this: Internals): void {
		_wireQueue(this);
		this._backlogList.clear();
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: plugin registration
// ──────────────────────────────────────────────────────────────────────────

export const pluginRegistrationMethods = {
	// `opts?: P['opts']` is the load-bearing line for autocomplete: the plugin's
	// options-generic `O` (the second `Plugin<P, O, E>` slot) flows back to the
	// `opts` parameter, so consumers get full type-checking + completion on the
	// inline literal — no `satisfies` needed at the call site.
	addPlugin<P extends Plugin>(this: Internals, PluginClass: PluginCtorWithId & (new () => P), opts?: P['opts']): unknown {
		const id = PluginClass.id;

		// Spec §23.6: post-dispose addPlugin throws.
		if (this._phase === 'disposed' || this._phase === 'disposing') {
			throw stateError('core:lifecycle/use-plugin-after-dispose', `addPlugin("${id}") called after dispose().`, { id });
		}

		// Spec §3.1 / §8.1: opt-in same-id replacement via `static replaces`.
		// When the existing-plugin id matches, dispose+remove it before
		// continuing — `plugin:disposed` fires for the old, then
		// `plugin:installed` for the new.
		if (PluginClass.replaces) {
			const existingIdx = this._plugins.findIndex(p => p.ctor.id === PluginClass.replaces);
			const queuedIdx = this._pluginQueue.findIndex(q => q.ctor.id === PluginClass.replaces);
			if (existingIdx >= 0) {
				this.removePluginById(PluginClass.replaces);
			}
			else if (queuedIdx >= 0) {
				this._pluginQueue.splice(queuedIdx, 1);
			}
			// If no match, registration proceeds as a fresh install (spec §3.1
			// "replaces is opt-in — non-matching id is not an error").
		}

		if (this._plugins.some(p => p.ctor.id === id) || this._pluginQueue.some(q => q.ctor.id === id)) {
			throw pluginErrorFactory('core:plugin/duplicate-id', `Plugin "${id}" is already registered.`, { id });
		}

		// Required-dependency presence + version check. Looks across registered
		// AND queued plugins so pre-setup ordering doesn't matter.
		const requires = PluginClass.requires ?? [];
		for (const spec of requires) {
			const requiredCtor: PluginCtorWithId = typeof spec === 'function' ? spec : spec.plugin;
			const optional = typeof spec === 'function' ? false : (spec.optional ?? false);
			const minVersion = typeof spec === 'function' ? undefined : spec.minVersion;
			const reqId = requiredCtor.id;
			const present = this._plugins.some(p => p.ctor.id === reqId)
				|| this._pluginQueue.some(q => q.ctor.id === reqId);
			if (!present && !optional) {
				throw pluginErrorFactory('core:plugin/missing-dep', `Plugin "${id}" requires "${reqId}" but it is not registered.`, {
					id,
					requires: reqId,
				});
			}
			if (present && minVersion !== undefined) {
				// Resolve the actual ctor we'd be using (registered first, queued fallback).
				const reg = this._plugins.find(p => p.ctor.id === reqId);
				const queued = this._pluginQueue.find(q => q.ctor.id === reqId);
				const installedVersion = (reg?.ctor.version ?? queued?.ctor.version ?? '0.0.0');
				if (_compareSemver(installedVersion, minVersion) < 0) {
					throw pluginErrorFactory(
						'core:plugin/version-mismatch',
						`Plugin "${id}" requires "${reqId}" >= ${minVersion} but ${installedVersion} is registered.`,
						{
							id,
							requires: reqId,
							requiredVersion: minVersion,
							installedVersion,
						},
					);
				}
			}
		}

		// Spec §23.6: minCoreVersion check. Kit declares its own version via
		// the static `_kitVersion` constant exported below.
		if (PluginClass.minCoreVersion && _compareSemver(KIT_VERSION, PluginClass.minCoreVersion) < 0) {
			throw pluginErrorFactory(
				'core:plugin/incompatible-core-version',
				`Plugin "${id}" requires kit version >= ${PluginClass.minCoreVersion} but ${KIT_VERSION} is running.`,
				{
					id,
					requiredCoreVersion: PluginClass.minCoreVersion,
					kitVersion: KIT_VERSION,
				},
			);
		}

		// Pre-setup / mid-setup: queue for the pluginsRegistering pipeline stage.
		if (this._phase === 'idle' || this._phase === 'setup') {
			this._pluginQueue.push({
				ctor: PluginClass,
				opts,
			});
			return this;
		}

		// Post-setup: run the same pipeline inline so `plugin:installed` fires
		// AFTER `use()` resolves (or `plugin:failed` if it doesn't).
		const timeoutMs = this.options.pluginInitTimeoutMs ?? 30_000;
		// Fire-and-forget — consumer can `await player.ready()`-style by
		// listening to `plugin:installed` / `plugin:failed`.
		void _registerPlugin(this, PluginClass, opts, timeoutMs);
		return this;
	},

	getPlugin<P extends object>(this: Internals, PluginClass: PluginCtorWithId & (new () => P)): P | undefined {
		const entry = this._plugins.find(registration => registration.ctor.id === PluginClass.id);
		return entry?.instance as P | undefined;
	},

	getPluginById<P extends object = object>(this: Internals, id: string): P | undefined {
		return this._plugins.find(reg => reg.ctor.id === id)?.instance as P | undefined;
	},

	removePlugin<P extends Plugin>(this: Internals, PluginClass: PluginCtorWithId & (new () => P), opts?: { cascade?: boolean }): void {
		this.removePluginById(PluginClass.id, opts);
	},

	removePluginById(this: Internals, id: string, opts?: { cascade?: boolean }): void {
		// Spec §C: required-dependency awareness. Reverse-walk both registered
		// AND queued plugins to find anything that requires `id`. Cascade is the
		// default — pass `{ cascade: false }` to opt out and surface a hard error
		// instead. Removing a dep without its dependents leaves them in a broken
		// state so cascading is the correct default.
		const dependents = _findDependents(this, id);
		if (dependents.length > 0) {
			if (opts?.cascade === false) {
				throw pluginErrorFactory(
					'core:plugin/has-dependents',
					`Cannot remove plugin "${id}" — ${dependents.length} plugin(s) depend on it: ${dependents.join(', ')}. Remove cascade:false or remove the dependents explicitly first.`,
					{
						id,
						dependents,
					},
				);
			}
			for (const dep of dependents) {
				this.removePluginById(dep, { cascade: true });
			}
		}

		// Also clear pending queue entries so a queued-then-removed plugin
		// doesn't get registered later.
		const queueIdx = this._pluginQueue.findIndex(q => q.ctor.id === id);
		if (queueIdx >= 0) {
			this._pluginQueue.splice(queueIdx, 1);
		}

		const idx = this._plugins.findIndex(p => p.ctor.id === id);
		if (idx < 0)
			return;
		const { instance, lifecycle, ctor } = this._plugins[idx]!;
		instance.dispose();
		lifecycle.dispose();
		if (ctor.translations) {
			this.removeTranslations(`plugin.${id}.`);
		}
		this._plugins.splice(idx, 1);
		const payload = { id };
		this.emit('plugin:disposed', payload);
		this.emit(`plugin:${id}:disposed`, payload);
	},

	plugins(this: Internals): ReadonlyArray<Plugin> {
		return this._plugins.map(p => p.instance);
	},

	enabledPlugins(this: Internals): ReadonlyArray<Plugin> {
		// Spec §3.2: order by `static priority` descending, ties broken by
		// registration order (which is the array's natural insertion order).
		const enabled = this._plugins
			.map((entry, index) => ({
				entry,
				index,
			}))
			.filter(({ entry }) => entry.instance.enabled());
		enabled.sort((a, b) => {
			const ap = a.entry.ctor.priority ?? 0;
			const bp = b.entry.ctor.priority ?? 0;
			if (ap !== bp)
				return bp - ap;
			return a.index - b.index;
		});
		return enabled.map(({ entry }) => entry.instance);
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: auth runtime — `auth` / `urlResolver` / `refreshAuth`.
// Spec §H. Single source of truth shared by both libraries; the per-library
// stubs that previously lived in `music/index.ts` and `video/index.ts` are
// removed once this mixin is wired into `playerCoreMethods`.
// ──────────────────────────────────────────────────────────────────────────

export const authMethods = {
	/**
	 * Read or write the auth config.
	 *
	 * `auth()` — returns a read-only frozen snapshot of the current auth
	 * config, or `undefined` when none has been set.
	 *
	 * `auth(config)` — replace the auth config wholesale; old fields are gone.
	 * Emits `auth:refreshed` so listeners (cached fetchers, telemetry) re-resolve.
	 *
	 * `auth(partial)` — shallow-merge updates onto the current auth config;
	 * fields not specified are retained. Emits `auth:refreshed`.
	 */
	auth(this: Internals, configOrPartial?: AuthConfig | Partial<AuthConfig>): Readonly<AuthConfig> | undefined | void {
		if (configOrPartial === undefined) {
			if (!this._authConfig)
				return undefined;
			return Object.freeze({ ...this._authConfig });
		}
		const next: AuthConfig = {
			...(this._authConfig ?? {}),
			...configOrPartial,
		};
		this._authConfig = next;
		this.emit('auth:refreshed', { tokenAcquiredAt: Date.now() });
	},

	/**
	 * Resolve a URL through the configured `urlResolver` (custom-supplied
	 * via `setup({ urlResolver })` / `urlResolver(fn)`) or fall back to
	 * the built-in pipeline (`auth.transformUrl` + `buildResolvedUrl`).
	 *
	 * `category` lets custom resolvers route per consumer ('media',
	 * 'subtitle', 'cast', 'license', ...). Defaults to `'media'`.
	 *
	 * Returned `ResolvedUrl` carries the post-transform `href` plus parsed
	 * parts (origin, pathname, ext, searchParams, ...). Pass `.href` (or
	 * interpolate the object — `toString()` returns `href`) to the consumer.
	 */
	async resolveUrl(this: Internals, url: string, category?: UrlCategory): Promise<ResolvedUrl> {
		const base = this._baseUrl ?? this.options?.baseUrl;
		const auth = this._authConfig;

		const defaultResolve = async (rawUrl: string) => {
			const transformer = auth?.transformUrl;
			const transformed = transformer ? await transformer(rawUrl) : rawUrl;
			return buildResolvedUrl(rawUrl, transformed, base);
		};

		const resolver = this._urlResolver;
		if (!resolver)
			return defaultResolve(url);

		const ctx: UrlResolverContext = {
			auth,
			baseUrl: base,
			category: category ?? 'media',
			defaultResolve,
		};
		const out = await resolver(url, ctx);
		// Defensive: a custom resolver returning a falsy / non-object value
		// shouldn't blow up downstream consumers. Fall back to default.
		if (!out || typeof out !== 'object' || typeof out.href !== 'string') {
			return defaultResolve(url);
		}
		return out;
	},

	/**
	 * Read or write the URL resolver.
	 *
	 * `urlResolver()` — returns the current custom resolver, or `undefined`
	 * when the built-in auth pipeline (`auth.transformUrl` + `buildResolvedUrl`)
	 * is active.
	 *
	 * `urlResolver(fn)` — replace the resolver at runtime. Pass `undefined`
	 * to revert to the built-in default. Takes effect on the next `resolveUrl`
	 * call; fires no event.
	 */
	urlResolver(this: Internals, resolver?: UrlResolver | undefined): UrlResolver | undefined | void {
		if (arguments.length === 0) {
			return this._urlResolver;
		}
		this._urlResolver = resolver;
	},

	/**
	 * Invoke `auth.refreshOnUnauthenticated` if present, then emit
	 * `auth:refreshed { tokenAcquiredAt }`. On failure emits `auth:failed`
	 * (does NOT throw — callers wire to the event for error UI).
	 */
	async refreshAuth(this: Internals): Promise<void> {
		const cfg = this._authConfig;
		const handler = cfg?.refreshOnUnauthenticated;
		if (!handler) {
			this.emit('auth:refreshed', { tokenAcquiredAt: Date.now() });
			return;
		}
		try {
			await handler();
			this.emit('auth:refreshed', { tokenAcquiredAt: Date.now() });
		}
		catch (err) {
			this.emit('auth:failed', { error: err });
		}
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: stream registration — delegates to the per-player `StreamRegistry`.
// Defaults (`native`, `hls`) are wired in lazily; consumers may register
// custom factories via `registerStream(factory)`.
// ──────────────────────────────────────────────────────────────────────────

export const streamRegistrationMethods = {
	registerStream(this: Internals, factory: StreamFactory, prepend?: boolean): unknown {
		_ensureStreamRegistry(this).register(factory, prepend);
		return this;
	},
	unregisterStream(this: Internals, id: string): unknown {
		_ensureStreamRegistry(this).unregister(id);
		return this;
	},
	streams(this: Internals): ReadonlyArray<string> {
		return _ensureStreamRegistry(this).list();
	},
	getStreamFactory(this: Internals, id: string): StreamFactory | undefined {
		return _ensureStreamRegistry(this).findById(id);
	},
} as const;

/**
 * Lazy-init the per-player stream registry. Default factories (`native`, `hls`)
 * are registered the first time the registry is touched OR when `setup()`
 * reaches the `streamsReady` stage — whichever comes first.
 */
function _ensureStreamRegistry(self: Internals): StreamRegistry {
	if (!self._streamRegistry) {
		self._streamRegistry = new StreamRegistry();
	}
	return self._streamRegistry;
}

// ──────────────────────────────────────────────────────────────────────────
// Mixin: media tracks — subtitles / audio tracks / quality levels / chapters.
// Reads delegate to the active backend (when present); no-ops when the
// backend doesn't expose the surface (audio-only / pre-load). Setters emit
// the corresponding `subtitle` / `audioTrack` event so plugins (octopus,
// playlist UI, etc.) can react regardless of backend support.
// ──────────────────────────────────────────────────────────────────────────

function _disposeSidecarSubtitle(self: Internals): void {
	const ctx = self._sidecarSubtitle;
	if (!ctx) return;
	try { ctx.tracker.dispose(); }
	catch { /* defensive */ }
	self._sidecarSubtitle = undefined;
}

/**
 * Items can carry inline subtitle tracks under
 * `tracks: [{ kind: 'subtitles', file, language, label, type }]`. Players
 * extend `BasePlaylistItem` with the field, but the kit doesn't model
 * it directly — we read it through a narrowed interface so the helper
 * stays player-agnostic without resorting to `any`.
 */
interface SidecarTrack {
	id?: string;
	kind?: string;
	file?: string;
	language?: string;
	label?: string;
	type?: string;
}
interface ItemWithTracks extends BasePlaylistItem {
	tracks?: SidecarTrack[];
	chapters?: Chapter[];
}


interface ItemWithDefinedTracks extends BasePlaylistItem {
	tracks: SidecarTrack[];
	chapters?: Chapter[];
}

function _hasTracksField(item: BasePlaylistItem): item is ItemWithDefinedTracks {
	return 'tracks' in item && Array.isArray((item as ItemWithTracks).tracks) && (item as ItemWithTracks).tracks!.length > 0;
}

async function _resolveItemTrackUrls<T extends BasePlaylistItem>(
	self: Internals,
	item: T,
): Promise<T> {
	if (!_hasTracksField(item)) return item;

	const transformer = self._authConfig?.transformUrl;
	const base = self._baseUrl;

	const resolved = await Promise.all(
		item.tracks.map(async (sidecarTrack: SidecarTrack): Promise<SidecarTrack> => {
			if (!sidecarTrack.file) return sidecarTrack;
			const transformed = transformer ? await transformer(sidecarTrack.file) : sidecarTrack.file;
			return { ...sidecarTrack, file: buildResolvedUrl(sidecarTrack.file, transformed, base).href };
		}),
	);

	const withTracks: T & ItemWithTracks = { ...item, tracks: resolved };

	// If no inline chapters are present, try to populate them from a sidecar
	// `tracks[{ kind: 'chapters', file }]` VTT. Runs after URL resolution so
	// the file href is already absolute + auth-transformed.
	const existingChapters = withTracks.chapters;
	if (!Array.isArray(existingChapters) || existingChapters.length === 0) {
		const chapterTrack = resolved.find((sidecarTrack: SidecarTrack) => sidecarTrack.kind === 'chapters' && sidecarTrack.file);
		if (chapterTrack?.file) {
			const chapters = await _fetchChaptersVtt(chapterTrack.file);
			if (chapters.length > 0) {
				return { ...withTracks, chapters };
			}
		}
	}

	return withTracks;
}

/** Fetch a WebVTT chapters file and convert its cues into `Chapter[]`. */
async function _fetchChaptersVtt(url: string): Promise<Chapter[]> {
	try {
		const r = await fetch(url);
		if (!r.ok) return [];
		const text = await r.text();
		return parseVtt(text).cues.map((cue, i) => ({
			index: i,
			start: cue.start,
			end: cue.end,
			title: cue.payload,
		}));
	}
	catch {
		return [];
	}
}

/**
 * Ensure the currently-selected item has its chapters populated, then emit
 * `'chapters'` so subscribers can repaint chapter markers.
 *
 * Called fire-and-forget from the `_wireQueue` cursor-change handler and
 * from `load()` after the cursor is moved. A monotonic `_chapterEpoch` field
 * on the player instance guards against stale completions when the user
 * switches items rapidly.
 */
async function _resolveAndEmitChapters(self: Internals, itemId: string | number | undefined): Promise<void> {
	const epoch = (self._chapterEpoch ?? 0) + 1;
	self._chapterEpoch = epoch;
	const isLatest = (): boolean => self._chapterEpoch === epoch;

	const foundItem = self._queueList.get().find(queued => queued.id === itemId);
	if (!foundItem) return;
	const item = foundItem as ItemWithTracks;

	if (Array.isArray(item.chapters) && item.chapters.length > 0) {
		// Already resolved — just announce.
		self.emit('chapters', { chapters: item.chapters });
		return;
	}

	const resolved = await _resolveItemTrackUrls(self, item);

	if (!isLatest()) return;

	const chapters = resolved.chapters;
	if (!Array.isArray(chapters) || chapters.length === 0) return;

	self._queueList.replaceItem(resolved);

	self.emit('chapters', { chapters });
}


function _resolveSidecarSubtitle(
	self: Internals,
	sidecarIdx: number,
): { url?: string; language?: string; label?: string; type?: string } | undefined {
	const rawCur = self.current?.();
	const cur: ItemWithDefinedTracks | undefined = rawCur && _hasTracksField(rawCur) ? rawCur : undefined;
	const list = (cur?.tracks ?? []).filter((sidecarTrack: SidecarTrack) => sidecarTrack.kind === 'subtitles');
	const sidecarTrack = list[sidecarIdx];
	if (!sidecarTrack) return undefined;
	return { url: sidecarTrack.file, language: sidecarTrack.language, label: sidecarTrack.label, type: sidecarTrack.type };
}

/**
 * Fetch + parse a sidecar VTT and start a `CueTracker` whose `enter` /
 * `exit` events feed the player-level `subtitleCue` channel. Active cue
 * set is mirrored locally so each event carries the full simultaneous
 * cue list (matches the backend's `subtitleCue` shape — every renderer
 * sees one stream regardless of source).
 */
async function _startSidecarSubtitle(
	self: Internals,
	track: { url?: string; language?: string },
): Promise<void> {
	if (!track.url) return;

	let raw: string;
	try {
		const r = await fetch(track.url);
		if (!r.ok) {
			self.emit('subtitleCue', { cues: [], language: track.language });
			return;
		}
		raw = await r.text();
	}
	catch {
		self.emit('subtitleCue', { cues: [], language: track.language });
		return;
	}

	// User may have switched tracks mid-fetch; bail if the slot was
	// (re)populated by a later `currentSubtitle` while we were waiting.
	if (self._sidecarSubtitle) return;

	const cueList = parseVttSubtitles(raw);
	const tracker = new CueTracker<VTTSubtitlePayload>(cueList, { trackerId: 'subtitle-sidecar' });
	const ctx: SidecarSubtitleContext = {
		tracker,
		active: new Set(),
		language: track.language,
	};
	self._sidecarSubtitle = ctx;

	const emitChange = (): void => {
		const cues: SubtitleCuePayload[] = [...ctx.active].map(c => _toSubtitleCue(c.payload));
		self.emit('subtitleCue', { cues, language: ctx.language });
	};

	tracker.on('enter', (cue) => {
		ctx.active.add(cue);
		emitChange();
	});
	tracker.on('exit', (cue) => {
		ctx.active.delete(cue);
		emitChange();
	});
	tracker.attach(self);
}

/**
 * Translate a parsed sidecar `VTTSubtitlePayload` into the unified
 * `SubtitleCue` event shape — same fields the backend emits for native
 * tracks. Renderers see a single payload type and never branch on origin.
 */
function _toSubtitleCue(p: VTTSubtitlePayload): SubtitleCuePayload {
	return {
		text: p.markup ?? p.text,
		plainText: p.text,
		line: p.linePosition,
		align: p.alignment ?? 'center',
		size: typeof p.size === 'number' ? p.size : 100,
	};
}

/**
 * Resolve the active backend handle without forcing instantiation. Returns
 * `undefined` when no backend has been touched yet (so reads on a freshly-set-up
 * player without a load() return empty arrays instead of throwing).
 */
function _peekBackend(self: Internals): unknown {
	if (typeof self.backend !== 'function')
		return undefined;
	try {
		return self.backend();
	}
	catch { return undefined; }
}

export const mediaTracksMethods = {
	subtitles(this: Internals): unknown {
		// Subtitles are the union of:
		//   1. tracks the backend exposes (HLS-managed in-manifest subtitles
		//      via `b.subtitleTracks()`)
		//   2. sidecar VTTs declared on the active playlist item under
		//      `tracks: [{ kind: 'subtitles', ... }]`
		// Consumers should not have to know which side a track came from —
		// they get one flat list to render and a stable index per entry.
		const fromBackend: SubtitleTrack[] = (() => {
			const backend = _peekBackendTyped<_BackendWithSubtitleTracks>(this);
			if (typeof backend?.subtitleTracks === 'function') {
				try {
					return backend.subtitleTracks() ?? [];
				}
				catch { return []; }
			}
			return [];
		})();

		const fromItem: Array<{ id: string; language?: string; label?: string; kind: 'subtitles'; type?: string; url?: string; default: boolean }> = (() => {
			const rawCur = this.current?.();
			const cur: ItemWithDefinedTracks | undefined = rawCur && _hasTracksField(rawCur) ? rawCur : undefined;
			const tracks = cur?.tracks ?? [];
			return tracks
				.filter(sidecarTrack => sidecarTrack?.kind === 'subtitles')
				.map((sidecarTrack, idx) => ({
					id: sidecarTrack.id ?? `subtitle-sidecar-${idx}`,
					language: sidecarTrack.language,
					label: sidecarTrack.label,
					kind: 'subtitles' as const,
					type: sidecarTrack.type,
					url: sidecarTrack.file,
					default: false,
				}));
		})();

		// HLS-managed first (their indexes are what `currentSubtitle(idx)` writes
		// to `hls.subtitleTrack`); sidecar VTTs trail the list.
		return [...fromBackend, ...fromItem];
	},
	/**
	 * Read or write the active subtitle track.
	 *
	 * `currentSubtitle()` — returns the index of the currently-selected
	 * subtitle track, or `null` when subtitles are off.
	 *
	 * `currentSubtitle(idx)` — select subtitle track at `idx`. Pass `null`
	 * (or a negative number) to disable subtitles. Fires the `subtitle` event
	 * with `{ track: idx | null }`.
	 */
	currentSubtitle(this: Internals, idx?: number | null): number | null | void {
		if (idx === undefined) {
			return this._currentSubtitleIdx;
		}

		// Tear down any in-flight sidecar tracker first; switching tracks
		// (or to null) must release the prior cue stream so it doesn't
		// keep emitting active cues from the old track.
		_disposeSidecarSubtitle(this);

		const b = _peekBackendTyped<_BackendWithSubtitleTracks>(this);
		const backendCount = (typeof b?.subtitleTracks === 'function')
			? (b.subtitleTracks() ?? []).length
			: 0;

		// "Off" — clear backend selection AND emit an empty cue list so
		// renderers wipe their overlays.
		if (idx === null || idx < 0) {
			this._currentSubtitleIdx = null;
			b?.setSubtitleTrack?.(null);
			this.emit('subtitle', { track: null });
			this.emit('subtitleCue', { cues: [], language: undefined });
			return;
		}

		// Backend-managed: index falls within the backend's track count.
		// Backend will emit `subtitleCue` itself via its cuechange hook.
		if (idx < backendCount) {
			this._currentSubtitleIdx = idx;
			b?.setSubtitleTrack?.(idx);
			this.emit('subtitle', { track: idx });
			return;
		}

		// Sidecar VTT: index past the backend's tracks points into the
		// active item's `tracks: [{ kind: 'subtitles', file, language }]`.
		// Disable any backend track first so the two streams don't both
		// fire `subtitleCue`.
		this._currentSubtitleIdx = idx;
		b?.setSubtitleTrack?.(null);
		const sidecar = _resolveSidecarSubtitle(this, idx - backendCount);
		this.emit('subtitle', { track: idx });
		if (!sidecar?.url) {
			this.emit('subtitleCue', { cues: [], language: undefined });
			return;
		}
		void _startSidecarSubtitle(this, sidecar);
	},
	/**
	 * Read or write the subtitle style. Mirrors the v1 player API so
	 * settings menus and overlay plugins talk through one surface and
	 * never have to maintain their own ad-hoc cache.
	 *
	 * Reading: `player.subtitleStyle()` → full current style.
	 * Writing: `player.subtitleStyle({ fontSize: 120 })` merges the
	 * patch onto the active style and emits `subtitleStyle` with the
	 * merged result so subscribers (the overlay plugin, settings menu
	 * subtext, etc.) can react.
	 */
	subtitleStyle(this: Internals, patch?: Record<string, unknown>): Record<string, unknown> | void {
		// Lazily seed defaults the first time this is read. Defaults match
		// the v1 player's `defaultSubtitleStyles` so menus pre-populate
		// with sensible values without the consumer wiring an init step.
		const seed = (): Record<string, unknown> => ({
			fontSize: 100,
			fontFamily: 'ReithSans, sans-serif',
			textColor: 'white',
			textOpacity: 100,
			backgroundColor: 'black',
			backgroundOpacity: 0,
			edgeStyle: 'textShadow',
			areaColor: 'black',
			windowOpacity: 0,
		});

		if (!this._subtitleStyle) this._subtitleStyle = seed();

		if (patch === undefined) return { ...this._subtitleStyle };

		this._subtitleStyle = { ...this._subtitleStyle, ...patch };
		this.emit('subtitleStyle', { ...this._subtitleStyle });
		return undefined;
	},
	audioTracks(this: Internals): unknown {
		const backend = _peekBackendTyped<_BackendWithAudioTracks>(this);
		if (typeof backend?.audioTracks === 'function') {
			try {
				return backend.audioTracks();
			}
			catch { return []; }
		}
		return [];
	},
	/**
	 * Read or write the active audio track.
	 *
	 * `currentAudioTrack()` — returns the index of the currently-selected
	 * audio track, or `null` when no explicit selection has been made.
	 *
	 * `currentAudioTrack(idx)` — select the audio track at `idx`. Fires the
	 * `audioTrack` event with `{ id: idx }`.
	 */
	currentAudioTrack(this: Internals, idx?: number): number | null | void {
		if (idx === undefined) {
			return this._currentAudioTrackIdx;
		}
		this._currentAudioTrackIdx = idx;
		const backend = _peekBackendTyped<_BackendWithAudioTrack>(this);
		if (typeof backend?.setAudioTrack === 'function') {
			backend.setAudioTrack(idx);
		}
		// No backend track support — emit for symmetry.
		this.emit('audioTrack', { id: idx });
	},
	qualityLevels(this: Internals, opts?: { includeUnsupported?: true }): unknown {
		const backend = _peekBackendTyped<_BackendWithQualityLevels>(this);
		if (typeof backend?.qualityLevels === 'function') {
			try {
				return backend.qualityLevels(opts);
			}
			catch { return []; }
		}
		return [];
	},
	/**
	 * Read or write the active quality level.
	 *
	 * `currentQuality()` — returns the currently-selected quality index, or
	 * `'auto'` when adaptive bitrate selection is active.
	 *
	 * `currentQuality(idx)` — lock to a specific quality level. Pass
	 * `'auto'` to restore adaptive selection.
	 */
	currentQuality(this: Internals, idx?: number | 'auto'): number | 'auto' | void {
		if (idx === undefined) {
			return this._currentQualityIdx;
		}
		this._currentQualityIdx = idx;
		const backend = _peekBackendTyped<_BackendWithSetQualityLevel>(this);
		if (typeof backend?.setQuality === 'function') {
			backend.setQuality(idx);
		}
		// No HLS variants on audio backend — no-op.
	},
	chapters(this: Internals): ReadonlyArray<Chapter> {
		// Chapter list comes from the active playlist item. Items carry an
		// inline `chapters: Chapter[]` field once the kit resolves the sidecar
		// VTT (either during `load()` or on cursor change). Returns [] until
		// the async fetch settles — subscribe to 'chapters' for the ready signal.
		const rawCurrent = this.current?.();
		const current: ItemWithDefinedTracks | undefined = rawCurrent && _hasTracksField(rawCurrent) ? rawCurrent : undefined;
		return current?.chapters ?? [];
	},
	seekToChapter(this: Internals, idx: number, opts?: ActionOptions): void {
		const list = this.chapters();
		const chapter = list[idx];
		if (!chapter)
			return; // out-of-range → no-op

		// `currentTime` is async when a beforeSeek handler is wired. Fire-and-
		// forget here — `seeked` is emitted inside `currentTime` after the
		// phase round-trip, so consumers still see it on the correct path.
		const ret = this.currentTime(chapter.start, opts);
		if (ret instanceof Promise)
			void ret;

		this.emit('chapter', {
			index: idx,
			title: chapter.title,
		});
	},
	nextChapter(this: Internals, opts?: ActionOptions): void {
		const list = this.chapters();
		if (list.length === 0)
			return;

		const t = this._internalCurrentTime;
		const nextIdx = list.findIndex(c => c.start > t);
		if (nextIdx < 0)
			return; // already in/after the last chapter

		this.seekToChapter(nextIdx, opts);
	},
	previousChapter(this: Internals, opts?: ActionOptions): void {
		const list = this.chapters();
		if (list.length === 0)
			return;

		const t = this._internalCurrentTime;
		// v1 UX: if more than 10s into the current chapter, jump to its start
		// instead of the previous chapter. Otherwise, walk back one.
		let currentIdx = -1;
		for (let i = list.length - 1; i >= 0; i--) {
			if (list[i]!.start <= t) { currentIdx = i; break; }
		}
		if (currentIdx < 0)
			return;

		const intoChapter = t - list[currentIdx]!.start;
		const targetIdx = (intoChapter > 10 || currentIdx === 0) ? currentIdx : currentIdx - 1;
		this.seekToChapter(targetIdx, opts);
	},

	/**
	 * Read or seek by chapter.
	 *
	 * `currentChapter()` — returns the `Chapter` whose time range contains
	 * `currentTime`, or `null` when no chapter is active (before the first,
	 * between chapters, or the chapter list is empty).
	 *
	 * `currentChapter(idx)` — jump to the chapter at `idx` (same as
	 * `seekToChapter(idx)`). No-op when `idx` is out of range.
	 */
	currentChapter(this: Internals, idx?: number): Chapter | null | void {
		if (idx === undefined) {
			const list = this.chapters();
			if (list.length === 0)
				return null;

			const t = this._internalCurrentTime;
			for (let i = list.length - 1; i >= 0; i--) {
				const ch = list[i]!;
				if (t >= ch.start && t < ch.end)
					return ch;
			}
			return null;
		}
		this.seekToChapter(idx);
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: device capabilities — `isTv`, `isMobile`, `isDesktop`, `device`.
// ──────────────────────────────────────────────────────────────────────────

/**
 * UA-based device classification. Order matters: TV detection runs FIRST so
 * "Smart-TV running Android" is classified as TV, not Mobile. Mobile second.
 * Desktop is the catch-all.
 *
 * Detection is best-effort — UA strings lie. Consumers needing better signals
 * should swap `platform.capabilities` with a probe-based bridge.
 */
function _detectDevice(): { isTv: boolean; isMobile: boolean; isDesktop: boolean; os: 'android' | 'ios' | 'macos' | 'windows' | 'linux' | 'unknown' } {
	if (typeof navigator === 'undefined') {
		return {
			isTv: false,
			isMobile: false,
			isDesktop: true,
			os: 'unknown',
		};
	}
	const ua = navigator.userAgent || '';
	const tvHints = /\b(SmartTV|GoogleTV|AppleTV|HbbTV|NetCast|WebOS|Tizen|VIDAA|BRAVIA|AFTS|AFTM|AFTB|AFTT|AFTN|FireTV|Crkey|PlayStation|Xbox)\b/i;
	const isTv = tvHints.test(ua);
	const mobileHints = /\b(Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|Opera Mini)\b/i;
	const isMobile = !isTv && mobileHints.test(ua);
	const isDesktop = !isTv && !isMobile;

	let os: 'android' | 'ios' | 'macos' | 'windows' | 'linux' | 'unknown' = 'unknown';
	if (/Android/i.test(ua))
		os = 'android';
	else if (/iPhone|iPad|iPod/i.test(ua))
		os = 'ios';
	else if (/Mac OS X/i.test(ua))
		os = 'macos';
	else if (/Windows/i.test(ua))
		os = 'windows';
	else if (/Linux/i.test(ua))
		os = 'linux';

	return {
		isTv,
		isMobile,
		isDesktop,
		os,
	};
}

export const deviceMethods = {
	isTv(this: Internals): boolean {
		return _detectDevice().isTv;
	},
	isMobile(this: Internals): boolean {
		return _detectDevice().isMobile;
	},
	isDesktop(this: Internals): boolean {
		return _detectDevice().isDesktop;
	},
	device(this: Internals): DeviceCapabilities {
		const detected = _detectDevice();
		const platform = this._platform ?? browserPlatform;
		const fullscreenSupported = platform.fullscreen?.isSupported() ?? false;
		const pipSupported = platform.pip?.isSupported() ?? false;
		const webLocksSupported = typeof navigator !== 'undefined' && 'locks' in navigator;
		// Autoplay policy is hard to detect synchronously — flag unknown.
		// Real probe lands when the player tries autoplay and catches the rejection.
		return {
			isTv: detected.isTv,
			isMobile: detected.isMobile,
			isDesktop: detected.isDesktop,
			pipSupported,
			fullscreenSupported,
			webLocksSupported,
			autoplayAllowed: 'unknown',
			preferred: detected.isTv || detected.isMobile ? 'powerEfficient' : 'smooth',
		};
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: audio output device routing.
// ──────────────────────────────────────────────────────────────────────────

export const audioOutputMethods = {
	/**
	 * Enumerate audio output devices. Resolves to `MediaDeviceInfo[]` via
	 * `navigator.mediaDevices.enumerateDevices()`. Browsers gate output-device
	 * enumeration behind a permission grant — call `selectAudioOutput()` first
	 * to trigger the grant.
	 */
	async audioOutputs(this: Internals): Promise<MediaDeviceInfo[]> {
		if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
			return [];
		}
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter(d => d.kind === 'audiooutput');
	},
	/**
	 * Open the browser's audio-output picker. Chrome ≥105 exposes
	 * `selectAudioOutput()`; other browsers throw a structured BrowserPolicyError.
	 * Returns the selected device or `null` when the user cancels.
	 */
	async selectAudioOutput(this: Internals): Promise<MediaDeviceInfo | null> {
		// selectAudioOutput is Chrome ≥105 only — not yet in TypeScript's bundled DOM lib.
		type MediaDevicesWithPicker = MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> };
		const md: MediaDevicesWithPicker | undefined = typeof navigator !== 'undefined' ? navigator.mediaDevices as MediaDevicesWithPicker : undefined;
		if (!md?.selectAudioOutput) {
			throw new BrowserPolicyError({
				code: 'core:policy/audioOutputPickerUnsupported',
				severity: 'error',
				scope: { kind: 'core' },
				message: 'Audio output picker not supported in this browser. Chrome ≥105 only.',
			});
		}
		try {
			return await md.selectAudioOutput();
		}
		catch (err) {
			const name = err instanceof Error ? err.name : '';
			if (name === 'AbortError' || name === 'NotAllowedError')
				return null;
			throw err;
		}
	},

	/**
	 * Read or write the active audio output device.
	 *
	 * `currentAudioOutput()` — returns the current `sinkId` (device id string),
	 * or `null` when using the system default output.
	 *
	 * `currentAudioOutput(deviceId)` — route audio to the device with the given
	 * id. Calls `HTMLMediaElement.setSinkId(deviceId)` on the backend's media
	 * element when available. Throws `BrowserPolicyError` when `setSinkId` is
	 * not supported. Returns a `Promise<void>` that resolves once the switch
	 * completes.
	 */
	async currentAudioOutput(this: Internals, deviceId?: string): Promise<string | null | void> {
		if (deviceId === undefined) {
			return this._currentAudioOutputId;
		}
		const backend = _peekBackendTyped<_BackendWithMediaElement>(this);
		const el = backend?.mediaElement?.();
		if (!el || typeof el.setSinkId !== 'function') {
			throw new BrowserPolicyError({
				code: 'core:policy/setSinkIdUnsupported',
				severity: 'error',
				scope: { kind: 'core' },
				message: 'setSinkId() is not supported in this browser or no media element is bound.',
			});
		}
		await el.setSinkId(deviceId);
		this._currentAudioOutputId = deviceId;
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: cast / handoff — `castState`, `transferTo`.
// ──────────────────────────────────────────────────────────────────────────

interface _CastGlobal {
	cast: { framework: { CastContext: { getInstance: () => { requestSession: () => Promise<unknown> } } } };
}

/** Probe whether the Cast Web Sender SDK is loaded on the page. */
function _isCastAvailable(): boolean {
	// Cast Web Sender SDK not in standard DOM types — probe via `in`.
	return typeof globalThis !== 'undefined' && 'cast' in globalThis;
}

/** Probe whether AirPlay is available (WebKit-only, on a video element). */
function _isAirPlayAvailable(): boolean {
	// WebKitPlaybackTargetAvailabilityEvent not in standard DOM types — probe via `in`.
	return typeof window !== 'undefined' && 'WebKitPlaybackTargetAvailabilityEvent' in window;
}

/** Probe whether the W3C RemotePlayback API is available. */
function _isRemotePlaybackAvailable(): boolean {
	// RemotePlayback not yet in standard TS DOM lib — probe via `in`.
	const proto: unknown = typeof window !== 'undefined' ? window.HTMLMediaElement?.prototype : undefined;
	return proto !== undefined && typeof proto === 'object' && proto !== null && 'remote' in proto;
}

export const castMethods = {
	/**
	 * Coarse handoff state. Returns the status of the most recently active
	 * remote-playback target. With no Cast/AirPlay/RemotePlayback APIs
	 * available, returns `'unavailable'`.
	 */
	castState(this: Internals): _CastStateEnum {
		if (this._castState !== undefined)
			return this._castState;
		if (_isCastAvailable() || _isAirPlayAvailable() || _isRemotePlaybackAvailable()) {
			return _CastStateEnum.AVAILABLE;
		}
		return _CastStateEnum.UNAVAILABLE;
	},
	/**
	 * Initiate handoff to a remote target. Throws structured `BrowserPolicyError`
	 * when the target's API is unavailable in the current environment so
	 * consumers can surface a "device not supported" UI message instead of
	 * falling through to an opaque error.
	 */
	async transferTo(this: Internals, target: 'cast' | 'airplay' | 'remote-playback' | 'local'): Promise<void> {
		const setState = (s: _CastStateEnum): void => {
			this._castState = s;
			this.emit('castState', { state: s });
		};

		switch (target) {
			case 'cast': {
				if (!_isCastAvailable()) {
					throw new BrowserPolicyError({
						code: 'core:policy/castUnavailable',
						severity: 'error',
						scope: { kind: 'core' },
						message: 'Cast Web Sender SDK not loaded. Add `<script src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1"></script>` to enable Cast.',
					});
				}
				setState(_CastStateEnum.CONNECTING);
				try {
					const castGlobal = globalThis as unknown as _CastGlobal;
					await castGlobal.cast.framework.CastContext.getInstance().requestSession();
					setState(_CastStateEnum.CONNECTED);
				}
				catch (err) {
					setState(_CastStateEnum.AVAILABLE);
					throw err;
				}
				return;
			}
			case 'airplay': {
				if (!_isAirPlayAvailable()) {
					throw new BrowserPolicyError({
						code: 'core:policy/airplayUnavailable',
						severity: 'error',
						scope: { kind: 'core' },
						message: 'AirPlay is WebKit-only (Safari, iOS).',
					});
				}
				// AirPlay handoff requires the consumer to call
				// `videoElement.webkitShowPlaybackTargetPicker()` directly
				// because Safari binds the picker to user-gesture events.
				// Mark the state as connecting; consumer wires the picker.
				setState(_CastStateEnum.CONNECTING);
				if (this.videoElement?.webkitShowPlaybackTargetPicker) {
					this.videoElement.webkitShowPlaybackTargetPicker();
				}
				return;
			}
			case 'remote-playback': {
				if (!_isRemotePlaybackAvailable()) {
					throw new BrowserPolicyError({
						code: 'core:policy/remotePlaybackUnavailable',
						severity: 'error',
						scope: { kind: 'core' },
						message: 'RemotePlayback API not supported in this browser.',
					});
				}
				const video = this.videoElement;
				if (!video?.remote) {
					throw new BrowserPolicyError({
						code: 'core:policy/remotePlaybackUnavailable',
						severity: 'error',
						scope: { kind: 'core' },
						message: 'No video element bound to player.',
					});
				}
				setState(_CastStateEnum.CONNECTING);
				try {
					await video.remote.prompt();
					setState(_CastStateEnum.CONNECTED);
				}
				catch (err) {
					setState(_CastStateEnum.AVAILABLE);
					throw err;
				}
				return;
			}
			case 'local': {
				// Tear down any active remote session.
				setState(_CastStateEnum.DISCONNECTED);
				return;
			}
			default:
				throw new BrowserPolicyError({
					code: 'core:policy/transferTargetUnknown',
					severity: 'error',
					scope: { kind: 'core' },
					message: `Unknown transfer target: ${target}`,
				});
		}
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: ABR — `bandwidth`, `bandwidthEstimator`, `canPlay`.
// ──────────────────────────────────────────────────────────────────────────

export const abrMethods = {
	/**
	 * Last-known throughput estimate in bits per second. Returns 0 until a
	 * stream is loaded with an estimator wired (consumer or backend).
	 */
	bandwidth(this: Internals): number {
		return this._bandwidthEstimate ?? 0;
	},
	/**
	 * Read or override the bandwidth estimator. Reading returns the current
	 * estimator function (or undefined). Writing replaces it; the new
	 * function is queried by the active stream source on every level decision.
	 */
	bandwidthEstimator(this: Internals, fn?: () => number): (() => number) | void {
		if (fn === undefined)
			return this._bandwidthEstimator;
		this._bandwidthEstimator = fn;
	},
	/**
	 * Probe whether a media profile can be decoded smoothly. Delegates to the
	 * platform's `capabilities.canDecode` bridge. Returns the standard
	 * `MediaCapabilitiesDecodingInfo` shape.
	 */
	async canPlay(this: Internals, profile: { contentType: string; width?: number; height?: number; bitrate?: number; framerate?: number }): Promise<CanPlayResult> {
		const platform = this._platform ?? browserPlatform;
		const result = await platform.capabilities.canDecode(profile);
		return {
			supported: result.supported,
			smooth: result.smooth,
			powerEfficient: result.powerEfficient,
		};
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: metrics / clock / accessibility — grouped because they share the
// same "instrumentation surface" semantics across both libraries.
// ──────────────────────────────────────────────────────────────────────────

export const metricsMethods = {
	metrics(this: Internals): PlaybackMetrics {
		return {
			...this._metrics,
			sessionDurationMs: this._metricsStartedAt ? Date.now() - this._metricsStartedAt : 0,
		};
	},
	recordMetric(this: Internals, name: string, value: number): void {
		this._metrics[name] = value;
	},
	/**
	 * Distributed-clock timestamp source. Returns `options.clockSource()` if
	 * configured, else `Date.now()`. Used by the kit's auth / event timestamps
	 * + plugins coordinating across machines.
	 */
	now(this: Internals): number {
		const cs = this.options?.clockSource;
		return typeof cs === 'function' ? cs() : Date.now();
	},
	/**
	 * ARIA-live announcement. Inserts a transient element under the player
	 * container with `aria-live="polite"` (or `"assertive"` per the level arg)
	 * and removes it on the next animation frame so the DOM doesn't grow.
	 */
	announce(this: Internals, text: string, level?: 'polite' | 'assertive'): void {
		if (typeof document === 'undefined' || !this.container)
			return;
		const node = document.createElement('div');
		node.setAttribute('role', 'status');
		node.setAttribute('aria-live', level === 'assertive' ? 'assertive' : 'polite');
		node.style.position = 'absolute';
		node.style.left = '-9999px';
		node.style.width = '1px';
		node.style.height = '1px';
		node.style.overflow = 'hidden';
		node.textContent = text;
		this.container.appendChild(node);
		// Remove after a tick so screen readers have time to pick it up.
		setTimeout(() => {
			if (node.parentNode === this.container) {
				this.container.removeChild(node);
			}
		}, 1500);
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: DOM construction helpers — re-exposes the dom.ts builder functions
// on the player so plugins/UI authors can chain via `this.player.createElement(...)`
// matching the v1 ergonomics. Pure delegations; no extra state.
// ──────────────────────────────────────────────────────────────────────────

export const domMethods = {
	createElement<K extends keyof HTMLElementTagNameMap>(
		this: Internals,
		type: K,
		id: string,
		unique?: boolean,
	): ReturnType<typeof domCreateElement<K>> {
		return domCreateElement(type, id, unique);
	},
	createButton(this: Internals, id: string, label: string, onClick: (e: Event) => void): HTMLButtonElement {
		return domCreateButton(id, label, onClick);
	},
	createSVG(this: Internals, id: string, viewBox: string): SVGSVGElement {
		return domCreateSVG(id, viewBox);
	},
	addClasses<T extends Element>(this: Internals, el: T, names: string[]): ReturnType<typeof domAddClasses<T>> {
		return domAddClasses(el, names);
	},
	removeClasses<T extends Element>(this: Internals, el: T, names: string[]): T {
		return domRemoveClasses(el, names);
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: loading — `load(item, opts)` / `loadQueue(url, parser?)`.
//
// Spec §L: `load(item)` fires `beforeLoad` (cancellable), then delegates to
// the active backend's `load(url)`. The library overrides `backend()` to
// return its concrete `IAudioBackend` / `IVideoBackend`; the mixin pulls
// the URL from the item, resolves auth.transformUrl, and emits the standard
// post-load events.
// ──────────────────────────────────────────────────────────────────────────

export const loadingMethods = {
	async load<T extends BasePlaylistItem & { url?: string }>(
		this: Internals,
		item: T,
		opts?: LoadOptions,
	): Promise<void> {
		_assertReady(this);

		// Capture phase before any async work so the loading transition
		// reflects the actual state at call time — not the state after
		// awaited setup-pipeline steps have already moved to 'ready'.
		const priorPhase = this._phase;

		const beforeResult = await _dispatchBefore<{ item: T; source?: string }>(
			this,
			'beforeLoad',
			{
				item,
				source: opts?.source,
			},
		);
		if (beforeResult.prevented) {
			this.emit('loadPrevented', {
				reason: beforeResult.reason ?? 'listener-prevented',
				cause: beforeResult.cause,
			});
			return;
		}

		// Resolve URL — `item.url` is the canonical field; `auth.transformUrl`
		// rewrites it (e.g. for custom-scheme streams or pre-signed URLs).
		const item2 = beforeResult.data.item;
		let url = (item2 as { url?: string }).url;
		if (!url) {
			throw new MediaFormatError({
				code: 'core:media/missing-url',
				severity: 'error',
				scope: { kind: 'core' },
				message: 'load(item) requires `item.url` to be present.',
				context: { id: item2.id },
			});
		}
		const transformer = this._authConfig?.transformUrl;
		if (transformer) {
			url = await transformer(url);
		}

		const resolvedItem = await _resolveItemTrackUrls(this, item2);
		if (resolvedItem !== item2) {
			this._queueList.replaceItem(resolvedItem);
		}

		// Phase: ready/playing/paused/starting → loading while the backend
		// mounts. idle/setup are excluded: when load() is called before the
		// setup pipeline has finished (initial auto-load pattern), the player
		// has never shown content, so flashing loading→paused is noise and
		// causes a test-visible oscillation. The setup pipeline ends with
		// _transitionPhase('ready') which maps to 'paused' on the container,
		// giving a clean settled state once backend.load() completes.
		if (priorPhase === 'ready' || priorPhase === 'playing' || priorPhase === 'paused' || priorPhase === 'starting') {
			_transitionPhase(this, 'loading');
		}

		// Race-guard: bump a monotonic load epoch and capture it. When the
		// consumer fires p.load(A) and p.load(B) in quick succession, the
		// older call's continuation otherwise lands AFTER the newer one and
		// drags cursor / phase / opts back to A — bridges that listen to
		// `current` then chase B again, producing a load-loop. Anything
		// observably side-effectful AFTER the awaited backend.load only
		// runs when our epoch is still the latest.
		const epoch = (this._loadEpoch ?? 0) + 1;
		this._loadEpoch = epoch;
		const isLatest = (): boolean => this._loadEpoch === epoch;

		try {
			const backend = _backend(this);
			if (!backend || typeof backend.load !== 'function') {
				throw new StateError({
					code: 'core:player/backend-missing',
					severity: 'error',
					scope: { kind: 'core' },
					message: 'No backend wired — backend() returned null/undefined.',
				});
			}
			await backend.load(url);
			if (!isLatest()) return;

			// Move cursor to the loaded item so consumer-facing `current()` reflects it.
			// Use setCurrent directly — calling this.current() here would re-trigger load().
			// Guard: skip if the cursor is already at this item (e.g. current() mixin
			// moved it before calling load()) to prevent a duplicate `current` event.
			const alreadyCurrent = this._queueList.current()?.id === item2.id;
			if (!alreadyCurrent) {
				this._queueList.setCurrent(item2.id ?? item2);
			}

			// Honour LoadOptions.startAt by seeking once metadata is available.
			if (typeof opts?.startAt === 'number' && opts.startAt > 0) {
				const ret = this.currentTime(opts.startAt);
				if (ret instanceof Promise)
					await ret;
				if (!isLatest()) return;
			}

			// Honour LoadOptions.fadeIn by ramping volume from 0→current over the configured seconds.
			// Trivial fade — no easing curve. Plugins extend.
			if (typeof opts?.fadeIn === 'number' && opts.fadeIn > 0) {
				const rawVolume = this.volume();
			const target = typeof rawVolume === 'number' ? rawVolume : 1;
				this.volume(0);
				const steps = 20;
				const stepMs = (opts.fadeIn * 1000) / steps;
				for (let i = 1; i <= steps; i++) {
					await new Promise(r => setTimeout(r, stepMs));
					if (!isLatest()) return;
					this.volume((target * i) / steps);
				}
			}

			if (!isLatest()) return;
			// Restore phase to ready (or whatever state the backend resolved to).
			if (this._phase === 'loading') {
				_transitionPhase(this, 'ready');
			}
			this.emit('mediaReady');
		}
		catch (err) {
			// Restore phase on failure.
			if (this._phase === 'loading' && (priorPhase === 'ready' || priorPhase === 'playing' || priorPhase === 'paused')) {
				_transitionPhase(this, priorPhase);
			}
			throw err;
		}
	},

	async loadQueue<T extends BasePlaylistItem>(
		this: Internals,
		url: string,
		parser?: (raw: string) => T[],
	): Promise<void> {
		_assertReady(this);

		this.emit('playlistResolving', { url });

		// Use authFetch under the hood so the consumer's auth pipeline is honored.
		const config = this.options ?? {};
		const ctrl = new AbortController();
		try {
			const items = await authFetch<T[]>({
				url,
				auth: this._authConfig ?? config.auth,
				parser: parser ?? ((raw: string): T[] => JSON.parse(raw)),
				emit: (event: string, data: unknown) => this.emit(event, data),
				pluginId: undefined,
				scope: 'player',
				signal: ctrl.signal,
			});
			this.queue(items);
			this.emit('playlistReady', { length: items.length });
		}
		catch (err) {
			const errorPayload = {
				error: err instanceof Error ? err : new Error(String(err)),
				severity: 'error' as const,
				scope: { kind: 'core' as const },
				timestamp: Date.now(),
				markHandled: () => {},
				isHandled: () => false,
				stopImmediatePropagation: () => {},
				isPropagationStopped: () => false,
				preventDefault: () => {},
				isDefaultPrevented: () => false,
			};
			this.emit('playlistResolveError', errorPayload);
			this.emit('error', errorPayload);
			throw err;
		}
	},
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Mixin: preload + transition strategy swappers
// ──────────────────────────────────────────────────────────────────────────

export const preloadStrategyMethods = {
	/**
	 * Replace the active preload strategy at runtime. The new strategy takes
	 * effect on the next `time` tick. Cancels any in-flight prefetch first.
	 */
	setPreloadStrategy(this: Internals, strategy: PreloadStrategy): void {
		this._preloadStrategy.cancel();
		this._preloadFired = false;
		this._preloadStrategy = strategy;
	},

	/**
	 * Replace the active transition strategy at runtime. Cancels any in-progress
	 * transition first (emitting `transitionCancelled`).
	 */
	setTransitionStrategy(this: Internals, strategy: TransitionStrategy): void {
		if (this._transitionRafHandle !== undefined) {
			cancelAnimationFrame(this._transitionRafHandle);
			this._transitionRafHandle = undefined;
		}
		this._transitionStrategy.cancel('strategy-replaced');
		this.emit('transitionCancelled', { reason: 'strategy-replaced' });
		this._transitionFired = false;
		this._transitionStrategy = strategy;
	},

	/** Return the active preload strategy instance. */
	preloadStrategy(this: Internals): PreloadStrategy {
		return this._preloadStrategy;
	},

	/** Return the active transition strategy instance. */
	transitionStrategy(this: Internals): TransitionStrategy {
		return this._transitionStrategy;
	},
} as const;


// ──────────────────────────────────────────────────────────────────────────
// Convenience aggregator — every shared mixin in one tuple. Player libraries
// `composeMixins(MyPlayer.prototype, ...playerCoreMethods)` and they're
// fully wired.
// ──────────────────────────────────────────────────────────────────────────

export const playerCoreMethods = [
	lifecycleMethods,
	baseUrlAudioContextMethods,
	experimentalDescriptor,
	i18nMethods,
	cueParserMethods,
	transportMethods,
	timeMethods,
	volumeMethods,
	stateMethods,
	playerStateMethods,
	queueMethods,
	pluginRegistrationMethods,
	authMethods,
	streamRegistrationMethods,
	mediaTracksMethods,
	deviceMethods,
	audioOutputMethods,
	castMethods,
	abrMethods,
	metricsMethods,
	domMethods,
	loadingMethods,
	containerClassEmitMethods,
	preloadStrategyMethods,
] as const;
