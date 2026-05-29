import type { BaseEventMap, BasePlaylistItem, IPlayer } from '../../types';
import { Plugin } from '../../core/plugin';

/** MIME type inferred from a URL's lowercase file extension. */
const MIME_BY_EXT: Readonly<Record<string, string>> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif',
	avif: 'image/avif',
	svg: 'image/svg+xml',
} as const;

/**
 * Infer a `MediaImage` MIME type from the URL's extension.
 * Returns `'image/jpeg'` when the extension is absent or unrecognised — the
 * browser will follow `Content-Type` regardless, so this is advisory only.
 */
function mimeFromUrl(url: string): string {
	const ext = url.split('?')[0]?.split('.').pop()
		?.toLowerCase() ?? '';
	return MIME_BY_EXT[ext] ?? 'image/jpeg';
}

/** Options for {@link MediaSessionPlugin}. Currently empty — reserved for future options. */
export interface MediaSessionOptions {}

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
 * Override `getMetadata(item)` to map your playlist item shape to text metadata
 * (`title`, `artist`, `album`). Artwork is resolved automatically from the item's
 * `image`, `poster`, `thumbnail`, or `cover` field via the player's `urlResolver`.
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
			void this._pushMetadata(data.item as I);
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

		// Seed metadata from the player's existing current item. When the
		// consumer wires the plugin AFTER queue() + current() have already
		// fired (the common pattern: registry.applyToPlayer + queue + current
		// runs synchronously in one tick, but addPlugin's `use()` resolves on
		// a microtask), the initial `current` event lands before this listener
		// is attached. Without this seed the OS lock screen / Now Playing
		// widget stays empty until the user manually triggers a track change.
		const currentItemReader = (this.player as unknown as { current?: () => I | undefined }).current;
		if (typeof currentItemReader === 'function') {
			const existing = currentItemReader.call(this.player);
			if (existing)
				void this._pushMetadata(existing);
		}
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
	 * Resolve metadata from a playlist item and push it to the OS MediaSession.
	 * Async because the image URL goes through `this.resolveUrl('poster')` so
	 * custom resolvers (CDN signing, auth tokens) apply transparently.
	 *
	 * Called by the `current` event handler. Not intended for direct use outside
	 * the plugin; override `getMetadata` to customise the metadata shape instead.
	 */
	private async _pushMetadata(item: I): Promise<void> {
		const base = this.getMetadata(item);
		const rawUrl = this._pickImageUrl(item);

		if (!rawUrl) {
			this.metadata(base);
			return;
		}

		const resolved = await this.resolveUrl(rawUrl, 'poster');
		const src = resolved.href;

		this.metadata({
			...base,
			artwork: [
				{
					src,
					sizes: '512x512',
					type: mimeFromUrl(src),
				},
			],
		});
	}

	/**
	 * Pick the first non-empty image URL from the item's known image fields.
	 * Priority: `image` → `poster` → `thumbnail` → `cover`.
	 *
	 * `image` / `poster` / `thumbnail` match `VideoPlaylistItem`; `cover` matches
	 * `MusicPlaylistItem`. This order mirrors the precedence documented on
	 * `VideoPlaylistItem`.
	 */
	private _pickImageUrl(item: I): string | undefined {
		const candidate = item as I & {
			image?: string;
			poster?: string;
			thumbnail?: string;
			cover?: string;
		};
		return candidate.image ?? candidate.poster ?? candidate.thumbnail ?? candidate.cover;
	}

	/**
	 * Extract text metadata fields from a playlist item.
	 *
	 * Override in subclasses to map custom item shapes to the `MediaSessionMetadata`
	 * text fields. The base implementation reads `.title`, `.artist`, and `.album`.
	 * Artwork resolution is handled separately by `_pushMetadata` so overriding
	 * this method does not need to touch the `artwork` array.
	 */
	protected getMetadata(item: I): MediaSessionMetadata {
		const candidate = item as I & {
			title?: string;
			artist?: string;
			album?: string;
		};
		return {
			title: candidate.title,
			artist: candidate.artist,
			album: candidate.album,
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
