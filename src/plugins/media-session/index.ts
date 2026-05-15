import type { BaseEventMap, BasePlaylistItem, IPlayer } from '../../types';
import { Plugin } from '../../plugin';

/** Options for {@link MediaSessionPlugin}. */
export interface MediaSessionOptions {
	/**
	 * Base URL prepended to artwork `cover` paths when constructing the
	 * `MediaMetadata` artwork array. Leave unset when `cover` values are already
	 * absolute URLs.
	 */
	artworkBaseUrl?: string;
}

/** Metadata fields pushed to the OS `MediaSession` API. */
export interface MediaSessionMetadata {
	/** Track or episode title shown on the lock screen / Now Playing widget. */
	title?: string;

	/** Artist or creator name. */
	artist?: string;

	/** Album or series name. */
	album?: string;

	/**
	 * Artwork images for the lock screen. The browser picks the closest size
	 * match from the array. Each entry follows the `MediaImage` shape.
	 */
	artwork?: Array<{ src: string; sizes?: string; type?: string }>;
}

/** Action handler keys we may register via `setActionHandler`. */
type Action
	= | 'play'
		| 'pause'
		| 'stop'
		| 'seekto'
		| 'seekbackward'
		| 'seekforward'
		| 'previoustrack'
		| 'nexttrack';

/** Loose surface for transport methods we read off the player. */
interface PlayerSurface {
	play?: (opts?: unknown) => unknown;
	pause?: (opts?: unknown) => unknown;
	stop?: (opts?: unknown) => unknown;
	next?: (opts?: unknown) => unknown;
	previous?: (opts?: unknown) => unknown;
	rewind?: (seconds?: number) => unknown;
	forward?: (seconds?: number) => unknown;
	togglePlayback?: () => unknown;
	currentTime?: ((time?: number) => number | unknown) | (() => number);
	duration?: () => number;
	playbackRate?: () => number;
}

/**
 * Browser `navigator.mediaSession` integration. Bridges the player's transport
 * state to the operating system — lock-screen artwork, hardware media keys,
 * Bluetooth remote controls, and OS Now Playing widgets.
 *
 * **What it wires automatically on `use()`:**
 * - `current` → calls `getMetadata(item)` and pushes the result to the OS.
 * - `play` / `pause` / `ended` → updates `navigator.mediaSession.playbackState`.
 * - `time` + `seek` → calls `setPositionState` so the lock-screen scrubber
 *   tracks the current position.
 * - OS action handlers: `play`, `pause`, `stop`, `previoustrack`, `nexttrack`,
 *   `seekbackward`, `seekforward`, `seekto`.
 *
 * **Browser quirks to be aware of:**
 * - `setPositionState` is silently skipped when `duration` is zero, `NaN`,
 *   `Infinity`, or a non-finite number — some browsers throw on those inputs.
 * - `setActionHandler` for `stop` is not supported in all browsers. The plugin
 *   catches the `TypeError` and continues without it.
 * - Safari requires the `autoplay` attribute on the `<iframe>` (when embedded)
 *   for MediaSession to activate. Without it, OS-level controls never appear.
 * - JSDOM and headless environments do not implement `navigator.mediaSession`.
 *   The plugin guards every call and silently no-ops in those environments.
 *
 * **Customising metadata extraction:**
 * Override `getMetadata(item)` to map your playlist item shape to
 * `MediaSessionMetadata`. The default implementation reads `.title`, `.artist`,
 * `.album`, and `.cover` from the item.
 *
 * **Swapping for a native bridge:**
 * To target a native shell (Capacitor, Electron, or a custom WebView bridge),
 * subclass with the same `static id` and override `setMetadata`,
 * `setActionHandler`, and `setPlaybackState` to route calls to the native API
 * instead of `navigator.mediaSession`.
 */
export class MediaSessionPlugin<
	P extends IPlayer<BaseEventMap> = IPlayer,
	I extends BasePlaylistItem = BasePlaylistItem,
> extends Plugin<P, MediaSessionOptions> {
	static override readonly id: string = 'media-session';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'Browser MediaSession bridge — OS lock screen / hardware keys';

	/** Actions we registered, so we can null them out in `dispose()`. */
	private registeredActions: Set<Action> = new Set();

	/** Last metadata passed to `metadata(meta)`, for the reader overload. */
	private _lastMetadata: MediaSessionMetadata | undefined;

	/**
	 * Wires all player transport events to `navigator.mediaSession` and registers
	 * OS action handlers.
	 *
	 * Silently no-ops in environments where `navigator.mediaSession` is absent
	 * (Node, JSDOM, older WebViews). All event listeners registered here are
	 * cleaned up automatically when the plugin disposes.
	 */
	override use(): void {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
			return;

		this.on('current' as keyof BaseEventMap, ((data: BaseEventMap['current']) => {
			if (!data?.item) {
				this.clearMetadata();
				return;
			}
			const meta = this.getMetadata(data.item as I);
			this.metadata(meta);
		}) as never);

		this.on('play' as keyof BaseEventMap, (() => {
			this.setPlaybackState('playing');
		}) as never);

		this.on('pause' as keyof BaseEventMap, (() => {
			this.setPlaybackState('paused');
		}) as never);

		this.on('ended' as keyof BaseEventMap, (() => {
			this.setPlaybackState('none');
		}) as never);

		this.on('time' as keyof BaseEventMap, ((data: BaseEventMap['time']) => {
			this.updatePositionState(data?.time ?? 0);
		}) as never);

		this.on('seek' as keyof BaseEventMap, ((data: BaseEventMap['seek']) => {
			this.updatePositionState(data?.time ?? 0);
		}) as never);

		this.addPlaybackActions();
		this.addNavigationActions();
		this.addSeekActions();
	}

	/**
	 * Clears `navigator.mediaSession.metadata` and removes every registered
	 * action handler. Safe to call in environments that don't implement
	 * `navigator.mediaSession`.
	 */
	override dispose(): void {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
			return;

		try {
			navigator.mediaSession.metadata = null;
		}
		catch {
			// JSDOM / older browsers may throw on metadata assignment.
		}

		for (const action of this.registeredActions) {
			try {
				navigator.mediaSession.setActionHandler(action, null);
			}
			catch {
				// Action unsupported on this UA — safe to ignore.
			}
		}
		this.registeredActions.clear();
	}

	/**
	 * Read or write the active `MediaSession` metadata.
	 *
	 * **Read** — `metadata()` returns the last `MediaSessionMetadata` object
	 * pushed via the writer, or `undefined` if none has been set yet.
	 *
	 * **Write** — `metadata(meta)` constructs a `MediaMetadata` object and
	 * assigns it to `navigator.mediaSession.metadata`. The OS lock screen and
	 * Now Playing widget update within one repaint cycle. No-ops when
	 * `MediaMetadata` is not available in the current environment.
	 */
	metadata(): MediaSessionMetadata | undefined;
	metadata(meta: MediaSessionMetadata): void;
	metadata(meta?: MediaSessionMetadata): MediaSessionMetadata | undefined | void {
		if (meta === undefined) {
			return this._lastMetadata;
		}

		this._lastMetadata = meta;

		if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
			return;
		if (typeof MediaMetadata === 'undefined')
			return;

		navigator.mediaSession.metadata = new MediaMetadata({
			title: meta.title,
			artist: meta.artist,
			album: meta.album,
			artwork: meta.artwork,
		});
	}

	/**
	 * Clear the OS MediaSession metadata. Hides artwork and title from the lock
	 * screen and Now Playing widget. Called automatically when the current item
	 * clears (i.e. the `current` event fires with a null item).
	 */
	clearMetadata(): void {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
			return;
		navigator.mediaSession.metadata = null;
	}

	/**
	 * Push a playback state to `navigator.mediaSession.playbackState`.
	 *
	 * Valid values are `'playing'`, `'paused'`, and `'none'`. Called
	 * automatically by the `play`, `pause`, and `ended` player event listeners.
	 * Override to route to a native bridge instead.
	 */
	protected setPlaybackState(state: MediaSessionPlaybackState): void {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
			return;
		try {
			navigator.mediaSession.playbackState = state;
		}
		catch {
			// JSDOM may not implement the setter.
		}
	}

	/**
	 * Push a position update to `navigator.mediaSession.setPositionState`. This
	 * drives the scrubber on the lock screen and OS Now Playing widget.
	 *
	 * Silently skips the call when `duration` is not a finite positive number,
	 * because browsers reject those inputs with a `TypeError`.
	 *
	 * Called automatically by the `time` and `seek` player event listeners.
	 */
	protected updatePositionState(position: number): void {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
			return;

		const surface = this.player as unknown as PlayerSurface;
		const duration = typeof surface.duration === 'function' ? surface.duration() : undefined;
		const playbackRate = typeof surface.playbackRate === 'function' ? surface.playbackRate() : 1;

		if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0)
			return;

		try {
			navigator.mediaSession.setPositionState({
				duration,
				position: Math.max(0, Math.min(position, duration)),
				playbackRate: typeof playbackRate === 'number' ? playbackRate : 1,
			});
		}
		catch {
			// setPositionState rejects invalid combos in some browsers — drop silently.
		}
	}

	/**
	 * Extract `MediaSessionMetadata` from a playlist item.
	 *
	 * Override this in subclasses to map your custom playlist item type to the
	 * metadata fields. The base implementation reads `.title`, `.artist`,
	 * `.album`, and `.cover`. When `opts.artworkBaseUrl` is set, it is
	 * prepended to relative `cover` paths.
	 */
	protected getMetadata(item: I): MediaSessionMetadata {
		const x = item as I & {
			title?: string;
			artist?: string;
			album?: string;
			cover?: string;
		};
		const base = this.opts?.artworkBaseUrl ?? '';
		const coverSrc = x.cover ? (base ? `${base}${x.cover}` : x.cover) : undefined;
		return {
			title: x.title,
			artist: x.artist,
			album: x.album,
			artwork: coverSrc ? [{ src: coverSrc }] : undefined,
		};
	}

	/**
	 * Register `play`, `pause`, and `stop` OS action handlers. Called by `use()`.
	 * Override to add or remove playback action handlers.
	 */
	protected addPlaybackActions(): void {
		const surface = this.player as unknown as PlayerSurface;
		this.registerAction('play', () => {
			void surface.play?.();
		});
		this.registerAction('pause', () => {
			void surface.pause?.();
		});
		this.registerAction('stop', () => {
			void surface.stop?.();
		});
	}

	/**
	 * Register `previoustrack` and `nexttrack` OS action handlers. Called by
	 * `use()`. Override to wire custom previous/next logic (e.g. chapter
	 * navigation instead of playlist navigation).
	 */
	protected addNavigationActions(): void {
		const surface = this.player as unknown as PlayerSurface;
		this.registerAction('previoustrack', () => {
			void surface.previous?.();
		});
		this.registerAction('nexttrack', () => {
			void surface.next?.();
		});
	}

	/**
	 * Register `seekbackward`, `seekforward`, and `seekto` OS action handlers.
	 * Called by `use()`. Override to adjust seek offsets or block scrubbing.
	 *
	 * `seekbackward` / `seekforward` use `details.seekOffset` when provided by
	 * the browser, falling back to `5` seconds. `seekto` passes `details.seekTime`
	 * directly to the player's `currentTime` setter.
	 */
	protected addSeekActions(): void {
		const surface = this.player as unknown as PlayerSurface;
		this.registerAction('seekbackward', (details: MediaSessionActionDetails) => {
			const offset = details?.seekOffset ?? 5;
			void surface.rewind?.(offset);
		});
		this.registerAction('seekforward', (details: MediaSessionActionDetails) => {
			const offset = details?.seekOffset ?? 5;
			void surface.forward?.(offset);
		});
		this.registerAction('seekto', (details: MediaSessionActionDetails) => {
			const time = details?.seekTime;
			if (typeof time !== 'number')
				return;
			const ct = surface.currentTime as ((t: number) => unknown) | undefined;
			if (typeof ct === 'function') {
				try {
					(ct as (t: number) => unknown).call(surface, time);
				}
				catch {
					// Player may not support the setter form — drop silently.
				}
			}
		});
	}

	/**
	 * Install one OS action handler and track it for cleanup in `dispose()`.
	 * Silently skips actions the current browser does not support.
	 */
	private registerAction(action: Action, handler: MediaSessionActionHandler): void {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
			return;
		try {
			navigator.mediaSession.setActionHandler(action, handler);
			this.registeredActions.add(action);
		}
		catch {
			// Browser doesn't support this action — keep going.
		}
	}
}

/** Plugin alias for {@link MediaSessionPlugin}. Pass to `addPlugin(mediaSessionPlugin)`. */
export const mediaSessionPlugin = MediaSessionPlugin;
