// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { ICueParser } from '../adapters/cue-parser/ICueParser';
import type { AddClasses, CreateElement } from '../adapters/element-factory';
import type { IPlatform } from '../adapters/platform/browser';
import type { IStreamFactory } from '../adapters/stream/IStreamSource';
import type { DispatchTarget } from '../core/dispatch';
import type { RepeatStateToken, ShuffleStateToken } from '../core/mixins/state-mutators';

import type { Plugin } from '../core/plugin';
import type { PlayStateToken, VolumeStateToken } from '../core/state';
import type { Chapter } from './chapter';
import type { AuthConfig, CastTarget } from './config';
import type { DeviceCapabilities } from './device';
import type { BaseEventMap } from './events';
import type { PlayerExperimental } from './experimental';
import type { PlaybackMetrics } from './metrics';
import type { AriaLiveLevel, TimeState } from './playback';
import type { BasePlaylistItem } from './playlist';
import type { PluginCtorWithId } from './plugin';
import type {
	AudioTrackState,
	BufferState,
	CastState,
	NetworkState,
	QualityState,
	SetupState,
	VisibilityState,
} from './state';
import type {
	AudioTrack,
	CanPlayResult,
	CurrentAudioTrackSelection,
	CurrentQualitySelection,
	CurrentSubtitleSelection,
	QualityLevel,
	SubtitleTrack,
} from './tracks';
import type { Translations } from './translations';
import type { IUrlResolver, ResolvedUrl, UrlCategory } from './url';

/**
 * Minimal backend shape the kit and kit plugins depend on. Both `IAudioBackend`
 * (music) and `IVideoBackend` (video) satisfy this interface structurally — no
 * explicit `implements` needed. Kit code that needs the full per-library backend
 * contract should import from the per-library package; code that only needs
 * element access or the audio-graph output node uses this narrower type.
 *
 * All members are optional: backends that do not expose a particular capability
 * (e.g. a headless audio backend without a `<video>` element) simply omit the
 * field and callers probe with `?.`.
 */
export interface IPlayerBackend {
	/** The underlying `HTMLMediaElement` (`<audio>` or `<video>`), when available. */
	mediaElement?(): HTMLMediaElement | null | undefined;

	/**
	 * The tail `AudioNode` of the backend's internal gain chain
	 * (e.g. `AudioElementBackend`'s `outputGain`). When present, the
	 * `AudioGraphPlugin` reuses this node as its chain source instead of
	 * creating a second `MediaElementAudioSourceNode`.
	 */
	outputNode?(ctx: AudioContext): AudioNode;
}

/**
 * Capability interface for players that expose an `item()` cursor accessor.
 *
 * `IPlayer<E>` is intentionally item-type-agnostic so the kit compiles without
 * per-library knowledge. Plugins that need to read the active playlist item
 * constrain their player generic with this interface:
 *
 * ```ts
 * class MyPlugin<
 *   P extends IPlayer<BaseEventMap> & WithCurrentItem<MyItem>,
 *   I extends MyItem = MyItem,
 * > extends Plugin<P, BaseEventMap, MyItem> {
 *   onPlay(): void {
 *     const activeItem = this.player.item(); // typed as MyItem
 *   }
 * }
 * ```
 *
 * Both `NMMusicPlayer<T>` and `NMVideoPlayer<T>` satisfy `WithCurrentItem<T>`
 * structurally — no `implements` required. Plugins that do NOT need item access
 * should omit the constraint and type against plain `IPlayer<E>`.
 */
export interface WithCurrentItem<T extends BasePlaylistItem = BasePlaylistItem> {
	/** Returns the active playlist item, or `undefined` when no item is loaded. */
	item(): T | undefined;

	/**
	 * Moves the queue cursor to `target` (item reference, string id, numeric
	 * index, or a predicate) and begins loading the resolved item.  Fires
	 * `beforeMutation` so advisory plugins can cancel the navigation.  Emits
	 * the `current` event when the cursor moves.
	 */
	item(target: T | string | number | ((candidate: T) => boolean), opts?: LoadOptions): void;
}

export const ACTION_SOURCE = {
	USER: 'user',
	REMOTE: 'remote',
	PLUGIN: 'plugin',
} as const;

/**
 * Source attribution for actions. Every transport / queue mutation accepts a
 * `source` (default `'user'`) and emits the resulting event with `source`
 * stamped on it. Lets remote-sync plugins filter out their own remote-applied
 * actions to avoid re-broadcast loops.
 */
export type ActionSource = typeof ACTION_SOURCE[keyof typeof ACTION_SOURCE] | (string & {});

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
 * Reason a cancellable action was prevented. Carried on `<action>Prevented`
 * events so consumers know why the action didn't run.
 */
export type PreventedReason
	= | 'listener-prevented' // a listener called preventDefault
		| 'delay-rejected' // a delay() promise rejected
		| 'delay-timeout'; // a delay() promise exceeded beforeEventTimeoutMs

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
export interface IPlayer<E extends BaseEventMap<any> = BaseEventMap>
	extends DispatchTarget {

	/**
	 * Phantom type brand — never assigned or read at runtime.
	 *
	 * Required for TypeScript's `PlayerEventMap<P>` generic to infer the
	 * concrete event map `E` from a `Plugin<P>` parameter without walking the
	 * full `EventEmitter` inheritance chain (which stalls in conditional-type
	 * inference for complex class hierarchies). Removing this field from the
	 * interface causes `Plugin<IPlayer<E>>` inference to degrade to
	 * `BaseEventMap` across the board.
	 *
	 * Do not read, write, or index this field in application code.
	 * It will never appear at runtime — only in type positions.
	 *
	 * @internal
	 */
	readonly __eventMap__: E;

	/** Stable identifier set at construction. Reads back the id passed to the factory. */
	readonly playerId: string;

	/**
	 * Alias for `playerId`. Provided so consumers can write `player.id` as a
	 * natural shorthand — both properties always return the same value.
	 */
	readonly id: string;

	/** The root `<div>` element the player was mounted into. */
	readonly container: HTMLElement;

	/** Subscribe to a typed event by name. The handler receives the narrowed payload. */
	on<K extends keyof E>(event: K, fn: (data: E[K]) => void): void;
	/** Firehose: called for every emit with `(eventName, payload)`. */
	on(event: 'all', fn: (event: string, data: unknown) => void): void;
	/**
	 * Escape hatch for plugin-namespaced events (`plugin:<id>:<event>`) and other
	 * dynamic event names. The `any` parameter type is bivariant, so consumers may
	 * annotate the callback with the concrete plugin-event type without a cast.
	 * For all events declared in the event map, prefer the typed `K` overload.
	 */
	on(event: string, fn: (data: any) => void): void; // bivariant escape hatch for plugin events

	/** Unsubscribe a previously-registered typed handler. */
	off<K extends keyof E>(event: K, fn: (data: E[K]) => void): void;
	/** Remove a firehose listener. */
	off(event: 'all', fn?: (event: string, data: unknown) => void): void;
	/** Unsubscribe all handlers for a string-keyed event (plugin events). */
	off(event: string, fn?: (data: any) => void): void;

	/** Subscribe for a single typed firing then automatically unsubscribe. */
	once<K extends keyof E>(event: K, fn: (data: E[K]) => void): void;
	/** Subscribe once for a string-keyed event (plugin events). */
	once(event: string, fn: (data: any) => void): void;

	/** Emit a typed event, invoking all registered handlers synchronously. */
	emit<K extends keyof E>(event: K, data?: E[K]): void;
	/** Emit a string-keyed event (used internally by the plugin runtime). */
	emit(event: string, data?: unknown): void;

	/** `true` when at least one handler is registered for the typed event. */
	hasListeners<K extends keyof E>(event: K): boolean;
	/** `true` when at least one handler is registered for a string-keyed event. */
	hasListeners(event: string): boolean;

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
	urlResolver(): IUrlResolver | undefined;
	urlResolver(resolver: IUrlResolver | undefined): void;

	/** Tier-4 override namespace — see `PlayerExperimental` for full contract. */
	readonly experimental: PlayerExperimental;

	/**
	 * The active playback backend, when one exists. Optional because a player
	 * may be queried before `setup()` wires a backend, and headless/test players
	 * may have none. Plugins probe with `?.`. See {@link IPlayerBackend}.
	 */
	backend?(): IPlayerBackend | undefined;

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
	 * Active platform abstraction bundle. Default is `browserPlatform`. Native-shell
	 * consumers (Capacitor, Tauri, Electron) inject a custom bundle at `setup()`.
	 * Plugins call this to access `fullscreen`, `pip`, `wakeLock`, etc. without
	 * reaching into the browser globals directly.
	 */
	platform(): IPlatform;

	/**
	 * High-level setup status. Coarser than `phase()`: returns `NOT_SETUP`
	 * before `setup()` has been called, `SETTING_UP` while setup is in flight,
	 * `READY` once the player has fully initialised, and `DISPOSED` after
	 * `dispose()` completes.
	 */
	setupState(): SetupState;

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
	registerCueParser(parser: ICueParser, prepend?: boolean): void;

	/** Unregister a cue parser by id. */
	unregisterCueParser(id: string): void;

	/** Resolve the registered parser for the given URL, or `undefined` if none match. */
	resolveCueParser(url: string): ICueParser | undefined;

	/**
	 * Read or write the auth config.
	 *
	 * `auth()` — redacted frozen snapshot of the current config, or `undefined`.
	 * Token-bearing fields (`bearerToken`, `accessToken`) are stripped from the
	 * snapshot; they are only accessible through the internal fetch pipeline.
	 * `auth(config)` — replace wholesale; emits `auth:refreshed`.
	 * `auth(partial)` — shallow-merge; emits `auth:refreshed`.
	 * `auth(null)` — clear the auth config; emits `auth:refreshed`.
	 */
	auth(): Readonly<AuthConfig> | undefined;
	auth(config: AuthConfig): void;
	auth(partial: Partial<AuthConfig>): void;
	auth(clear: null): void;

	/**
	 * Read or write the active subtitle track.
	 *
	 * `subtitle()` — `{ index, track }` of the selected track, or `null` when off.
	 * `subtitle(idx)` — select track; pass `null` to disable. Fires `subtitle`.
	 */
	subtitle(): CurrentSubtitleSelection | null;
	subtitle(idx: number | null): void;

	/**
	 * Read or write the active audio track.
	 *
	 * `audioTrack()` — `{ index, track }` of the selected track, or `null` when unset.
	 * `audioTrack(idx)` — select track. Fires `audioTrack`.
	 */
	audioTrack(): CurrentAudioTrackSelection | null;
	audioTrack(idx: number): void;

	/**
	 * Read or write the active quality level.
	 *
	 * `quality()` — `{ index, track }` of selected quality, or `'auto'` for ABR.
	 * `quality(idx)` — lock to a level or pass `'auto'` to restore ABR.
	 */
	quality(): CurrentQualitySelection | 'auto';
	quality(idx: number | 'auto'): void;

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
	 * `chapter()` — the `Chapter` whose range contains the current position,
	 * or `null` when none is active.
	 *
	 * `chapter(idx)` — jump to that chapter (same as `seekToChapter(idx)`).
	 */
	chapter(): Chapter | null;
	chapter(idx: number): void;

	/**
	 * Read or write the active audio output device.
	 *
	 * `audioOutput()` — current `sinkId`, or `null` for system default.
	 * `audioOutput(deviceId)` — route audio to `deviceId` via `setSinkId`.
	 * Returns `Promise<void>`. Throws `BrowserPolicyError` when unsupported.
	 */
	audioOutput(): Promise<string | null>;
	audioOutput(deviceId: string): Promise<void>;

	/**
	 * Seek to a position expressed as a percentage of the total duration.
	 *
	 * `pct` is clamped to [0, 100]. No-op when duration is not yet known
	 * (zero or non-finite). Delegates to `time(duration * pct / 100)`.
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
	 * `qualityMode()` — `QualityState.AUTO` (ABR) or `QualityState.MANUAL`.
	 * `qualityMode(target)` — switch mode and delegate to the backend.
	 */
	qualityMode(): QualityState;
	qualityMode(target: number | 'auto'): void;

	/**
	 * Audio track selection mode.
	 *
	 * `audioTrackMode()` — `AudioTrackState.DEFAULT` or `AudioTrackState.MANUAL`.
	 * `audioTrackMode(idx)` — select track by index and mark as MANUAL.
	 */
	audioTrackMode(): AudioTrackState;
	audioTrackMode(idx: number): void;

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

	/**
	 * Snapshot of current playback metrics. Spreads the running counters tracked
	 * by the backend (`ttfb`, `avgBitrate`, `droppedFrames`, ...) and appends a
	 * live `sessionDurationMs` derived from when the current item started.
	 *
	 * The same shape is emitted periodically as the `'playback:metrics'` event.
	 * Use the event for continuous monitoring; call `metrics()` for a one-shot
	 * snapshot (e.g. on `ended` for session telemetry).
	 */
	metrics(): PlaybackMetrics;

	// ── Lifecycle ──

	/**
	 * Configure the player and start the async setup pipeline. Returns the
	 * player for chaining. Throws `core:lifecycle/already-setup` on re-entry.
	 */
	setup(config: Record<string, unknown>): this;

	/** Promise that resolves when the setup pipeline reaches `ready`. */
	ready(): Promise<void>;

	/**
	 * Tear down the player. Idempotent — a second call is a no-op. After this
	 * the instance is permanently dead.
	 */
	dispose(): void;

	// ── Transport ──

	/**
	 * Start or resume playback.
	 * `opts.source` defaults to `'user'`. `opts.silent` skips lifecycle events.
	 */
	play(opts?: ActionOptions): Promise<void>;

	/** Pause playback. */
	pause(opts?: ActionOptions): Promise<void>;

	/** Stop playback and release the source. */
	stop(opts?: ActionOptions): Promise<void>;

	/** Toggle between play and pause. */
	togglePlayback(opts?: ActionOptions): Promise<void>;

	/** Seek backward by `seconds` (default 5). */
	rewind(seconds?: number, opts?: ActionOptions): Promise<void>;

	/** Seek forward by `seconds` (default 5). */
	forward(seconds?: number, opts?: ActionOptions): Promise<void>;

	/** Seek to time 0 and play. */
	restart(opts?: ActionOptions): Promise<void>;

	/** Advance to the next item in the queue. `opts.startAt` begins the incoming item at an offset (seconds). */
	next(opts?: LoadOptions): Promise<void>;

	/** Go to the previous item in the queue. `opts.startAt` begins the incoming item at an offset (seconds). */
	previous(opts?: LoadOptions): Promise<void>;

	// ── Volume ──

	/** Read the current volume (0–100). Returns 0 when muted. */
	volume(): number;
	/** Set the volume (0–100). Unmutes if currently muted. */
	volume(level: number): void;

	/** Increase volume by `step` percentage points (default 5). */
	volumeUp(step?: number): void;

	/** Decrease volume by `step` percentage points (default 5). */
	volumeDown(step?: number): void;

	/** Silence output without discarding the stored level. */
	mute(): void;

	/** Restore output after a mute. */
	unmute(): void;

	/** Toggle between muted and unmuted. */
	toggleMute(): void;

	// ── Time ──

	/** Returns the current playback position in seconds. */
	time(): number;
	/** Seek to `seconds`. Returns a Promise that resolves once the seek cycle completes. */
	time(seconds: number, opts?: ActionOptions): Promise<void>;

	/** Total duration of the current item in seconds. `0` when metadata not loaded. */
	duration(): number;

	/** Snapshot of all time-related state (position, duration, buffered, remaining, percentage). */
	timeData(): TimeState;

	/** Supported playback-rate values for UI speed-selector controls. */
	playbackRates(): number[];

	/** Returns the current playback rate. */
	playbackRate(): number;
	/** Set the playback rate. `1.0` = normal speed. */
	playbackRate(rate: number): void;

	// ── Queue ──

	/** Returns the current playlist as a read-only array. */
	queue(): ReadonlyArray<BasePlaylistItem>;
	/** Replace the entire playlist with `items`. */
	queue(items: BasePlaylistItem[], opts?: ActionOptions): void;

	/** Append one item or an array of items to the end of the queue. */
	queueAppend(item: BasePlaylistItem | BasePlaylistItem[], opts?: ActionOptions): void;

	/**
	 * Sort the queue in-place using `compare`. Same contract as
	 * `Array.prototype.sort`. Emits `queue:sort`.
	 */
	queueSort(compare: (a: BasePlaylistItem, b: BasePlaylistItem) => number, opts?: ActionOptions): void;

	/** Returns the backlog as a read-only array. */
	backlog(): ReadonlyArray<BasePlaylistItem>;
	/** Replace the backlog with `items`. */
	backlog(items: BasePlaylistItem[]): void;

	/** Append one item or an array of items to the backlog. */
	backlogAppend(item: BasePlaylistItem | BasePlaylistItem[]): void;

	/**
	 * Fetch a remote playlist URL and replace the current queue with the
	 * parsed result.
	 */
	loadQueue(url: string, parser?: (raw: string) => BasePlaylistItem[]): Promise<void>;

	/**
	 * Navigate to a playlist item by 1-based ordinal position. Fires
	 * `beforeMutation` / `current`. Throws `RangeError` for non-positive integers.
	 */
	seekToIndex(position: number, opts?: ActionOptions): void;

	/**
	 * Move the cursor to `target` and play AFTER the item finishes loading.
	 *
	 * Race-free alternative to `item(target); play()`. Delegates to
	 * `item(target, { autoplay: true, ...opts })` so playback only begins once
	 * the backend has set `element.src` and the load promise resolves.
	 *
	 * `opts.source` threads through every emitted event for NoMercy Connect
	 * echo-prevention. `opts.startAt` seeks to an offset inside the load
	 * pipeline (no extra seek round-trip when the backend supports `startTime`).
	 */
	playItem(
		target: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean),
		opts?: LoadOptions,
	): void;

	/**
	 * Replace the queue with `items` and begin playing from `start`.
	 *
	 * When `start` is omitted the first item in `items` is played. `start`
	 * accepts the same target union as `item()`: item reference, string id,
	 * numeric index, or a predicate.
	 *
	 * Silently no-ops when `items` is empty. `opts.source` and `opts.startAt`
	 * thread through identically to `playItem()`.
	 */
	playNow(
		items: BasePlaylistItem[],
		start?: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean),
		opts?: LoadOptions,
	): void;

	// ── Repeat / shuffle ──

	/** Returns the current repeat mode token (`'off'` / `'one'` / `'all'`). */
	repeatState(): RepeatStateToken;
	/** Set the repeat mode and emit `repeat`. */
	repeatState(state: RepeatStateToken): void;

	/** Returns the current shuffle mode token (`'off'` / `'on'`). */
	shuffleState(): ShuffleStateToken;
	/** Set the shuffle mode and emit `shuffle`. Accepts a boolean shorthand. */
	shuffleState(state: ShuffleStateToken | boolean): void;

	// ── Load ──

	/**
	 * Load a single playlist item into the player. Dispatches `beforeLoad`;
	 * a listener may `preventDefault()` to cancel.
	 */
	load(item: BasePlaylistItem, opts?: LoadOptions): Promise<void>;

	// ── Media tracks ──

	/** Full subtitle track list (backend tracks first, sidecar VTT tracks appended). */
	subtitles(): ReadonlyArray<SubtitleTrack>;

	/** The active backend's quality levels. */
	qualityLevels(): ReadonlyArray<QualityLevel>;
	/** Pass `opts.includeUnsupported: true` to include all manifest-declared levels. */
	qualityLevels(opts: { includeUnsupported: true }): ReadonlyArray<QualityLevel>;

	/** The active backend's audio tracks. */
	audioTracks(): ReadonlyArray<AudioTrack>;

	// ── Audio output ──

	/**
	 * Enumerate audio output devices via `navigator.mediaDevices.enumerateDevices()`.
	 */
	audioOutputs(): Promise<MediaDeviceInfo[]>;

	/**
	 * Open the browser audio-output picker (Chrome ≥105). Returns the selected
	 * device or `null` when the user cancels. Throws `BrowserPolicyError` on
	 * unsupported browsers.
	 */
	selectAudioOutput(): Promise<MediaDeviceInfo | null>;

	// ── Cast / handoff ──

	/**
	 * Coarse handoff state. Returns `'unavailable'` when no remote-playback
	 * APIs are present.
	 */
	castState(): CastState;

	/**
	 * Hand playback off to a remote target (`'cast'` / `'airplay'` /
	 * `'remote-playback'` / `'local'`).
	 */
	transferTo(target: CastTarget): Promise<void>;

	// ── Plugins ──

	/**
	 * Register a plugin with the player. Pre-setup calls are queued; post-setup
	 * runs inline. Returns the player for chaining.
	 */
	addPlugin<P extends Plugin<any, any, any>>(PluginClass: PluginCtorWithId & (new () => P), opts?: P['opts']): this;

	// ── Stream registration ──

	/**
	 * Register a custom stream factory. Most-recently-registered wins resolution.
	 * Returns the player for chaining.
	 */
	registerStream(factory: IStreamFactory, prepend?: boolean): this;

	// ── Device / ABR ──

	/** Full device-capabilities snapshot (UA classification + platform API probes). */
	device(): DeviceCapabilities;

	/** Last-known throughput estimate in bits per second. Returns 0 until a stream loads. */
	bandwidth(): number;

	/** Returns the current bandwidth estimator function, or `undefined`. */
	bandwidthEstimator(): (() => number) | undefined;
	/** Override the bandwidth estimator used by ABR. */
	bandwidthEstimator(fn: () => number): void;

	/**
	 * Probe whether a media profile can be decoded smoothly. Delegates to
	 * `platform.capabilities.canDecode`.
	 */
	canPlay(profile: { contentType: string; width?: number; height?: number; bitrate?: number; framerate?: number }): Promise<CanPlayResult>;

	// ── Accessibility ──

	/**
	 * Post a message to the player's ARIA live region. `level` defaults to
	 * `'polite'`. Noop when no live region is mounted.
	 */
	announce(text: string, level?: AriaLiveLevel): void;

	// ── Metrics ──

	/**
	 * Write a single named counter into the live metrics store. Backends call
	 * this to update their instrumented values; plugins may also use it for
	 * custom counters that appear in `metrics()` snapshots.
	 */
	recordMetric(name: string, value: number): void;

	/**
	 * Distributed-clock timestamp source. Returns `options.clockSource()` when
	 * configured, else `Date.now()`. Use this in plugins that coordinate
	 * timestamps across machines (group-listening, realtime sync) so the clock
	 * is injectable in tests.
	 */
	now(): number;

	// ── Buffered / seekable ranges ──

	/**
	 * How many seconds of media are buffered ahead of the current position.
	 * Returns 0 when no backend is registered.
	 */
	buffered(): number;

	/**
	 * Full buffered `TimeRanges` from the backend, mirroring
	 * `HTMLMediaElement.buffered`. Returns an empty range set when no backend
	 * is registered or the backend does not expose `bufferedRanges`.
	 */
	bufferedRanges(): TimeRanges;

	/**
	 * Seekable `TimeRanges` for the current source, mirroring
	 * `HTMLMediaElement.seekable`. Returns an empty range set when no backend
	 * is mounted or the backend does not implement `seekable()`.
	 */
	seekable(): TimeRanges;

	// ── Coarse state tokens ──

	/**
	 * Coarse play-state token (`'idle'` / `'loading'` / `'playing'` /
	 * `'paused'` / `'stopped'` / `'error'`). Read-only snapshot — subscribe
	 * to `play` / `pause` / `stop` events to track changes reactively.
	 */
	playState(): PlayStateToken;

	/**
	 * Mute-state token (`'unmuted'` or `'muted'`). Read-only snapshot —
	 * subscribe to the `mute` event to track changes reactively.
	 */
	volumeState(): VolumeStateToken;

	// ── Chapter navigation ──

	/**
	 * Jump directly to the chapter at zero-based `idx`. No-op when `idx` is
	 * out of range. Fires the same seek lifecycle as `time()`.
	 */
	seekToChapter(idx: number, opts?: ActionOptions): void;

	/**
	 * Advance to the next chapter. No-op when already in the last chapter or
	 * when no chapters are loaded.
	 */
	nextChapter(opts?: ActionOptions): void;

	/**
	 * Go back to the previous chapter. No-op when already at or before the
	 * first chapter boundary.
	 */
	previousChapter(opts?: ActionOptions): void;

	// ── Queue mutations (additive) ──

	/**
	 * Prepend one item or an array of items to the start of the queue.
	 * Emits `queue:prepend`.
	 */
	queuePrepend(item: BasePlaylistItem | BasePlaylistItem[], opts?: ActionOptions): void;

	/**
	 * Insert one item or an array of items at zero-based `index`. Items at
	 * and after that position shift right. Emits `queue:insert`.
	 */
	queueInsert(item: BasePlaylistItem | BasePlaylistItem[], index: number, opts?: ActionOptions): void;

	/**
	 * Remove the item with the given `id` from the queue. No-op when the id
	 * is not found. Emits `queue:remove`.
	 */
	queueRemove(id: string | number, opts?: ActionOptions): void;

	/**
	 * Remove the item at zero-based `index`. No-op when `index` is out of
	 * range. Emits `queue:remove`.
	 */
	queueRemoveAt(index: number, opts?: ActionOptions): void;

	/**
	 * Move the item at position `from` to position `to` (both zero-based).
	 * No-op when either index is out of range. Emits `queue:move`.
	 */
	queueMove(from: number, to: number, opts?: ActionOptions): void;

	/** Remove all items from the queue. Emits `queue:clear`. */
	queueClear(opts?: ActionOptions): void;

	/** Randomly reorder all items in the queue in-place. Emits `queue:shuffle`. */
	queueShuffle(opts?: ActionOptions): void;

	/**
	 * Return the item that would become active if `next()` were called now,
	 * without moving the cursor. Returns `undefined` when the queue is
	 * exhausted.
	 */
	peekNext(): BasePlaylistItem | undefined;

	/**
	 * Return the item that would become active if `previous()` were called
	 * now, without moving the cursor. Returns `undefined` when already at
	 * the start.
	 */
	peekPrevious(): BasePlaylistItem | undefined;

	/** Total number of items in the queue. */
	queueLength(): number;

	/**
	 * Zero-based index of the item with the given `id`, or `-1` when not
	 * found.
	 */
	queueIndexOf(id: string | number): number;

	/**
	 * Zero-based index of the currently active item, or `-1` when the queue
	 * is empty.
	 */
	index(): number;

	// ── Backlog mutations ──

	/**
	 * Remove the item with the given `id` from the backlog. No-op when not
	 * found. Emits `backlog:remove`.
	 */
	backlogRemove(id: string | number): void;

	/** Remove all items from the backlog. Emits `backlog:clear`. */
	backlogClear(): void;

}
