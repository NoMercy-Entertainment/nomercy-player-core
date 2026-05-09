import type { BaseEventMap, BasePlaylistItem, IPlayer } from '../types';
import { Plugin } from '../plugin';

export interface MediaSessionOptions {
	artworkBaseUrl?: string;
}

export interface MediaSessionMetadata {
	title?: string;
	artist?: string;
	album?: string;
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
 * Browser MediaSession integration. Bridges the player's transport state to
 * the OS — lock-screen artwork, hardware keys, Now Playing, Bluetooth controls.
 *
 * Subclasses override `getMetadata(item)` to extract the metadata shape they
 * want to publish from a playlist item.
 *
 * To swap for a non-browser MediaSession (Capacitor, native shell), subclass
 * with the same `static id` and override `setMetadata` / `setActionHandler` /
 * `setPlaybackState`.
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

	override use(): void {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
			return;

		// Wire metadata + state on transport / cursor events. All listeners
		// auto-clean via the plugin lifecycle.
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

	override dispose(): void {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
			return;
		try {
			navigator.mediaSession.metadata = null;
		}
		catch {
			// JSDOM / older browsers may throw.
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
	 * Read or write the active MediaSession metadata.
	 *
	 * `metadata()` — returns the last metadata object passed to the writer,
	 * or `undefined` if none has been set.
	 * `metadata(meta)` — pushes the metadata to the OS MediaSession API.
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

	/** Clear MediaSession metadata so OS controls hide artwork / title. */
	clearMetadata(): void {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
			return;
		navigator.mediaSession.metadata = null;
	}

	/** Set OS-level transport state. */
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

	/** Push a position update to the OS — drives lock-screen scrubber. */
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

	/** Override to extract metadata from a playlist item. */
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

	protected addNavigationActions(): void {
		const surface = this.player as unknown as PlayerSurface;
		this.registerAction('previoustrack', () => {
			void surface.previous?.();
		});
		this.registerAction('nexttrack', () => {
			void surface.next?.();
		});
	}

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
					// Player may not support setter form — drop silently.
				}
			}
		});
	}

	/** Install one action handler and remember it for `dispose()`. */
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

export const mediaSessionPlugin = MediaSessionPlugin;
