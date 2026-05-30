import type { ICueParser } from '../adapters/cue-parser/ICueParser';
import type { AddClasses, CreateElement } from '../adapters/element-factory';
import type { IPlatform } from '../adapters/platform/browser';
import type { DispatchTarget } from '../core/dispatch';

import type { Chapter } from './chapter';
import type { AuthConfig } from './config';
import type { BaseEventMap } from './events';
import type { PlayerExperimental } from './experimental';
import type { PluginCtorWithId } from './plugin';
import type {
	AudioTrackState,
	BufferState,
	NetworkState,
	QualityState,
	SetupState,
	VisibilityState,
} from './state';
import type { CurrentAudioTrackSelection, CurrentQualitySelection, CurrentSubtitleSelection } from './tracks';
import type { Translations } from './translations';
import type { IUrlResolver, ResolvedUrl, UrlCategory } from './url';

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
export interface IPlayer<E extends BaseEventMap = BaseEventMap>
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
	urlResolver(): IUrlResolver | undefined;
	urlResolver(resolver: IUrlResolver | undefined): void;

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
	 * `currentSubtitle()` — `{ index, track }` of the selected track, or `null` when off.
	 * `currentSubtitle(idx)` — select track; pass `null` to disable. Fires `subtitle`.
	 */
	currentSubtitle(): CurrentSubtitleSelection | null;
	currentSubtitle(idx: number | null): void;

	/**
	 * Read or write the active audio track.
	 *
	 * `currentAudioTrack()` — `{ index, track }` of the selected track, or `null` when unset.
	 * `currentAudioTrack(idx)` — select track. Fires `audioTrack`.
	 */
	currentAudioTrack(): CurrentAudioTrackSelection | null;
	currentAudioTrack(idx: number): void;

	/**
	 * Read or write the active quality level.
	 *
	 * `currentQuality()` — `{ index, level }` of selected quality, or `'auto'` for ABR.
	 * `currentQuality(idx)` — lock to a level or pass `'auto'` to restore ABR.
	 */
	currentQuality(): CurrentQualitySelection | 'auto';
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

	// ── Transport — shared by both NMMusicPlayer and NMVideoPlayer ──

	/**
	 * Start or resume playback.
	 * `opts.source` defaults to `'user'`. `opts.silent` skips lifecycle events.
	 */
	play?(opts?: ActionOptions): Promise<void> | void;

	/** Pause playback. */
	pause?(opts?: ActionOptions): Promise<void> | void;

	/** Stop playback and reset position. */
	stop?(opts?: ActionOptions): Promise<void> | void;

	/** Toggle between play and pause. */
	togglePlayback?(opts?: ActionOptions): Promise<void> | void;

	/** Seek backward by `seconds` (default 5). */
	rewind?(seconds?: number, opts?: ActionOptions): void;

	/** Seek forward by `seconds` (default 5). */
	forward?(seconds?: number, opts?: ActionOptions): void;

	/** Advance to the next item in the queue. */
	next?(opts?: ActionOptions): Promise<void> | void;

	/** Go to the previous item in the queue. */
	previous?(opts?: ActionOptions): Promise<void> | void;

	// ── Volume ──

	/** Increase volume by `step` (default 0.1). */
	volumeUp?(step?: number): void;

	/** Decrease volume by `step` (default 0.1). */
	volumeDown?(step?: number): void;

	/** Mute the player. */
	mute?(opts?: ActionOptions): void;

	/** Unmute the player. */
	unmute?(opts?: ActionOptions): void;

	/** Toggle mute state. */
	toggleMute?(): void;

	// ── Playback state accessors ──

	/**
	 * Read or write the current playback position in seconds.
	 * `currentTime()` — returns the current position.
	 * `currentTime(seconds, opts?)` — seek to `seconds`.
	 */
	currentTime?(): number;
	currentTime?(seconds: number, opts?: ActionOptions): void;

	/** Total duration of the current item in seconds. `0` when unknown. */
	duration?(): number;

	/**
	 * Read or write the playback rate.
	 * `1.0` = normal speed; `0.5` = half speed; `2.0` = double speed.
	 */
	playbackRate?(): number;
	playbackRate?(rate: number): void;

}
