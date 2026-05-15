import type { CueParser } from './cues/parser-registry';
import type { AddClasses, CreateElement } from './core/mixins/dom-mixin';
import type { PlayerErrorEvent } from './errors';
import type { ILogger } from './logger';
import type { IPlatform } from './platform';
import type { RealtimeFactory } from './realtime';
import type { IStorage } from './storage';
import type { ITranslator } from './translator';

/**
 * The minimum shape every item in a player queue must satisfy. Both music and
 * video libraries extend this with their own domain-specific fields. The `id`
 * is the stable identity used by the queue, backlog, and cursor; it must be
 * unique within a session but does not need to be globally unique.
 */
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

/**
 * Common options accepted by every transport / queue / load action. Pass these
 * to give the action context about who triggered it and whether it should fire
 * lifecycle events.
 */
export interface ActionOptions {
	/** Who triggered this action. Defaults to `'user'`. */
	source?: ActionSource;
	/**
	 * When `true`, the action skips emitting the corresponding lifecycle event
	 * (`'play'`, `'pause'`, etc.) and its `before*` guard. Use for
	 * programmatic state restores that should not be observable as user intent.
	 */
	silent?: boolean;
	/** When `true`, the player calls `play()` immediately after the load resolves. */
	autoplay?: boolean;
}

/**
 * Options passed to `player.load(item, opts?)`. Extends `ActionOptions` with
 * fields that control where in the backend the item is loaded and how playback
 * starts.
 */
export interface LoadOptions extends ActionOptions {
	/**
	 * Target slot. `'current'` (default) loads the item into the active
	 * position and interrupts playback. `'next'` preloads without interrupting
	 * the currently-playing item — used by the preload pipeline.
	 */
	slot?: 'current' | 'next';
	/** Start playback at this position (seconds) instead of the beginning. */
	startAt?: number;
	/** Fade-in duration (seconds). `0` for an immediate start. */
	fadeIn?: number;
}

/**
 * Coarse lifecycle readiness state for the player instance. Returned by
 * `player.setupState()`. Useful for guarding UI actions that require the
 * player to have completed its setup sequence.
 */
export enum SetupState {
	/** `setup()` has not been called yet. */
	NOT_SETUP = 'not-setup',
	/** `setup()` is in flight — config resolving, plugins registering. */
	SETTING_UP = 'setup',
	/** Setup completed — the player is ready to accept commands. */
	READY = 'ready',
	/** `dispose()` completed — the instance is permanently shut down. */
	DISPOSED = 'disposed',
}

/**
 * Buffer state derived from the active backend. Returned by
 * `player.bufferState()`. Transitions from `idle` → `loading` → back to
 * `idle` on normal playback; spikes to `seeking` on seek and `stalled` when
 * the network can't keep up.
 */
export enum BufferState {
	/** No active media or buffer is comfortably ahead. */
	IDLE = 'idle',
	/** Backend is fetching the initial segments. */
	LOADING = 'loading',
	/** A seek is in progress and the buffer is repositioning. */
	SEEKING = 'seeking',
	/** Playback stalled because the buffer ran dry. */
	STALLED = 'stalled',
}

/**
 * Network connectivity state. Returned by `player.networkState()`. Updated
 * by the network monitor registered during setup; `ONLINE` when no monitor
 * is configured.
 */
export enum NetworkState {
	/** Network is reachable and delivering acceptable bandwidth. */
	ONLINE = 'online',
	/** No network connectivity detected. */
	OFFLINE = 'offline',
	/** Network is reachable but downlink is below the slow-connection threshold (1.5 Mbps). */
	SLOW = 'slow',
}

/**
 * Tab / document visibility state. Returned by `player.visibilityState()`.
 * Updated by the `document.visibilitychange` listener; `VISIBLE` when no
 * visibility monitor is configured.
 */
export enum VisibilityState {
	/** The player's document tab is in the foreground. */
	VISIBLE = 'visible',
	/** The player's document tab is hidden or minimised. */
	HIDDEN = 'hidden',
}

/**
 * Quality / bitrate selection mode. Returned by `player.qualityState()`.
 * Transitions from `AUTO` to `MANUAL` when the user or a plugin locks a
 * specific level; back to `AUTO` when they restore adaptive switching.
 */
export enum QualityState {
	/** Adaptive bitrate — the backend picks the best level automatically. */
	AUTO = 'auto',
	/** A specific quality level is locked by the consumer or a plugin. */
	MANUAL = 'manual',
}

/**
 * Audio track selection mode. Returned by `player.audioTrackState()`.
 * Transitions from `DEFAULT` to `MANUAL` once the user or a plugin explicitly
 * selects a track.
 */
export enum AudioTrackState {
	/** The backend's default audio track is active (no explicit selection). */
	DEFAULT = 'default',
	/** A track was explicitly chosen — preference plugins persist this pick. */
	MANUAL = 'manual',
}

/**
 * Cast / handoff state for the active Cast session. Returned by
 * `player.castState()` and carried on the `castState` event.
 */
export enum CastState {
	/** Cast is not available in this browser (SDK absent or no devices found). */
	UNAVAILABLE = 'unavailable',
	/** At least one Cast device is reachable; the user has not started a session. */
	AVAILABLE = 'available',
	/** A Cast session is being established. */
	CONNECTING = 'connecting',
	/** A Cast session is active and playback is delegated to the receiver. */
	CONNECTED = 'connected',
	/** A session was active but has ended (user disconnected, receiver lost, etc.). */
	DISCONNECTED = 'disconnected',
}

/**
 * Logger verbosity level. Controls how much output the player and its plugins
 * produce. Set via `BasePlayerConfig.logLevel`. Ordered from least to most
 * verbose: `silent` → `error` → `warn` → `info` → `debug` → `trace`.
 */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Device capability snapshot. Returned by `player.device()`. Aggregates
 * environment detection (`isTv`, `isMobile`, `isDesktop`) with capability
 * probes (`pipSupported`, `autoplayAllowed`, etc.) so plugins and consumers
 * can make a single call to branch on the runtime environment.
 */
export interface DeviceCapabilities {
	/** `true` when the browser is running on an Android TV / smart TV user-agent. */
	isTv: boolean;
	/** `true` when the browser is running on a phone or tablet. */
	isMobile: boolean;
	/** `true` when neither `isTv` nor `isMobile` is true. */
	isDesktop: boolean;
	/** `true` when the Picture-in-Picture API is available in this browser. */
	pipSupported: boolean;
	/** `true` when the Fullscreen API is available in this browser. */
	fullscreenSupported: boolean;
	/** `true` when the Web Locks API is available (used by the wake-lock polyfill). */
	webLocksSupported: boolean;
	/**
	 * Result of the autoplay probe. `true` = silent autoplay permitted;
	 * `false` = blocked; `'unknown'` = probe not yet run or inconclusive.
	 */
	autoplayAllowed: boolean | 'unknown';
	/**
	 * Recommended decode preference for this device. `'smooth'` for
	 * capable machines; `'powerEfficient'` for battery-constrained devices.
	 * Derived from the `MediaCapabilities` API.
	 */
	preferred: 'smooth' | 'powerEfficient';
}

/**
 * Performance metrics tracked automatically by the player. Snapshotted via
 * `player.metrics()`; emitted periodically via the `playback:metrics` event.
 * All timing values are in milliseconds unless noted otherwise.
 *
 * The index signature `[customMetric: string]: number` lets plugins publish
 * their own numeric counters under a namespaced key without extending this
 * interface.
 */
export interface PlaybackMetrics {
	/** Time-to-first-byte: ms from `load()` to the first network response byte. */
	ttfb: number;
	/** Time-to-first-frame: ms from `play()` to the `firstFrame` event. */
	ttff: number;
	/** Ratio of stalled time to total playback time (0–1). */
	rebufferRatio: number;
	/** Average received bitrate over the session (bits per second). */
	avgBitrate: number;
	/** Cumulative dropped video frames reported by the backend. */
	droppedFrames: number;
	/** Number of times the decoder stalled waiting for data. */
	decoderStalls: number;
	/** ms from page load to the first `play()` call (session join latency). */
	joinTime: number;
	/** Total active playback time in this session (ms). */
	sessionDurationMs: number;
	/** Extension slot — plugins add namespaced numeric counters here. */
	[customMetric: string]: number;
}

/**
 * Minimal decode-capability result returned by `player.canPlay(codec)`.
 * Maps directly onto the `MediaCapabilities.decodingInfo()` result so
 * consumers can gate quality-level selection on device capability.
 */
export interface CanPlayResult {
	/** `true` when the browser can decode this codec / container combination. */
	supported: boolean;
	/** `true` when the browser can decode smoothly (no dropped frames expected). */
	smooth: boolean;
	/** `true` when the browser can decode without excessive battery drain. */
	powerEfficient: boolean;
}

/**
 * Quality level metadata returned by `player.qualityLevels()` and populated
 * by stream parsers from the HLS manifest's `EXT-X-STREAM-INF` entries.
 * Consumers use this to render a quality picker.
 */
export interface QualityLevel {
	/** Stream bitrate in bits per second. */
	bitrate: number;
	/** Encoded video height in pixels, if known. */
	height?: number;
	/** Encoded video width in pixels, if known. */
	width?: number;
	/** Human-readable label (e.g. `'1080p'`). */
	label: string;
	/** Zero-based index in the manifest's level list. Pass to `currentQuality(idx)`. */
	index: number;
	/**
	 * Set when `qualityLevels({ includeUnsupported: true })` is called.
	 * `true` = browser can decode this level; `false` = `MediaCapabilities`
	 * reports it as unsupported.
	 */
	supported?: boolean;
	/**
	 * `'hdr'` for streams tagged as HDR (HLS `VIDEO-RANGE` of `PQ` / `HLG`),
	 * `'sdr'` otherwise. Consumers can hide HDR levels when the active
	 * display does not advertise HDR support via `matchMedia('(dynamic-range: high)')`.
	 */
	dynamicRange?: 'sdr' | 'hdr';
}

/**
 * Audio track metadata returned by `player.audioTracks()`. Populated by the
 * active backend from the manifest's audio rendition list.
 */
export interface AudioTrack {
	/** Stable track identifier within this manifest. Pass to `currentAudioTrack(id)`. */
	id: string;
	/** BCP-47 language tag, if the manifest provides one (e.g. `'en'`, `'nl-NL'`). */
	language?: string;
	/** Human-readable label (e.g. `'English'`, `'Stereo'`). */
	label: string;
	/** Channel count, if reported by the manifest (e.g. `2` for stereo, `6` for 5.1). */
	channels?: number;
	/** `true` when this track is the manifest's default selection. */
	default?: boolean;
}

/**
 * Subtitle track metadata returned by `player.subtitles()`. Populated by the
 * active backend from the manifest's subtitle rendition list, augmented with
 * any sidecar tracks the consumer registered on the playlist item.
 */
export interface SubtitleTrack {
	/** Stable track identifier within this manifest. Pass to `currentSubtitle(id)`. */
	id: string;
	/** BCP-47 language tag, if provided (e.g. `'en'`, `'nl-NL'`). */
	language?: string;
	/** Human-readable label (e.g. `'English (SDH)'`). */
	label: string;
	/** WebVTT / HLS kind hint. */
	kind?: 'subtitles' | 'captions' | 'descriptions';
	/** URL of the subtitle resource. */
	url: string;
	/** `true` when this track is the manifest's default selection. */
	default?: boolean;
	/**
	 * Optional flavor string — e.g. `'sdh'`, `'forced'`, `'full'`. Persisted
	 * by preference plugins so a saved `'English (SDH)'` pick is not silently
	 * swapped for `'English (Full)'` on the next load.
	 */
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
	/**
	 * WebVTT `align:` normalised to `start | center | end`. Legacy values
	 * `middle` / `left` / `right` are folded into the canonical three.
	 */
	align: 'start' | 'center' | 'end';
	/** WebVTT `size:` setting (0–100, percent of safe area). Defaults to 100. */
	size: number;
	/**
	 * WebVTT `position:` setting (0–100, percent). The horizontal anchor
	 * of the cue box — combined with `align` it determines where the box
	 * sits inside the safe area. `undefined` means "auto" (derived from
	 * `align` per the WebVTT spec).
	 */
	position?: number;
}

/** Payload for the `subtitleCue` event — the active cue list, or empty. */
export interface SubtitleCueChange {
	/** Active cues at this moment. Empty array means between cues or subtitles disabled. */
	cues: SubtitleCue[];
	/** Active track language (BCP-47), if known. */
	language?: string;
}

/**
 * User-controlled subtitle styling. Written via `player.subtitleStyle({...})`,
 * persisted by preference plugins, and applied by overlay renderers.
 * Consumers write partial updates — any field omitted keeps its current value.
 */
export interface SubtitleStyle {
	/** Percentage of the renderer's base font size. Default 100. */
	fontSize: number;
	/** CSS font-family string (e.g. `'Arial'`, `'inherit'`). */
	fontFamily: string;
	/** CSS color string for the subtitle text. */
	textColor: string;
	/** Text opacity, 0–100 (percent). Folded into the alpha byte at render time. */
	textOpacity: number;
	/** CSS color string for the per-line text background box. */
	backgroundColor: string;
	/** Background box opacity, 0–100 (percent). */
	backgroundOpacity: number;
	/** Text edge rendering style — controls shadow / outline around characters. */
	edgeStyle: 'none' | 'depressed' | 'dropShadow' | 'raised' | 'uniform' | 'textShadow';
	/** CSS color string for the full subtitle window area (behind all cues). */
	areaColor: string;
	/** Window area opacity, 0–100 (percent). */
	windowOpacity: number;
}

/**
 * Aggregated time state snapshot returned by `player.timeData()`. All values
 * are in seconds; `percentage` is in the range [0, 100].
 */
export interface TimeState {
	/** Current playback position (seconds). */
	position: number;
	/** Total duration of the active item (seconds). `0` when unknown. */
	duration: number;
	/** How far ahead the buffer extends from the current position (seconds). */
	buffered: number;
	/** Seconds remaining until the end of the item. */
	remaining: number;
	/** Playback progress as a percentage of total duration (0–100). */
	percentage: number;
}

/**
 * Chapter metadata for a single chapter in the active item's chapter list.
 * Chapters are populated from a sidecar WebVTT file or from embedded metadata;
 * the full list is available via `player.chapters()`.
 */
export interface Chapter {
	/** Zero-based chapter index in the chapter list. */
	index: number;
	/** Chapter start time (seconds). */
	start: number;
	/** Chapter end time (seconds). */
	end: number;
	/** Display name of the chapter. */
	title: string;
}

/**
 * Payload for the `cue:enter` and `cue:exit` events. Emitted by the player
 * when a `CueTracker` is attached to the active item and a timed cue crosses
 * its boundary.
 */
export interface CueEventPayload {
	/** The `CueTracker` instance that owns this cue. */
	trackerId: string;
	/** The cue that entered or exited, with its time range and arbitrary payload. */
	cue: { start: number; end: number; payload: unknown };
}

/**
 * The complete event map that every player built on the kit emits. Consumers
 * use these names with `player.on(name, handler)`. Library-specific maps
 * (e.g. `MusicEventMap`, `VideoEventMap`) extend this with domain-only events
 * and may narrow the payload types for shared events like `repeat` and `shuffle`.
 *
 * Every `before*` event is cancellable (`preventDefault()`), delayable
 * (`delay(promise)`), and stops propagation on request
 * (`stopImmediatePropagation()`). See `BeforeEvent<T>` for the full contract.
 */
export interface BaseEventMap {
	// ── Setup lifecycle ───────────────────────────────────────────────────────
	// Ordered sequence: beforeSetup → setupStart → configResolved →
	// pluginsRegistering → pluginsRegistered → streamsReady → authReady →
	// playlistResolving → playlistReady → mediaReady → ready.
	// Each stage has a paired error event; telemetry can localize failures.

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

	'setupStartError': PlayerErrorEvent;
	'configResolvedError': PlayerErrorEvent;
	'pluginsRegisteringError': PlayerErrorEvent;
	'pluginsRegisteredError': PlayerErrorEvent;
	'streamsReadyError': PlayerErrorEvent;
	'authReadyError': PlayerErrorEvent;
	'playlistResolveError': PlayerErrorEvent;
	'mediaReadyError': PlayerErrorEvent;

	// ── Play-path lifecycle ───────────────────────────────────────────────────
	// Every before* is cancellable + delayable. A prevented action fires its
	// paired *Prevented event instead of the post-action event.

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

	// ── Phase-aware mutation contract ─────────────────────────────────────────
	// Fires before any state-mutating method. Hot methods opt-in via
	// `setup({ mutationGuards: [...] })`; normal mutations fire by default.
	// `setup({ mutationGuards: false })` disables entirely.
	//
	// `phase` carries the coarse playback state. `dispatchStack` is the chain
	// of currently-dispatching events (innermost last) — empty if the mutation
	// was called from app code, populated if called from inside an event handler.

	'beforeMutation': BeforeEvent<{
		method: string;
		args: ReadonlyArray<unknown>;
		phase: PlayerPhase;
		dispatchStack: ReadonlyArray<string>;
	}>;
	'mutationPrevented': { method: string; reason: PreventedReason; cause?: unknown };

	// ── Phase transitions ─────────────────────────────────────────────────────
	// Fires every time the player moves between phases. Plugins building UI
	// overlays or debug tooling watch this to track coarse playback state.

	'phase': { from: PlayerPhase; to: PlayerPhase };

	// ── Standard transport ────────────────────────────────────────────────────

	'play': ActionOptions;
	'pause': ActionOptions;
	'stop': ActionOptions;
	'next': ActionOptions;
	'previous': ActionOptions;
	'ended': void;
	'seek': { time: number; source?: ActionSource };

	/**
	 * Fires after a seek settles — once the backend has repositioned and
	 * confirmed the new position. `seek` fires at dispatch time (before the
	 * backend moves); `seeked` fires after.
	 */
	'seeked': { time: number };

	/**
	 * Throttled time update — fires at most every `progressIntervalMs`
	 * (default 5000 ms). Use this instead of `time` for server-side
	 * watch-position saves and analytics to avoid per-frame callback noise.
	 */
	'progress': { time: number; duration: number; percentage: number };

	'time': { time: number };
	'dispose': void;

	// ── Volume + mode state ───────────────────────────────────────────────────
	// Library event maps (MusicEventMap, VideoEventMap) narrow the `state`
	// typing on `repeat` / `shuffle` with their concrete enum values.

	'volume': { level: number };
	'mute': { muted: boolean };
	'repeat': { state: 'off' | 'all' | 'one' };
	'shuffle': { state: 'off' | 'on' };

	// ── Error severity tiers ──────────────────────────────────────────────────
	// `fatal` = unrecoverable, player is shutting down.
	// `error` = recoverable problem (e.g. a sidecar failed to load).
	// `warning` / `info` = observability only.

	'fatal': PlayerErrorEvent;
	'error': PlayerErrorEvent;
	'warning': PlayerErrorEvent;
	'info': PlayerErrorEvent;

	// ── Cursor / item change ──────────────────────────────────────────────────
	// Fires every time the active item pointer moves (load, next, previous,
	// setCurrent). `item` is `undefined` when the queue is empty after a clear.

	'current': { item: BasePlaylistItem | undefined; index: number };

	// ── Queue mutation events ─────────────────────────────────────────────────
	// Re-emitted from the internal MediaList<T> instance whenever the queue
	// structure changes. Subscribe to these for reactive queue UI.

	'queue': BasePlaylistItem[];
	'queue:append': { items: BasePlaylistItem[]; from: number };
	'queue:prepend': { items: BasePlaylistItem[] };
	'queue:insert': { items: BasePlaylistItem[]; index: number };
	'queue:remove': { id: string | number; index: number; item: BasePlaylistItem };
	'queue:move': { from: number; to: number };
	'queue:clear': { previousLength: number };
	'queue:shuffle': void;
	'queue:sort': void;

	/**
	 * Fires when the last item in a non-repeating queue ends naturally.
	 * Fires regardless of whether an auto-advance plugin is registered —
	 * consumers receive the "playlist done" signal unconditionally.
	 */
	'queue:exhausted': void;

	// ── Backlog / history ─────────────────────────────────────────────────────
	// Items already played are tracked in a separate MediaList<T>. `next()`
	// pushes the current item onto the backlog before advancing; `previous()`
	// pops the backlog top back to current.

	'backlog': BasePlaylistItem[];
	'backlog:append': { items: BasePlaylistItem[] };
	'backlog:remove': { id: string | number; index: number; item: BasePlaylistItem };
	'backlog:clear': { previousLength: number };

	// ── Duration ──────────────────────────────────────────────────────────────
	// Re-emitted when the backend resolves the total duration of the active
	// item. Useful for UIs that need an up-front "duration ready" signal
	// without polling `timeData()`.

	'duration': { duration: number };

	// ── Backend lifecycle ─────────────────────────────────────────────────────

	'backend:changed': { kind: string };
	'backend:loading': { url: string; kind: string };
	'backend:loaded': { url: string; kind: string; duration: number };
	'backend:error': { error: PlayerErrorEvent['error']; kind: string };
	'backend:stalled': { time: number };
	'backend:ratechange': { rate: number };
	'backend:waiting': void;

	// ── Auth runtime ──────────────────────────────────────────────────────────

	'auth:refreshed': { tokenAcquiredAt: number };
	'auth:expired': { lastValidAt: number };
	'auth:failed': { error: PlayerErrorEvent['error'] };

	// ── Stream-level ──────────────────────────────────────────────────────────
	// Re-exposed from the active StreamSource so consumers don't need to reach
	// into the backend to observe manifest / fragment / encryption events.

	'stream:manifest-loaded': { url: string };
	'stream:level-switched': { level: number; label: string };
	'stream:fragment-loaded': { url: string; durationMs: number };
	'stream:level-considered': { candidate: number; decided: number; reason: string };
	'stream:error': { details: string; fatal: boolean };
	'stream:encrypted': { initData: ArrayBuffer; initDataType: string };

	// ── Cue tracker ───────────────────────────────────────────────────────────

	'cue:enter': CueEventPayload;
	'cue:exit': CueEventPayload;

	// ── Subtitle cue stream ───────────────────────────────────────────────────
	// Unified across sidecar VTT (kit-driven) and native HLS / MSE / WebCodecs
	// text tracks (backend-driven). Fires on every cuechange / enter+exit
	// boundary; `cues: []` means between cues or subtitles disabled.

	'subtitleCue': SubtitleCueChange;

	// ── Subtitle styling ──────────────────────────────────────────────────────
	// Written by `player.subtitleStyle({...})`, read by overlay renderers and
	// settings menus. The merged record is emitted so subscribers don't need
	// to re-fetch via the getter.

	'subtitleStyle': SubtitleStyle;
	'subtitle': { track: number | null };

	// ── Audio track selection ─────────────────────────────────────────────────
	// Emitted by `currentAudioTrack(idx)`. `id` follows the kit's
	// `audioTracks()` index space so consumers don't need to re-resolve.

	'audioTrack': { id: number | null };

	// ── Chapter events ────────────────────────────────────────────────────────
	// `chapter` — emitted by `seekToChapter`. `index` is zero-based; `title`
	//   is the chapter's display name.
	// `chapters` — emitted after the chapter list is resolved from a sidecar
	//   VTT for the active item. Subscribe here instead of polling `chapters()`.

	'chapter': { index: number; title: string };
	'chapters': { chapters: ReadonlyArray<Chapter> };

	// ── Cast / handoff state ──────────────────────────────────────────────────
	// Emitted by `transferTo()` on every state transition. Mirrors the return
	// value of `castState()` for reactive subscriptions.

	'castState': { state: CastState };

	// ── Shared state-enum change events ───────────────────────────────────────
	// Emitted by both music and video players. Typed as string unions so
	// library-local enum values (which have identical string forms) are
	// assignable without importing library types into the kit.

	'qualityState': { state: 'auto' | 'manual' };
	'audioTrackState': { state: 'default' | 'manual' };

	// ── HLS adaptive level switch ─────────────────────────────────────────────
	// Emitted by stream parsers and forwarded by the video backend. `level` is
	// the variant index in the manifest's level list; use `qualityLevels()` to
	// look up the metadata for that index.

	'level-switched': { level: number };

	// ── Plugin lifecycle channel ──────────────────────────────────────────────

	'plugin:installed': { id: string; version: string };
	'plugin:enabled': { id: string };
	'plugin:disabled': { id: string; reason?: string };
	'plugin:opts:changed': { id: string; opts: unknown };
	'plugin:disposed': { id: string };
	'plugin:failed': { id: string; error: PlayerErrorEvent['error'] };
	'plugin:error': PlayerErrorEvent;
	'plugin:warning': PlayerErrorEvent;

	// ── Network / visibility / connectivity ───────────────────────────────────

	'network:online': void;
	'network:offline': void;
	'network:slow': { rttMs: number };
	'visibility:visible': void;
	'visibility:hidden': void;

	// ── Performance metrics ───────────────────────────────────────────────────

	'playback:metrics': PlaybackMetrics;

	// ── Embed context ─────────────────────────────────────────────────────────
	// Emitted when the EmbedPlugin is registered and the player is hosted
	// inside an iframe that communicates via postMessage.

	'embed:host-attached': { origin: string };
	'embed:host-detached': void;
	'embed:host-message': { data: unknown };

	/** Fetch lifecycle — observability for loading UI / telemetry. */
	'fetch:start': { url: string; pluginId?: string };
	'fetch:retry': { url: string; attempt: number; reason: 'unauthenticated' | 'http-5xx' | 'timeout' | 'network'; delayMs: number; pluginId?: string };
	'fetch:complete': { url: string; ok: boolean; status?: number; durationMs: number; pluginId?: string };

	/**
	 * User activity state change. `active: true` when the user moves the
	 * pointer, touches the screen, or presses a key; `active: false` after the
	 * inactivity timeout. Used by the desktop-UI plugin to show / hide controls.
	 */
	'activity': { active: boolean };

	/**
	 * Fires whenever the listener count for a named event changes. Useful for
	 * devtools that want to track which events are being observed.
	 */
	'listeners-changed': { name: string; count: number };

	// ── Preload lifecycle ─────────────────────────────────────────────────────
	// Emitted by the generic preload orchestration in `preloadMethods`.

	/** The player began prefetching assets for the next item. */
	'preloadStart': { item: BasePlaylistItem; assets: ReadonlyArray<{ url: string; category: string }> };

	/** An individual preload asset completed or failed — progress update. */
	'preloadProgress': { item: BasePlaylistItem; loaded: number; total: number };

	/** All queued preload assets have been fetched successfully. */
	'preloadComplete': { item: BasePlaylistItem };

	/** One or more preload assets could not be fetched (non-fatal). */
	'preloadError': { item: BasePlaylistItem; error: unknown };

	// ── Transition lifecycle ──────────────────────────────────────────────────

	/** The transition window has begun (outgoing fading, incoming starting). */
	'transitionStart': { outgoing: BasePlaylistItem; incoming: BasePlaylistItem };

	/**
	 * Per-frame progress during the transition window.
	 * `fraction` is [0..1] — 0 at transition start, 1 at completion.
	 */
	'transitionProgress': { outgoing: BasePlaylistItem; incoming: BasePlaylistItem; fraction: number };

	/** The transition completed — incoming is now primary. */
	'transitionComplete': { from: BasePlaylistItem; to: BasePlaylistItem };

	/** The transition was aborted before it could complete. */
	'transitionCancelled': { reason: string };
}

/**
 * An `Authorization` header value — accepted as a static string, a sync
 * getter, or an async getter so Vue refs, signals, and reactive stores all
 * plug in naturally: `bearerToken: () => myStore.token`.
 */
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
 * Unified auth pipeline applied to every kit-internal fetch — playlist URLs
 * at setup, lyrics, subtitles, sprite previews, and all `Plugin.fetch` calls.
 *
 * Hard rules baked in:
 *  - **401 (unauthenticated) → may invoke `refreshOnUnauthenticated`, retry once.**
 *  - **403 (unauthorized / forbidden) → propagates immediately. Never refreshed, never retried.**
 *  - The lint pack flags any code that handles 401 and 403 in the same branch.
 */
export interface AuthConfig {
	/**
	 * Convenience for the most common case — value goes into `Authorization: Bearer {value}`.
	 * Accepts a static string, a sync getter, or an async getter so Vue refs, signals, and
	 * reactive stores all work: `auth: { bearerToken: () => myRef.value }`.
	 */
	bearerToken?: AuthHeaderValue;

	/**
	 * Alias for `bearerToken`. Lets consumers use the field name they already know
	 * from the top-level deprecated `accessToken` config: `auth: { accessToken: () => store.token }`.
	 * When both are set, `bearerToken` wins.
	 *
	 * @deprecated Prefer `bearerToken`. This alias exists to ease migration from the
	 * top-level `BasePlayerConfig.accessToken` field.
	 */
	accessToken?: AuthHeaderValue;

	/** Arbitrary headers — static, sync getter, or async getter. */
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

/**
 * DRM configuration shorthand. When present on `BasePlayerConfig.drm`, the
 * kit auto-installs the DRM plugin and uses these values without requiring an
 * explicit `use(DrmPlugin, config)` call.
 */
export interface DrmConfig {
	/** EME key system string (e.g. `'com.widevine.alpha'`, `'com.apple.fps'`). */
	keySystem: string;
	/** License server URL. The kit's fetch pipeline (including auth headers) is used. */
	licenseUrl: string;
	/** Optional server certificate for FairPlay and some Widevine deployments. */
	certificate?: ArrayBuffer | string;
	/** Optional per-request signing override — same contract as `AuthConfig.signRequest`. */
	customSignRequest?: (request: Request) => Request | Promise<Request>;
}

/**
 * Translation bundle map. Outer key is a BCP-47 language tag; inner map is
 * key → translated string. Example: `{ en: { 'core.network.timeout': 'Connection timed out' }, nl: { ... } }`.
 */
export type Translations = Record<string, Record<string, string>>;

/**
 * A log sink function that receives every log entry the player produces.
 * Supply via a custom `ILogger` implementation or directly to a logging
 * bridge (Sentry breadcrumbs, Datadog, etc.).
 */
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

/**
 * Cast / Chromecast configuration for `transferTo('cast')`. All fields
 * optional — leave unset to use the Cast Web Sender SDK's own defaults
 * with the standard Google media receiver.
 */
export interface CastConfig {
	/**
	 * Auto-inject the Cast Web Sender SDK on first `transferTo('cast')`.
	 * When `false` (the default), `transferTo('cast')` throws
	 * `core:policy/castUnavailable` if the SDK script tag isn't already on
	 * the page — the consumer must include the script manually.
	 *
	 * Set `true` for the on-demand path: the SDK only loads when the user
	 * actually clicks Cast, no third-party network hit before then.
	 */
	autoLoad?: boolean;

	/**
	 * Cast receiver application ID. Defaults to the standard Google media
	 * receiver. Set this to your custom receiver's app ID (registered in the
	 * Google Cast Developer Console) to cast to a custom receiver app.
	 */
	receiverApplicationId?: string;

	/**
	 * Auto-join policy for existing Cast sessions on page load.
	 *  - `'origin-scoped'` (default) — rejoin sessions started anywhere on the same origin.
	 *  - `'tab-and-origin-scoped'` — rejoin only sessions started in the same tab.
	 *  - `'page-scoped'` — never auto-rejoin; user must reconnect explicitly.
	 */
	autoJoinPolicy?: 'origin-scoped' | 'tab-and-origin-scoped' | 'page-scoped';

	/** Resume the most recent saved session when the SDK initialises. Default `true`. */
	resumeSavedSession?: boolean;

	/**
	 * Override the SDK script URL. Useful for self-hosted mirrors or testing.
	 * Default: `https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1`.
	 */
	scriptUrl?: string;

	/**
	 * Timeout for SDK script load when `autoLoad: true`. Default `10000` ms.
	 * Past this, throws `core:policy/castLoadTimeout` so the UI can fall back
	 * to a non-Cast playback target.
	 */
	loadTimeoutMs?: number;
}

/**
 * Configuration accepted by both music and video players at `setup()`. Each
 * library extends this interface with its own domain-specific fields
 * (e.g. `NMMusicPlayerConfig` adds `crossfadeEnabled`; `NMVideoPlayerConfig`
 * adds `octopus`).
 */
export interface BasePlayerConfig {
	/** @deprecated — use `logLevel`. Maps to `'debug'` when true. */
	debug?: boolean;

	/** Logger verbosity. Controls output from the player and all registered plugins. */
	logLevel?: LogLevel;

	/** Consumer-supplied logger. Any `ILogger` impl (kit's `Logger`, Pino, Winston, custom). */
	logger?: ILogger;

	/**
	 * Base URL prepended to relative media URLs in playlist items. Absolute
	 * URLs are passed through unchanged.
	 */
	baseUrl?: string;

	/** Initial volume (0..1). Default `1`. */
	defaultVolume?: number;

	/** @deprecated — use `auth.bearerToken`. Kept for migration compatibility. */
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

	/** DRM sugar — auto-installs the `drm` plugin with these settings. */
	drm?: DrmConfig;

	/** How often the player emits `playback:metrics` (ms). `0` disables. Default 10000. */
	metricsIntervalMs?: number;

	/**
	 * How often the player emits `progress` (throttled time updates for
	 * server-side watch-position persistence, ms). `0` disables. Default 5000.
	 * Consumers use `progress` instead of `time` to avoid per-frame callback noise.
	 */
	progressIntervalMs?: number;

	/** Pause when document goes hidden. Default `false`. */
	pauseWhenHidden?: boolean;

	/** Behavior on `network:offline`. Default `'continue-buffered'`. */
	onOffline?: 'pause' | 'continue-buffered' | 'ignore';

	/** Wake-lock policy. Video defaults `'auto'`; music defaults `'never'`. */
	wakeLock?: 'auto' | 'always' | 'never';

	/**
	 * Cast / Chromecast configuration. Set `cast: { autoLoad: true }` for the
	 * SDK to inject itself on first `transferTo('cast')`; set
	 * `receiverApplicationId` to point at a custom receiver app. See
	 * `CastConfig` for the full surface.
	 */
	cast?: CastConfig;

	/** Clock source for timestamps used in distributed-sync plugins. Defaults to `Date.now`. */
	clockSource?: () => number;

	/** Cap on plugin `use()` Promise resolution before marking the plugin failed (ms). Default 30000. */
	pluginInitTimeoutMs?: number;

	/**
	 * Cap on `BeforeEvent.delay(promise)` waits before timing out the action (ms).
	 * Timeout is treated as `preventDefault` — fires `<action>Prevented` with
	 * `reason: 'delay-timeout'`. Default 10000.
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

	/**
	 * Base URL prepended to relative image / poster paths in playlist items
	 * (`image`, `poster`, `thumbnail`, `cover`). Absolute URLs are passed
	 * through unchanged. For TMDB: `'https://image.tmdb.org/t/p/w780'`.
	 *
	 * Consumers needing per-category signing use `urlResolver` with
	 * `category: 'poster'` instead.
	 */
	imageBasePath?: string;

	/** Initial playlist. Pass items directly, or a URL the player will fetch. */
	playlist?: BasePlaylistItem[] | string;

	// ── Preload + transition ──────────────────────────────────────────────────

	/**
	 * How many seconds before the outgoing item ends the player begins prefetching
	 * the next item's assets (manifest, first segments, poster, sidecars).
	 * Default `10`. Set to `0` to disable preloading.
	 */
	preloadLeadSeconds?: number;

	/**
	 * How many seconds before the outgoing item ends the player begins the
	 * crossfade / transition window. Only used when `crossfadeEnabled: true`.
	 * Default `3`.
	 */
	crossfadeLeadSeconds?: number;

	/**
	 * How many seconds the incoming item plays in parallel with (on top of) the
	 * outgoing item before the outgoing is fully silent. Only used when
	 * `crossfadeEnabled: true`. Default `3`.
	 */
	crossfadeTailSeconds?: number;

	/**
	 * Enable the crossfade / overlap transition between queue items.
	 * When `false` (the default for video) the player uses a hard-cut gapless
	 * transition — assets are still preloaded, but there is no audio overlap.
	 * Per-library defaults:
	 *  - Music: `true`
	 *  - Video: `false`
	 */
	crossfadeEnabled?: boolean;

	/**
	 * Custom preload strategy. When supplied, replaces the default
	 * `DefaultPreloadStrategy`. Inject this to customise which assets are
	 * prefetched, or to implement a different timing heuristic.
	 *
	 * The strategy is stateless — a single instance is reused across items.
	 * Call `strategy.cancel()` before navigating away if you hold a reference.
	 */
	preloadStrategy?: import('./preload-strategy').PreloadStrategy;

	/**
	 * Custom transition strategy. When supplied, replaces the per-library default
	 * (`CrossfadeTransitionStrategy` for music, `GaplessTransitionStrategy` for
	 * video). Inject this to implement custom fades, cuts, or creative transitions.
	 */
	transitionStrategy?: import('./preload-strategy').TransitionStrategy;

	/**
	 * Attach the player instance to `window.player` for console debugging.
	 * Cleaned up on `dispose()`. Default `false`.
	 *
	 * The library factory (`nmplayer` / `nmMPlayer`) additionally attaches
	 * itself to `window.nmplayer` / `window.nmMPlayer` when this is `true`.
	 */
	expose?: boolean;
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
	= | 'idle'       // before setup() runs — initial state
		| 'setup'      // setup() in flight (config resolving, plugins registering, auth/streams/playlist mounting)
		| 'ready'      // setup done OR loaded but not playing — awaiting commands
		| 'loading'    // load(item) in flight — backend pulling source
		| 'starting'   // play() called, backend kicking up — pre-firstFrame
		| 'playing'    // backend producing output
		| 'paused'     // user-paused or auto-paused
		| 'buffering'  // buffer ran dry mid-playback (data underrun)
		| 'seeking'    // seek in progress (transient)
		| 'ended'      // natural end of current item
		| 'stopped'    // explicit stop()
		| 'disposing'  // dispose() called, teardown in flight
		| 'disposed';  // dispose complete

/**
 * Cancellable, mutable, async-aware event payload for every `before*` event.
 *
 *  - `data` is mutable. Listeners modify it; the player reads back the mutated
 *    value when running the default action and when emitting the post-action
 *    event (`play`, `seek`, etc.).
 *  - `preventDefault()` skips the default action AND its post-event chain.
 *    Consumers see a `<action>Prevented` event instead.
 *  - `stopImmediatePropagation()` skips remaining listeners on this event.
 *    Does NOT prevent default — combine with `preventDefault()` if needed.
 *  - `delay(promise)` blocks the player on the given promise. Multiple delays
 *    compose via `Promise.all`. One rejection = `preventDefault`. Bounded by
 *    `setup({ beforeEventTimeoutMs })` (default 10000 ms).
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
		| 'delay-rejected'     // a delay() promise rejected
		| 'delay-timeout';     // a delay() promise exceeded beforeEventTimeoutMs

/**
 * A plugin constructor carrying the static fields the kit reads at
 * registration time. Pass a class (not an instance) to `player.use()`,
 * `player.getPlugin()`, and `RequireSpec`.
 *
 * The constructor signature is `new (...args: never[]) => unknown` rather than
 * `new () => unknown` so that plugins with required constructor arguments (rare
 * but permitted) satisfy the constraint without widening the instance type.
 */
export type PluginCtorWithId = (new (...args: never[]) => unknown) & {
	readonly id: string;
	readonly version?: string;
	readonly description?: string;
	readonly minCoreVersion?: string;
	readonly requires?: ReadonlyArray<RequireSpec>;
	readonly replaces?: string;
	readonly priority?: number;
	readonly onError?: Readonly<Record<string, string>>;
	readonly advisories?: ReadonlyArray<PluginAdvisory>;
	readonly translations?: Translations;
};

/**
 * Plugin dependency declaration used in `static requires`. Class refs are the
 * canonical form — type-safe, refactor-safe, and consistent with the typed
 * `getPlugin(PluginClass)` API.
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
export type RequireSpec
	= | PluginCtorWithId
		| { plugin: PluginCtorWithId; optional?: boolean; minVersion?: string };

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
 * Tier-4 override namespace — last-resort surface for behaviour overrides not
 * covered by `before*` events, `static replaces`, or subclass hooks.
 *
 * The lint rule `nmplayer/no-experimental` flags any call from inside plugin
 * code. Authors must add `eslint-disable-next-line nmplayer/no-experimental`
 * with a written reason. Consumer (app) code is free to use it without lint
 * friction.
 *
 * Auto-restore: every override registers its caller (a plugin id, or
 * `'consumer'` if called from app code); when that plugin disposes, the
 * original method is restored automatically. Manual restore via the returned
 * unbinder or `experimental.restore`.
 *
 * Discoverable via `experimental.overrides()` so devtools / debug UIs can
 * surface which methods have been monkey-patched and by whom.
 */
export interface PlayerExperimental {
	override<K extends string>(method: K, fn: (...args: unknown[]) => unknown): () => void;
	restore(method: string): void;
	overrides(): Array<{ method: string; by: string | 'consumer' }>;
}

/**
 * The argument accepted by the `nmplayer()` / `nmMPlayer()` factory function.
 * Three forms are supported:
 *
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
 * Minimum surface a "player" object exposes that the kit relies on internally.
 * Both `NMMusicPlayer` and `NMVideoPlayer` satisfy this interface.
 *
 * Cross-library-shared accessors (`baseUrl`, `audioContext`) live here so
 * plugins typed against `IPlayer` work uniformly against either player without
 * each library redeclaring them.
 *
 * The generic `E` parameter allows library-specific event maps to extend
 * `BaseEventMap` while still satisfying this constraint; most consumers can
 * leave it at its default.
 */
export interface IPlayer<E extends BaseEventMap = BaseEventMap> {
	/** Stable identifier set at construction. Reads back the id passed to the factory. */
	readonly playerId: string;

	/**
	 * Alias for `playerId`. Provided so consumers can write `player.id` as a
	 * natural shorthand — both properties always return the same value.
	 */
	readonly id: string;

	/** The root `<div>` element the player was mounted into. */
	readonly container: HTMLElement;

	/** Subscribe to an event by name. The handler receives the typed payload. */
	on<K extends keyof E>(event: K, fn: (data: E[K]) => void): void;
	/** Unsubscribe a previously-registered handler. */
	off<K extends keyof E>(event: K, fn: (data: E[K]) => void): void;
	/** Subscribe for a single firing then automatically unsubscribe. */
	once<K extends keyof E>(event: K, fn: (data: E[K]) => void): void;
	/** Emit an event, invoking all registered handlers synchronously. */
	emit<K extends keyof E>(event: K, data?: E[K]): void;
	/** `true` when at least one handler is registered for `event`. */
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
	 * `category` lets custom resolvers route per consumer (`'media'`,
	 * `'subtitle'`, `'cast'`, `'license'`, ...). Defaults to `'media'`.
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
	 * Current coarse playback phase (`idle` / `setup` / `ready` / `playing` /
	 * `paused` / `stopped` / `ended` / `disposed`). Fires the `phase` event on
	 * every transition.
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

	/** Resolve the registered parser for the given URL, or `undefined` if none match. */
	resolveCueParser(url: string): CueParser | undefined;

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
	 * The chapter list for the active item. Returns `[]` when no item is
	 * active or the item carries no chapter data. The list is populated
	 * asynchronously from a sidecar VTT when the item is loaded or selected;
	 * subscribe to the `'chapters'` event for the "list is now ready" signal.
	 */
	chapters(): ReadonlyArray<Chapter>;

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
	 * Seek to a position expressed as a percentage of the total duration.
	 *
	 * `pct` is clamped to [0, 100]. No-op when duration is not yet known
	 * (zero or non-finite). Delegates to `currentTime(duration * pct / 100)`.
	 */
	seekByPercentage(pct: number, opts?: ActionOptions): void;

	/**
	 * Buffer state derived from the active backend (`'idle'` → `'loading'` →
	 * `'seeking'` → `'stalled'`). `BufferState.IDLE` when no backend is active.
	 */
	bufferState(): BufferState;

	/**
	 * Network connectivity state. `NetworkState.ONLINE` when no network monitor
	 * is configured. `NetworkState.SLOW` when downlink < 1.5 Mbps.
	 */
	networkState(): NetworkState;

	/**
	 * Active stream factory id (e.g. `'hls'`, `'native'`), or `'idle'` when
	 * no backend has been initialised yet.
	 */
	streamState(): string;

	/**
	 * Tab / page visibility. `VisibilityState.VISIBLE` when no visibility
	 * monitor is configured.
	 */
	visibilityState(): VisibilityState;

	/**
	 * Quality selection mode.
	 *
	 * `qualityState()` — `QualityState.AUTO` (ABR) or `QualityState.MANUAL`.
	 * `qualityState(target)` — switch mode and delegate to the backend.
	 */
	qualityState(): QualityState;
	qualityState(target: number | 'auto'): void;

	/**
	 * Audio track selection mode.
	 *
	 * `audioTrackState()` — `AudioTrackState.DEFAULT` or `AudioTrackState.MANUAL`.
	 * `audioTrackState(idx)` — select track by index and mark as MANUAL.
	 */
	audioTrackState(): AudioTrackState;
	audioTrackState(idx: number): void;

	/**
	 * DOM construction helpers — fluent builders re-exposed on the player so
	 * UI plugins can chain `player.createElement('div', 'id').addClasses([...]).appendTo(parent)`.
	 * No extra state or behaviour beyond delegating to the standalone helpers in `dom.ts`.
	 */
	createElement<K extends keyof HTMLElementTagNameMap>(type: K, id: string, unique?: boolean): CreateElement<HTMLElementTagNameMap[K]>;
	createButton(id: string, label: string, onClick: (e: Event) => void): HTMLButtonElement;
	createSVG(id: string, viewBox: string): SVGSVGElement;
	addClasses<T extends Element>(el: T, names: string[]): AddClasses<T>;
	removeClasses<T extends Element>(el: T, names: string[]): T;

	/**
	 * Retrieve a registered plugin instance by constructor. Returns `undefined`
	 * when the plugin is not registered. Generic `P` is inferred from the
	 * constructor argument — no explicit type parameter needed at the call site.
	 */
	getPlugin<P extends object>(PluginClass: PluginCtorWithId & (new () => P)): P | undefined;

	/**
	 * Retrieve a registered plugin instance by its static `id` string.
	 * Use `getPlugin(PluginClass)` instead when you have the class reference —
	 * the constructor form is type-safe and refactor-proof.
	 */
	getPluginById<P extends object = object>(id: string): P | undefined;
}
