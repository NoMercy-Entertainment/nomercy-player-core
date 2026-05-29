import type { PlayerErrorEvent } from '../errors';

import type { Chapter } from './chapter';
import type { BasePlayerConfig } from './config';
import type { CueEventPayload, SubtitleCueChange } from './cues';
import type { PlaybackMetrics } from './metrics';
import type {
	ActionOptions,
	ActionSource,
	PlayerPhase,
	PreventedReason,
} from './player';
import type { BasePlaylistItem } from './playlist';
import type { CastState } from './state';
import type { SubtitleStyle } from './tracks';

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
	'playlistError': { url: string; error: Error; code: string };
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
	'firstFrame': void;

	/**
	 * Fires when the backend confirms media is actively rendering — equivalent
	 * to the HTML `playing` event (fires after buffering resolves, not just on
	 * `play()` call). Emitted by per-library backend wiring, not by kit transport.
	 */
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
	'auth:failed': { error: PlayerErrorEvent['error'] };

	// ── Stream-level ──────────────────────────────────────────────────────────
	// Re-exposed from the active IStreamSource so consumers don't need to reach
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

	/**
	 * Fires when a network transition reveals a slow connection: online but
	 * downlink < 1.5 Mbps. `rttMs` is `undefined` when the Network Information
	 * API is unavailable (Firefox, Safari). Only fires when the condition
	 * transitions from not-slow to slow — not on every heartbeat.
	 */
	'network:slow': { rttMs: number | undefined };
	'visibility:visible': void;
	'visibility:hidden': void;

	// ── Performance metrics ───────────────────────────────────────────────────

	'playback:metrics': PlaybackMetrics;

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
