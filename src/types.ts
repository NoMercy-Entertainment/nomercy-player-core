import type { CueParser } from './cues/parser-registry';
import type { AddClasses, CreateElement } from './dom';
import type { PlayerErrorEvent } from './errors';
import type { ILogger } from './logger';
import type { IPlatform } from './platform';
import type { RealtimeFactory } from './realtime';
import type { IStorage } from './storage';
import type { ITranslator } from './translator';

/** Anything in a queue must at least have an id. */
export interface BasePlaylistItem {
	id: string | number;
}

/**
 * Source attribution for actions. Every transport / queue mutation accepts a
 * `source` (default `'user'`) and emits the resulting event with `source`
 * stamped on it. Lets remote-sync plugins filter out their own remote-applied
 * actions to avoid re-broadcast loops.
 */
export type ActionSource = 'user' | 'remote' | 'plugin' | (string & {});

/** Common options accepted by every transport / queue / load action. */
export interface ActionOptions {
	source?: ActionSource;
	silent?: boolean;
}

/** `LoadOptions` — passed to `player.load(item, opts?)`. */
export interface LoadOptions extends ActionOptions {
	slot?: 'current' | 'next';
	startAt?: number;
	fadeIn?: number;
}

/** Lifecycle phase the player is in. Returned by `player.setupState()`. */
export enum SetupState {
	NOT_SETUP = 'not-setup',
	SETTING_UP = 'setup',
	READY = 'ready',
	DISPOSED = 'disposed',
}

/** Buffer state. Returned by `player.bufferState()`. */
export enum BufferState {
	IDLE = 'idle',
	LOADING = 'loading',
	SEEKING = 'seeking',
	STALLED = 'stalled',
}

/** Network state. Returned by `player.networkState()`. */
export enum NetworkState {
	ONLINE = 'online',
	OFFLINE = 'offline',
	SLOW = 'slow',
}

/** Visibility state. Returned by `player.visibilityState()`. */
export enum VisibilityState {
	VISIBLE = 'visible',
	HIDDEN = 'hidden',
}

/** Cast state. Returned by `player.castState()`. */
export enum CastState {
	UNAVAILABLE = 'unavailable',
	AVAILABLE = 'available',
	CONNECTING = 'connecting',
	CONNECTED = 'connected',
	DISCONNECTED = 'disconnected',
}

/** Logger verbosity level. Replaces boolean `debug`. */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Device capability snapshot. Returned by `player.device()`. Aggregates
 * environment detection (`isTv()` etc.) plus capability probes.
 */
export interface DeviceCapabilities {
	isTv: boolean;
	isMobile: boolean;
	isDesktop: boolean;
	pipSupported: boolean;
	fullscreenSupported: boolean;
	webLocksSupported: boolean;
	autoplayAllowed: boolean | 'unknown';
	preferred: 'smooth' | 'powerEfficient';
}

/**
 * Performance metrics tracked automatically by the player. Snapshotted via
 * `player.metrics()`; emitted periodically via `playback:metrics`.
 */
export interface PlaybackMetrics {
	ttfb: number;
	ttff: number;
	rebufferRatio: number;
	avgBitrate: number;
	droppedFrames: number;
	decoderStalls: number;
	joinTime: number;
	sessionDurationMs: number;
	[customMetric: string]: number;
}

/** Quality level metadata returned by `qualityLevels()` and stream sources. */
export interface QualityLevel {
	bitrate: number;
	height?: number;
	width?: number;
	label: string;
	index: number;
}

/** Audio track metadata returned by `audioTracks()`. */
export interface AudioTrack {
	id: string;
	language?: string;
	label: string;
	channels?: number;
	default?: boolean;
}

/** Subtitle track metadata returned by `subtitles()`. */
export interface SubtitleTrack {
	id: string;
	language?: string;
	label: string;
	kind?: 'subtitles' | 'captions' | 'descriptions';
	url: string;
	default?: boolean;
	/** Optional flavor — `'sdh' | 'forced' | 'full' | …`. Persisted by
	 *  preference plugins so a saved "English (SDH)" pick doesn't get
	 *  swapped for "English (Full)" on the next load. */
	type?: string;
}

/**
 * Single subtitle cue, normalised across sources. Renderers consume this
 * shape regardless of whether the cue came from a native HLS/DASH text
 * track or a sidecar VTT.
 *
 * `text` keeps renderer-safe inline tags (`<i>`, `<b>`, `<u>`); pass it
 * through `buildSubtitleFragment` to produce a safe DOM tree.
 * `plainText` is the same content with every tag stripped — useful for
 * accessibility / debug overlays / DOM-less environments.
 */
export interface SubtitleCue {
	text: string;
	plainText: string;
	/** WebVTT `line:` setting (0–100 percent), or `undefined` for auto. */
	line?: number;
	/** WebVTT `align:` normalised to start | center | end. Legacy
	 *  `middle` / `left` / `right` are folded into the canonical three. */
	align: 'start' | 'center' | 'end';
	/** WebVTT `size:` setting (0–100, percent of safe area). Defaults to 100. */
	size: number;
	/** WebVTT `position:` setting (0–100, percent). The horizontal anchor
	 *  of the cue box — combined with `align` it determines where the box
	 *  sits inside the safe area. `undefined` means "auto" (default value
	 *  per spec is 0/50/100 derived from `align`). */
	position?: number;
}

/** Payload for the `subtitleCue` event — the active cue list, or empty. */
export interface SubtitleCueChange {
	cues: SubtitleCue[];
	/** Active track language (BCP-47), if known. */
	language?: string;
}

/**
 * User-controlled subtitle styling. Written via `player.subtitleStyle({...})`,
 * persisted by preference plugins, applied by overlay renderers. Mirrors v1's
 * `defaultSubtitleStyles` so saved menus migrate cleanly.
 */
export interface SubtitleStyle {
	/** Percentage of the renderer's base font size (default 100). */
	fontSize: number;
	fontFamily: string;
	textColor: string;
	/** 0–100 (percent). Folded into the alpha byte at render time. */
	textOpacity: number;
	backgroundColor: string;
	backgroundOpacity: number;
	edgeStyle: 'none' | 'depressed' | 'dropShadow' | 'raised' | 'uniform' | 'textShadow';
	areaColor: string;
	windowOpacity: number;
}

/** Aggregated time state — returned by `player.timeData()`. */
export interface TimeState {
	position: number;
	duration: number;
	buffered: number;
	remaining: number;
	percentage: number;
}

/** Chapter metadata. */
export interface Chapter {
	index: number;
	start: number;
	end: number;
	title: string;
}

/** Cue lifecycle event payload (re-emitted by player when a CueTracker is attached). */
export interface CueEventPayload {
	trackerId: string;
	cue: { start: number; end: number; payload: unknown };
}

/** Events every player built on the kit emits. */
export interface BaseEventMap {
	// Lifecycle / setup-stage
	'beforeSetup': void;
	'setupStart': { container: HTMLElement };
	'configResolved': { config: BasePlayerConfig };
	'pluginsRegistering': void;
	'pluginsRegistered': void;
	'streamsReady': void;
	'authReady': void;
	'playlistResolving': { url: string };
	'playlistReady': { length: number };
	'mediaReady': void;
	'ready': void;

	// Stage failure events — every setup stage has a paired error event so
	// telemetry / error UI can localize the failure point.
	'setupStartError': PlayerErrorEvent;
	'configResolvedError': PlayerErrorEvent;
	'pluginsRegisteringError': PlayerErrorEvent;
	'pluginsRegisteredError': PlayerErrorEvent;
	'streamsReadyError': PlayerErrorEvent;
	'authReadyError': PlayerErrorEvent;
	'playlistResolveError': PlayerErrorEvent;
	'mediaReadyError': PlayerErrorEvent;

	// Play-path lifecycle — every `before*` is cancellable + delayable
	'beforePlay': BeforeEvent<ActionOptions>;
	'playRequested': ActionOptions;
	'firstFrame': void;
	'playing': ActionOptions;
	'playPrevented': { reason: PreventedReason; cause?: unknown };
	'beforePause': BeforeEvent<ActionOptions>;
	'pausePrevented': { reason: PreventedReason; cause?: unknown };
	'beforeStop': BeforeEvent<ActionOptions>;
	'stopPrevented': { reason: PreventedReason; cause?: unknown };
	'beforeNext': BeforeEvent<ActionOptions>;
	'nextPrevented': { reason: PreventedReason; cause?: unknown };
	'beforePrevious': BeforeEvent<ActionOptions>;
	'previousPrevented': { reason: PreventedReason; cause?: unknown };
	'beforeSeek': BeforeEvent<{ time: number; source?: ActionSource }>;
	'seekPrevented': { reason: PreventedReason; cause?: unknown };
	'beforeLoad': BeforeEvent<{ item: BasePlaylistItem; source?: ActionSource }>;
	'loadPrevented': { reason: PreventedReason; cause?: unknown };

	// Phase-aware mutation contract — fires before any state-mutating method.
	// Hot methods opt-in via `setup({ mutationGuards: [...] })`; normal mutations
	// fire by default. `setup({ mutationGuards: false })` disables entirely.
	//
	// `phase` carries the coarse playback state. `dispatchStack` is the chain
	// of currently-dispatching events (innermost last) — empty if the mutation
	// was called from app code, populated if called from inside an event handler.
	// Use `dispatchStack` to detect "inside a beforePlay handler" or even
	// "inside another plugin's custom before-event handler."
	'beforeMutation': BeforeEvent<{
		method: string;
		args: ReadonlyArray<unknown>;
		phase: PlayerPhase;
		dispatchStack: ReadonlyArray<string>;
	}>;
	'mutationPrevented': { method: string; reason: PreventedReason; cause?: unknown };

	// Phase transitions — coarse-grained lifecycle. Fires every time the player
	// moves between phases. Plugins building UI overlays / debug tooling watch
	// this to track what's happening.
	'phase': { from: PlayerPhase; to: PlayerPhase };

	// Standard transport
	'play': ActionOptions;
	'pause': ActionOptions;
	'stop': ActionOptions;
	'next': ActionOptions;
	'previous': ActionOptions;
	'ended': void;
	'seek': { time: number; source?: ActionSource };
	'time': { time: number };
	'dispose': void;

	// Volume + mode state changes. Library event maps (MusicEventMap, VideoEventMap)
	// override the `state` typing on `repeat`/`shuffle` with their concrete enum.
	'volume': { level: number };
	'mute': { muted: boolean };
	'repeat': { state: 'off' | 'all' | 'one' };
	'shuffle': { state: 'off' | 'on' };

	// Severity-tier error events
	'fatal': PlayerErrorEvent;
	'error': PlayerErrorEvent;
	'warning': PlayerErrorEvent;
	'info': PlayerErrorEvent;

	// Cursor / item change — fires every time the active item changes.
	'current': { item: BasePlaylistItem | undefined; index: number };

	// Queue mutation events (re-emitted from MediaList<T>)
	'queue': BasePlaylistItem[];
	'queue:append': { items: BasePlaylistItem[]; from: number };
	'queue:prepend': { items: BasePlaylistItem[] };
	'queue:insert': { items: BasePlaylistItem[]; index: number };
	'queue:remove': { id: string | number; index: number; item: BasePlaylistItem };
	'queue:move': { from: number; to: number };
	'queue:clear': { previousLength: number };
	'queue:shuffle': void;
	'queue:sort': void;

	// Backlog / history — items already played. Separate MediaList<T> at the
	// player level. `next()` pushes the current item onto the backlog before
	// advancing; `previous()` pops the backlog top back to current.
	'backlog': BasePlaylistItem[];
	'backlog:append': { items: BasePlaylistItem[] };
	'backlog:remove': { id: string | number; index: number; item: BasePlaylistItem };
	'backlog:clear': { previousLength: number };

	// Duration became known for the active item. Re-emitted when the backend
	// resolves duration; useful for UIs that need an up-front "duration ready"
	// signal without polling currentTime.
	'duration': { duration: number };

	// Backend lifecycle
	'backend:changed': { kind: string };
	'backend:loading': { url: string; kind: string };
	'backend:loaded': { url: string; kind: string; duration: number };
	'backend:error': { error: PlayerErrorEvent['error']; kind: string };
	'backend:stalled': { time: number };
	'backend:ratechange': { rate: number };
	'backend:waiting': void;

	// Auth runtime
	'auth:refreshed': { tokenAcquiredAt: number };
	'auth:expired': { lastValidAt: number };
	'auth:failed': { error: PlayerErrorEvent['error'] };

	// Stream-level (re-exposed from active StreamSource)
	'stream:manifest-loaded': { url: string };
	'stream:level-switched': { level: number; label: string };
	'stream:fragment-loaded': { url: string; durationMs: number };
	'stream:level-considered': { candidate: number; decided: number; reason: string };
	'stream:error': { details: string; fatal: boolean };
	'stream:encrypted': { initData: ArrayBuffer; initDataType: string };

	// Cue tracker
	'cue:enter': CueEventPayload;
	'cue:exit': CueEventPayload;

	// Subtitle cue stream — unified across sidecar VTT (kit-driven) and
	// native HLS / MSE / WebCodecs text tracks (backend-driven). Fires on
	// every cuechange / enter+exit boundary; `cues: []` means "between
	// cues" or "subtitles disabled".
	'subtitleCue': SubtitleCueChange;

	// Subtitle styling — written by `player.subtitleStyle({...})`, read
	// by overlay renderers + settings menus. The merged record is emitted
	// so subscribers don't need to re-fetch.
	'subtitleStyle': SubtitleStyle;
	'subtitle': { track: number | null };

	// Audio track selection — emitted by `setAudioTrack(idx)`. `id`
	// follows the kit's `audioTracks()` index space so consumers don't
	// have to re-resolve.
	'audioTrack': { id: number | null };

	// HLS-style adaptive level switch — emitted by stream parsers
	// (`packages/.../streams/hls.ts`) and forwarded by the v2 video
	// backend. `level` is the variant index in the manifest's level
	// list; renderers use `qualityLevels()` to look up the metadata.
	'level-switched': { level: number };

	// Plugin lifecycle channel
	'plugin:installed': { id: string; version: string };
	'plugin:enabled': { id: string };
	'plugin:disabled': { id: string; reason?: string };
	'plugin:opts:changed': { id: string; opts: unknown };
	'plugin:disposed': { id: string };
	'plugin:failed': { id: string; error: PlayerErrorEvent['error'] };
	'plugin:error': PlayerErrorEvent;
	'plugin:warning': PlayerErrorEvent;

	// Network / visibility / connectivity
	'network:online': void;
	'network:offline': void;
	'network:slow': { rttMs: number };
	'visibility:visible': void;
	'visibility:hidden': void;

	// Performance metrics
	'playback:metrics': PlaybackMetrics;

	// Embed-context (when EmbedPlugin is registered)
	'embed:host-attached': { origin: string };
	'embed:host-detached': void;
	'embed:host-message': { data: unknown };

	/** Fetch lifecycle — observability for loading UI / telemetry / Sentry. */
	'fetch:start': { url: string; pluginId?: string };
	'fetch:retry': { url: string; attempt: number; reason: 'unauthenticated' | 'http-5xx' | 'timeout' | 'network'; delayMs: number; pluginId?: string };
	'fetch:complete': { url: string; ok: boolean; status?: number; durationMs: number; pluginId?: string };
}

/** Header value — static, sync getter, or async getter. */
export type AuthHeaderValue = string | (() => string) | (() => Promise<string>);

/**
 * Hint passed to a `UrlResolver` so custom implementations can branch on
 * the *consumer* of the URL — for example, only signing media URLs with
 * a CDN-specific token while leaving poster URLs untouched. Always a
 * lowercase string. Built-in callers use:
 *
 *  - `'media'`       — main playable URL (audio / video)
 *  - `'subtitle'`    — subtitle / caption URL
 *  - `'font'`        — font asset for libass
 *  - `'poster'`      — artwork / thumbnail
 *  - `'sprite'`      — sprite-VTT preview thumbnail strip
 *  - `'lyrics'`      — lyrics / LRC URL
 *  - `'cast'`        — URL handed to a Cast / AirPlay receiver
 *  - `'license'`     — DRM license URL
 *
 * Custom plugins may pass any string they like; the resolver should treat
 * unknown categories as a passthrough.
 */
export type UrlCategory = 'media' | 'subtitle' | 'font' | 'poster' | 'sprite' | 'lyrics' | 'cast' | 'license' | (string & {});

/**
 * Context handed to a custom `UrlResolver`. Provides everything a custom
 * resolver might need to make a routing decision without reaching into
 * private player state — auth config, baseUrl, the category hint, and a
 * fallback to the built-in resolver so custom resolvers can short-circuit
 * for some categories and delegate the rest.
 */
export interface UrlResolverContext {
	readonly auth: AuthConfig | undefined;
	readonly baseUrl: string | undefined;
	readonly category: UrlCategory;
	/** Built-in resolver (auth.transformUrl + buildResolvedUrl). */
	readonly defaultResolve: (url: string) => Promise<ResolvedUrl>;
}

/**
 * Pluggable URL resolver. Consumer-supplied via `setup({ urlResolver })`
 * or `setUrlResolver(fn)` at runtime. Returns a `ResolvedUrl` describing
 * the final form to hand to a non-`fetch()` consumer (Worker, `<video>.src`,
 * Cast receiver, MediaSource, ...).
 *
 * The default implementation applies `auth.transformUrl` and parses the
 * result with `buildResolvedUrl`. Custom resolvers replace that logic
 * wholesale — to extend rather than replace, call `ctx.defaultResolve`.
 *
 * Modeled as an interface (not a function-type alias) so consumers can
 * declaration-merge custom resolver shapes and tooling can pick up doc
 * comments on the call signature.
 */
export interface UrlResolver {
	(url: string, ctx: UrlResolverContext): Promise<ResolvedUrl> | ResolvedUrl;
}

/**
 * Structured URL returned by `player.resolveUrl(url)`. Contains the
 * post-`auth.transformUrl` form parsed into useful parts:
 *
 *  - `href` — the final URL string. Pass this to Workers / `<video>.src` /
 *    Cast receiver / etc.
 *  - `raw` — the unparsed input as supplied by the caller.
 *  - `scheme`, `origin`, `pathname`, `search`, `hash` — standard URL components.
 *  - `searchParams` — query-string accessor (`searchParams.get('token')`).
 *  - `ext` — lowercase file extension stripped of query/fragment, no leading
 *    dot. Empty string when the URL has no extension. **Use this** to gate
 *    on file type — `.split('.').pop()` smears across query strings.
 *  - `relative` — `true` when the input was relative and no `baseUrl` was
 *    available to absolutize against. `href` will be the relative form.
 *  - `toString()` — returns `href`, so template strings work transparently.
 */
export interface ResolvedUrl {
	readonly raw: string;
	readonly href: string;
	readonly scheme: string;
	readonly origin: string;
	readonly pathname: string;
	readonly ext: string;
	readonly search: string;
	readonly searchParams: URLSearchParams;
	readonly hash: string;
	readonly relative: boolean;
	toString(): string;
}

/**
 * Unified auth pipeline for every kit-internal fetch — playlist URLs at
 * setup, lyrics, subtitles, sprite previews, plugin `Plugin.fetch` calls.
 *
 * Hard rules baked in:
 *  - **401 (unauthenticated) → may invoke `refreshOnUnauthenticated`, retry once.**
 *  - **403 (unauthorized / forbidden) → propagates immediately. Never refreshed, never retried.**
 *  - Lint pack flags any code that handles 401 + 403 in the same branch.
 */
export interface AuthConfig {
	/** Convenience for the most common case — value goes into `Authorization: Bearer {value}`. */
	bearerToken?: AuthHeaderValue;

	/** Arbitrary headers — static, sync getter, async getter. */
	headers?: Record<string, AuthHeaderValue>;

	/** `credentials` mode for fetch. Use `'include'` for cookie/session-based auth. */
	credentials?: 'omit' | 'same-origin' | 'include';

	/**
	 * URL rewriter. Runs before fetch. Use this for custom-scheme URLs
	 * (`nmsync://...`), pre-signed URL generation, or any scheme-translation
	 * the consumer needs.
	 */
	transformUrl?: (url: string) => string | Promise<string>;

	/**
	 * Escape hatch — receives the live Request, returns a modified Request.
	 * For HMAC payload signing, AWS Signature v4, custom challenge-response,
	 * anything that doesn't fit the simpler fields above.
	 */
	signRequest?: (request: Request) => Request | Promise<Request>;

	/**
	 * Called ONLY on 401 responses. Implementer refreshes the token. After
	 * this resolves, the kit retries the original request once with the new
	 * `bearerToken` / `headers` values resolved fresh. Never invoked on 403.
	 */
	refreshOnUnauthenticated?: () => Promise<void>;

	/** Default 1. Set to 0 to disable retry-after-refresh entirely. */
	retryAfterRefresh?: number;
}

/** DRM sugar config — installs the DRM plugin automatically when present. */
export interface DrmConfig {
	keySystem: string;
	licenseUrl: string;
	certificate?: ArrayBuffer | string;
	customSignRequest?: (request: Request) => Request | Promise<Request>;
}

/** I18n bundles — `{ en: { 'core.network.timeout': '...' }, nl: { ... } }`. */
export type Translations = Record<string, Record<string, string>>;

/** Handler interface for log sinks. */
export type LogSink = (level: LogLevel, prefix: string, args: unknown[]) => void;

/**
 * Async loader for translation bundles. Receives a language tag, resolves to
 * a key→value map for that language. Player calls this on `setLanguage(lang)`
 * when no bundle is already loaded for `lang`. Return `undefined` when the
 * language isn't available so the player falls through to the existing
 * `translations` config (and ultimately the kit defaults).
 *
 * Use cases:
 *  - fetch from API (`return await player.fetch(`/i18n/${lang}.json`, JSON.parse)`)
 *  - dynamic import of bundled JSON (`return (await import(`./i18n/${lang}.json`)).default`)
 *  - hard-coded switch over included bundles
 */
export type TranslationLoader = (lang: string) => Promise<Record<string, string> | undefined>;

/** Configuration both players accept at setup. Each player extends this. */
export interface BasePlayerConfig {
	/** @deprecated — use `logLevel`. Maps to `'debug'` when true. */
	debug?: boolean;

	/** Logger verbosity. Replaces boolean `debug`. */
	logLevel?: LogLevel;

	/** Consumer-supplied logger. Any `ILogger` impl (kit's `Logger`, Pino, Winston, custom). */
	logger?: ILogger;

	baseUrl?: string;

	/** Initial volume (0..1). Default `1`. Both libraries respect this. */
	defaultVolume?: number;

	/** @deprecated — use `auth.bearerToken`. Kept for v1 compatibility shim. */
	accessToken?: string | (() => string);

	/** Auth pipeline applied to every kit-internal fetch. */
	auth?: AuthConfig;

	/** I18n language tag (`'en'`, `'nl-NL'`). Defaults to `navigator.language`. */
	language?: string;

	/** Translation bundles by language tag. The kit's English bundle is always merged underneath. */
	translations?: Translations;

	/**
	 * Async loader for translation bundles. Invoked on `setLanguage(lang)` when
	 * the bundle isn't already loaded. Use this to fetch from an API, dynamically
	 * import bundled JSON, or any other source. Return `undefined` to fall through
	 * to the static `translations` config.
	 */
	loadTranslations?: TranslationLoader;

	/**
	 * Fallback when `t(key)` finds no value. Default returns the key itself.
	 * Useful for surfacing missing keys to telemetry / dev-time overlays.
	 */
	onMissingTranslation?: (key: string, lang: string) => string;

	/** Pluggable storage backend. Default: `LocalStorageBackend`. */
	storage?: IStorage;

	/**
	 * Realtime channel factory used by `Plugin.websocket(url)`. Swap to inject
	 * SignalR / Socket.IO / custom transport. Default: `nativeWebSocketAdapter`.
	 */
	websocketFactory?: RealtimeFactory;

	/**
	 * Custom URL resolver invoked by `player.resolveUrl(url, category)`. Use
	 * to inject CDN-specific signing, per-category routing, or to short-circuit
	 * the auth pipeline for select asset types. Default applies
	 * `auth.transformUrl` + structured parsing via `buildResolvedUrl`.
	 *
	 * Custom resolvers can call `ctx.defaultResolve(url)` to delegate back to
	 * the built-in path for any category they don't want to handle.
	 */
	urlResolver?: UrlResolver;

	/**
	 * Pluggable translation engine. Default kit impl is a key+`{vars}` lookup
	 * over the merged bundle table. Swap to plug in i18next / FormatJS / custom
	 * for pluralization, gender, ICU MessageFormat, RTL handling, etc.
	 *
	 * When supplied, the engine owns translation state and the kit-level
	 * `translations` / `loadTranslations` / `language` config is forwarded to
	 * the engine at construction.
	 */
	translator?: ITranslator;

	/**
	 * Platform abstraction bundle. Defaults to `browserPlatform`. Native-shell
	 * consumers (Capacitor, Tauri, Electron) inject native equivalents via
	 * `setup({ platform: capacitorPlatform })` or partial overrides
	 * `setup({ platform: { ...browserPlatform, wakeLock: capacitorWakeLock } })`.
	 */
	platform?: IPlatform;

	/**
	 * Custom cue parsers registered before the kit's defaults (LRC, VTT,
	 * sprite-VTT). Use this for TTML, SRT, ASS-as-cues, or proprietary
	 * formats. Most-recently-registered wins, so consumer parsers can override
	 * built-ins for the same URL pattern.
	 */
	cueParsers?: ReadonlyArray<CueParser>;

	/** DRM sugar — auto-installs the `drm` plugin. */
	drm?: DrmConfig;

	/** How often the player emits `playback:metrics`. `0` disables. Default 10000. */
	metricsIntervalMs?: number;

	/** Pause when document goes hidden. Default `false` for both libraries. */
	pauseWhenHidden?: boolean;

	/** Behavior on `network:offline`. Default `'continue-buffered'`. */
	onOffline?: 'pause' | 'continue-buffered' | 'ignore';

	/** Wake-lock policy. Video defaults `'auto'`; music defaults `'never'`. */
	wakeLock?: 'auto' | 'always' | 'never';

	/** Clock source for timestamps used in distributed-sync plugins. Defaults to `Date.now`. */
	clockSource?: () => number;

	/** Cap on plugin `use()` Promise resolution before marking failed. Default 30000. */
	pluginInitTimeoutMs?: number;

	/**
	 * Cap on `BeforeEvent.delay(promise)` waits before timing out the action.
	 * Timeout = treated as `preventDefault`, fires `<action>Prevented` with
	 * `reason: 'delay-timeout'`. Default 10000ms.
	 */
	beforeEventTimeoutMs?: number;

	/**
	 * Phase-aware mutation guards. Controls which mutating methods fire the
	 * `beforeMutation` event (and run plugin advisories).
	 *
	 *  - `false` — disable entirely. Fastest path, no advisory checking.
	 *  - `'all'` — guard every mutating method including hot-path ones
	 *    (`currentTime`, `volume`, `playbackRate`, etc.). Use for dev/debug.
	 *  - `string[]` — guard only the named hot methods, in addition to the
	 *    always-on normal-mutation list.
	 *  - `undefined` (default) — guard only normal mutations
	 *    (`load`, `setCurrent`, `queue*`, `setSubtitle`, etc.); hot methods
	 *    skip the guard for performance.
	 */
	mutationGuards?: false | 'all' | ReadonlyArray<string>;

	/** Initial playlist. Pass items directly, or a URL the player will fetch. */
	playlist?: BasePlaylistItem[] | string;
}

/**
 * Player phase — the **complete ordered lifecycle** of a player instance.
 * Closed set, stable across versions. Captures every stable state the player
 * can be in, from `idle` (pre-setup) through `disposed` (post-teardown).
 *
 * Excludes event-dispatch windows (`beforePlay`, `beforeMutation`, etc.) on
 * purpose — those are transient dispatch states, not stable phases. Use
 * `player.dispatching()` to detect "currently inside a before-event handler."
 *
 * ## Linear progression
 *
 * ```
 *  idle
 *    │  constructor() → setup(config)
 *    ▼
 *  setting-up                            (config resolving, plugins registering, auth/streams/playlist mounting)
 *    │  ready event fires
 *    ▼
 *  ready                                 ← awaiting first command
 *    │  load(item)
 *    ▼
 *  loading                               (backend pulling source)
 *    │  loaded
 *    ▼
 *  ready                                 ← can also re-enter from paused/ended via load
 *    │  play()
 *    ▼
 *  starting                              (backend kicking up)
 *    │  firstFrame
 *    ▼
 *  playing  ⇄  buffering  ⇄  seeking
 *    │  pause()                ended (natural end)        stop() (explicit)
 *    ▼                          │                          │
 *  paused                       ▼                          ▼
 *    │ play()                 ended                      stopped
 *    ▼                          │  load / play / next       │  load / play
 *  starting                     ▼                          ▼
 *                             starting                   starting
 *  ─────────────────────────────────────────────────────────────────
 *  any phase ─ dispose() ─→  disposing  ─→  disposed
 * ```
 *
 * Plugins read `player.phase()` to know what's happening, OR listen to the
 * `phase` event for `{ from, to }` transitions. Combine with `dispatching()`
 * for "the player is `playing` AND currently dispatching `beforeSeek`."
 */
export type PlayerPhase
	= | 'idle' // before setup() runs — initial state
		| 'setup' // setup() in flight (config resolving, plugins registering, auth/streams/playlist mounting)
		| 'ready' // setup done OR loaded but not playing — awaiting commands
		| 'loading' // load(item) in flight — backend pulling source
		| 'starting' // play() called, backend kicking up — pre-firstFrame
		| 'playing' // backend producing output
		| 'paused' // user-paused or auto-paused
		| 'buffering' // buffer ran dry mid-playback (data underrun)
		| 'seeking' // seek in progress (transient)
		| 'ended' // natural end of current item
		| 'stopped' // explicit stop()
		| 'disposing' // dispose() called, teardown in flight
		| 'disposed'; // dispose complete

/**
 * Cancellable, mutable, async-aware event payload for every `before*` event.
 *
 *  - `data` is mutable. listeners modify it; the player reads back the mutated
 *    value when running the default action and when emitting the post-action
 *    event (`play`, `seek`, etc.).
 *  - `preventDefault()` skips the default action AND its post-event chain.
 *    consumers see a `<action>Prevented` event instead.
 *  - `stopImmediatePropagation()` skips remaining listeners on this event.
 *    does NOT prevent default — combine with `preventDefault()` if needed.
 *  - `delay(promise)` blocks the player on the given promise. multiple delays
 *    compose via `Promise.all`. one rejection = `preventDefault`. bounded by
 *    `setup({ beforeEventTimeoutMs })` (default 10000ms).
 */
export interface BeforeEvent<TData> {
	data: TData;
	preventDefault(): void;
	isDefaultPrevented(): boolean;
	stopImmediatePropagation(): void;
	isPropagationStopped(): boolean;
	delay(promise: Promise<unknown>): void;
	isDelayed(): boolean;
}

/**
 * Reason a cancellable action was prevented. Carried on `<action>Prevented`
 * events so consumers know why the action didn't run.
 */
export type PreventedReason
	= | 'listener-prevented' // a listener called preventDefault
		| 'delay-rejected' // a delay() promise rejected
		| 'delay-timeout'; // a delay() promise exceeded beforeEventTimeoutMs

/**
 * Plugin dependency declaration on `static requires`. Class refs are the
 * canonical form — type-safe, refactor-safe, and consistent with the typed
 * `on(PluginClass, ...)` event API.
 *
 * Plain class ref means the dep is required:
 *
 * ```ts
 * static readonly requires = [AudioGraphPlugin, CanvasPlugin];
 * ```
 *
 * Object form lets a plugin mark a dep optional or pin a minimum version:
 *
 * ```ts
 * static readonly requires = [
 *   AudioGraphPlugin,
 *   { plugin: MediaSessionPlugin, optional: true },
 *   { plugin: SpectrumPlugin, minVersion: '2.1.0' },
 * ];
 * ```
 *
 * At registration, required-missing throws `core:plugin/missing-dep`;
 * optional-missing logs a debug warning and the dependent plugin runs anyway.
 * Version mismatch throws `core:plugin/version-mismatch`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RequireSpec
	= | (new (...args: any[]) => { /* Plugin instance */ })
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
		| { plugin: new (...args: any[]) => { /* Plugin instance */ }; optional?: boolean; minVersion?: string };

/**
 * Declarative advisory — `static advisories` on a Plugin class. Lets plugins
 * declare invariants ("this method during this context is risky") without
 * writing handler code. At registration, the player merges every plugin's
 * advisories into a lookup; matching advisories auto-fire their severity
 * event when the corresponding mutation happens.
 *
 * A match requires every specified condition to hold:
 *  - `duringPhase` (if set) must include the current `player.phase()`
 *  - `duringEvent` (if set) must include the currently-dispatching event name
 *
 * If neither is set, the advisory matches any time the method is called.
 */
export interface PluginAdvisory {
	/** The mutating method this advisory watches (e.g. `'setCurrent'`, `'volume'`). */
	method: string;
	/** Coarse playback phase(s) that trigger the advisory. Optional — omit to match any phase. */
	duringPhase?: PlayerPhase | ReadonlyArray<PlayerPhase>;
	/**
	 * Event name(s) whose dispatch must be in flight for the advisory to match.
	 * Use this to advise specifically inside a `before*` handler — works for
	 * core events AND plugin-defined custom events.
	 *
	 * Example: `duringEvent: 'beforePlay'` matches mutations inside a beforePlay
	 * handler. `duringEvent: 'plugin:my-plugin:beforeFoo'` matches mutations
	 * inside another plugin's custom before-event handler.
	 */
	duringEvent?: string | ReadonlyArray<string>;
	/** Severity tier — controls which event channel the advisory fires on. */
	severity: 'info' | 'warning' | 'error';
	/** Short slug for the error code suffix. Final code: `plugin:<plugin-id>/<reason>`. */
	reason: string;
	/** Human-readable message shown to consumers / devtools. */
	message: string;
}

/**
 * Tier-4 override "detour" — last-resort namespace for behaviour overrides not
 * covered by `before*` events, `static replaces`, or subclass hooks.
 *
 * Lint rule `nmplayer/no-experimental` flags any call from inside plugin code.
 * Authors must add `eslint-disable-next-line nmplayer/no-experimental` with a
 * written reason. Consumer (app) code is free to use it without lint friction.
 *
 * Auto-restore: every override registers its caller (a plugin id, or `'consumer'`
 * if called from app code); when that plugin disposes, the original method is
 * restored. Manual restore via the returned unbinder or `experimental.restore`.
 *
 * Discoverable via `experimental.overrides()` so devtools / debug UIs can surface
 * which methods have been monkey-patched and by whom.
 */
export interface PlayerExperimental {
	override<K extends string>(method: K, fn: (...args: any[]) => any): () => void;
	restore(method: string): void;
	overrides(): Array<{ method: string; by: string | 'consumer' }>;
}

/**
 * Constructor input for both player libraries — preserves the v1 video-player
 * shape so existing consumers can migrate without rewriting their factory call.
 *
 * Three forms:
 *  - `nmplayer()` — no arg. Returns the **first** registered instance from the
 *    library's per-class registry, or throws `core:player/no-element` when no
 *    instance exists yet.
 *  - `nmplayer('myDiv')` — string. The id of a `<div>` in the DOM. If an
 *    instance with that id already exists, returns it (idempotent factory).
 *    Otherwise mounts to the matching div and registers a fresh instance.
 *    Throws `core:player/element-missing` when the div is absent;
 *    `core:player/element-not-div` when the matching element is not a `<div>`.
 *  - `nmplayer(42)` — number. Index into the library's registry, ordered by
 *    registration. Throws `core:player/not-found` when no instance with that
 *    index exists.
 *
 * Invalid types (boolean, object, etc.) throw `core:player/invalid-id-type`.
 *
 * The registry is per-library (music + video each have their own) so the same
 * id can be in use by both without collision.
 */
export type PlayerConstructorId = string | number;

/**
 * Minimum surface a "player" object exposes that the kit relies on.
 * Both NMMusicPlayer and NMVideoPlayer satisfy this.
 *
 * Cross-library-shared accessors (`baseUrl`, `audioContext`) live here so
 * plugins typed against `IPlayer` work uniformly against either player and
 * each library doesn't redeclare them.
 */
export interface IPlayer<E extends BaseEventMap = BaseEventMap> {
	/** Stable identifier set at construction. Mirrors v1 `playerId`. */
	readonly playerId: string;

	/**
	 * Alias for `playerId`. Reads back the id passed to the constructor.
	 * Provided so consumers can write `player.id` per the v1 wiki convention.
	 */
	readonly id: string;

	readonly container: HTMLElement;
	on<K extends keyof E>(event: K, fn: (data: E[K]) => void): void;
	off<K extends keyof E>(event: K, fn: (data: E[K]) => void): void;
	once<K extends keyof E>(event: K, fn: (data: E[K]) => void): void;
	emit<K extends keyof E>(event: K, data?: E[K]): void;
	hasListeners<K extends keyof E>(event: K): boolean;

	/**
	 * Runtime base URL. Read with no args; write with a string. Mirrors
	 * `BasePlayerConfig.baseUrl` so consumers can swap the URL after `setup()`
	 * without re-initialising the player.
	 */
	baseUrl(): string | undefined;
	baseUrl(url: string): void;

	/**
	 * Player-owned `AudioContext`, lazily created on first user gesture.
	 * `undefined` until then. Plugins typed against `IPlayer` get raw audio
	 * graph access uniformly through this accessor.
	 */
	audioContext(): AudioContext | undefined;

	/**
	 * Resolve a URL through the configured `urlResolver` (or the default
	 * `auth.transformUrl` + structured-parse pipeline) and return a
	 * `ResolvedUrl` with parsed parts (origin, pathname, extension,
	 * searchParams, ...). Use anywhere a URL is handed to a non-`fetch()`
	 * consumer (Worker, `<video>.src`, Cast receiver, MediaSource, CSS) —
	 * i.e. anywhere custom Authorization headers cannot be attached.
	 *
	 * `category` lets custom resolvers route per consumer ('media',
	 * 'subtitle', 'cast', 'license', ...). Defaults to `'media'`.
	 *
	 * `href` and `toString()` give the post-transform string form so
	 * existing template-string interpolation continues to work.
	 */
	resolveUrl(url: string, category?: UrlCategory): Promise<ResolvedUrl>;

	/**
	 * Read or write the URL resolver at runtime.
	 *
	 * `urlResolver()` — returns the active custom resolver, or `undefined`
	 * when the built-in pipeline is active.
	 *
	 * `urlResolver(fn)` — replace the resolver. Pass `undefined` to revert to
	 * the built-in default. Useful when CDN credentials rotate and signing
	 * logic needs to swap without re-running `setup()`.
	 */
	urlResolver(): UrlResolver | undefined;
	urlResolver(resolver: UrlResolver | undefined): void;

	/** Tier-4 override namespace — see `PlayerExperimental` for full contract. */
	readonly experimental: PlayerExperimental;

	/**
	 * Current coarse playback phase (idle / setup / ready / playing / paused /
	 * stopped / ended / disposed). Fires the `phase` event on every transition.
	 *
	 * Phase is intentionally a small closed set — it does NOT enumerate event
	 * names. To check "am I currently inside a beforePlay handler", use
	 * `dispatching()` instead.
	 */
	phase(): PlayerPhase;

	/**
	 * Stack of currently-dispatching event names, innermost last. Empty when
	 * no event is dispatching (e.g. mutation called directly from app code).
	 *
	 * Inside a `beforePlay` handler: `['beforePlay']`.
	 * If that handler calls `current()` (which fires `beforeMutation`):
	 * `['beforePlay', 'beforeMutation']` from inside the inner handler.
	 *
	 * Plugins use this to detect "I'm inside another plugin's `beforeFoo`
	 * handler" — works for core events AND plugin-defined custom events.
	 */
	dispatching(): ReadonlyArray<string>;

	/**
	 * Translate a key against the active language. Player-scoped — plugins
	 * have their own auto-namespaced `this.t()`.
	 */
	t(key: string, vars?: Record<string, string>): string;

	/**
	 * Active language tag. Read with no args; write with a string.
	 *
	 * Setting triggers `loadTranslations` (player + every plugin's
	 * `loadTranslations`) when the bundle isn't already loaded. The setter
	 * overload returns a Promise that resolves once all loaders settle.
	 */
	language(): string;
	language(lang: string): Promise<void>;

	/**
	 * Merge a translation bundle into the live table. Last write wins per key.
	 * Plugins normally use `static translations` instead of this.
	 */
	addTranslations(bundle: Translations): void;

	/**
	 * Read or write a single translation key.
	 *
	 * `translation(lang, key)` — returns the resolved value, or `undefined`
	 * when the key has no entry in `lang`.
	 *
	 * `translation(lang, key, value)` — set a single key under `lang`.
	 * Persists for the player's lifetime.
	 */
	translation(lang: string, key: string): string | undefined;
	translation(lang: string, key: string, value: string): void;

	/**
	 * Remove translations matching a key prefix. Pass `'plugin.lyrics.'` to
	 * unload an entire plugin namespace. Pass a `lang` to scope the removal;
	 * omit to remove from every language. Auto-invoked when a plugin disposes.
	 */
	removeTranslations(prefix: string, lang?: string): void;

	/**
	 * Register a custom cue-format parser (TTML, SRT, ASS-as-cues, custom
	 * proprietary formats). Most-recently-registered wins, so consumer parsers
	 * can override the kit's built-ins (LRC, VTT, sprite-VTT) for the same URL
	 * pattern.
	 */
	registerCueParser(parser: CueParser, prepend?: boolean): void;

	/** Unregister a cue parser by id. */
	unregisterCueParser(id: string): void;

	/**
	 * Read or write the auth config.
	 *
	 * `auth()` — frozen snapshot of the current config, or `undefined`.
	 * `auth(config)` — replace wholesale; emits `auth:refreshed`.
	 * `auth(partial)` — shallow-merge; emits `auth:refreshed`.
	 */
	auth(): Readonly<AuthConfig> | undefined;
	auth(config: AuthConfig): void;
	auth(partial: Partial<AuthConfig>): void;

	/**
	 * Read or write the active subtitle track.
	 *
	 * `currentSubtitle()` — index of the selected track, or `null` when off.
	 * `currentSubtitle(idx)` — select track; pass `null` to disable. Fires `subtitle`.
	 */
	currentSubtitle(): number | null;
	currentSubtitle(idx: number | null): void;

	/**
	 * Read or write the active audio track.
	 *
	 * `currentAudioTrack()` — index of the selected track, or `null` when unset.
	 * `currentAudioTrack(idx)` — select track. Fires `audioTrack`.
	 */
	currentAudioTrack(): number | null;
	currentAudioTrack(idx: number): void;

	/**
	 * Read or write the active quality level.
	 *
	 * `currentQuality()` — selected quality index, or `'auto'` for ABR.
	 * `currentQuality(idx)` — lock to a level or pass `'auto'` to restore ABR.
	 */
	currentQuality(): number | 'auto';
	currentQuality(idx: number | 'auto'): void;

	/**
	 * Read or seek by chapter.
	 *
	 * `currentChapter()` — the `Chapter` whose range contains `currentTime`,
	 * or `null` when none is active.
	 *
	 * `currentChapter(idx)` — jump to that chapter (same as `seekToChapter(idx)`).
	 */
	currentChapter(): Chapter | null;
	currentChapter(idx: number): void;

	/**
	 * Read or write the active audio output device.
	 *
	 * `currentAudioOutput()` — current `sinkId`, or `null` for system default.
	 * `currentAudioOutput(deviceId)` — route audio to `deviceId` via `setSinkId`.
	 * Returns `Promise<void>`. Throws `BrowserPolicyError` when unsupported.
	 */
	currentAudioOutput(): Promise<string | null>;
	currentAudioOutput(deviceId: string): Promise<void>;

	/**
	 * DOM construction helpers — fluent builders re-exposed on the player so
	 * UI plugins can chain `player.createElement('div', 'id').addClasses([...]).appendTo(parent)`.
	 * Mirrors the v1 ergonomics; no extra state or behaviour beyond delegating
	 * to the standalone helpers in `dom.ts`.
	 */
	createElement<K extends keyof HTMLElementTagNameMap>(type: K, id: string, unique?: boolean): CreateElement<HTMLElementTagNameMap[K]>;
	createButton(id: string, label: string, onClick: (e: Event) => void): HTMLButtonElement;
	createSVG(id: string, viewBox: string): SVGSVGElement;
	addClasses<T extends Element>(el: T, names: string[]): AddClasses<T>;
	removeClasses<T extends Element>(el: T, names: string[]): T;
}
