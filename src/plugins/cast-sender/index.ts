import type { BasePlaylistItem, IPlayer, Translations } from '../../types';
import { BrowserPolicyError } from '../../errors';
import { Plugin } from '../../plugin';
import { translationsFromGlob } from '../../translations-glob';

/**
 * Cast sender — Chromecast Web Sender SDK bridge for player ↔ receiver.
 *
 * **This is the shared base class.** Both `nomercy-music-player-v2` and
 * `nomercy-video-player-v2` ship a thin subclass that overrides only the
 * media-type-specific bits:
 *
 *   - {@link CastSenderPlugin.defaultContentType `defaultContentType()`}
 *     — `'audio/mpeg'` for music, `'video/mp4'` for video.
 *   - {@link CastSenderPlugin.buildMetadata `buildMetadata(item, ctors)`} —
 *     constructs a `chrome.cast.media.*MediaMetadata` from the item.
 *
 * Everything else — SDK probe, session lifecycle, RemotePlayer event mirror,
 * forward* helpers, resume-on-disconnect, URL transform — lives here.
 *
 * Player → Cast: forward `current` (loadMedia), `play`/`pause`/`stop`, `seek`,
 * `volume`, `mute` to the active session via the RemotePlayerController.
 *
 * Cast → Player: subscribe to RemotePlayerController events and mirror the
 * receiver's state back as player events tagged `{source: 'cast', silent: true}`
 * so re-broadcast loops are blocked.
 *
 * In environments without the Cast SDK (JSDOM, Firefox, every non-Chromium UA)
 * the bridge stays passive — `connect()` raises `BrowserPolicyError` and all
 * forwarders no-op gracefully. Listeners are still attached so the consumer UI
 * can wire `cast:*` events before the SDK loads.
 */

/** Options for {@link CastSenderPlugin}. */
export interface CastSenderOptions {
	/** Chromecast app id. */
	chromecastAppId?: string;
	/** Whether AirPlay is allowed (Safari only). */
	enableAirPlay?: boolean;
	/** Custom receiver namespace for messages. */
	customReceiverNamespace?: string;
	/**
	 * Resume local playback after the receiver disconnects, restoring the
	 * receiver's last `currentTime` and play/pause state. Default `true`.
	 */
	resumeLocalOnDisconnect?: boolean;
	/**
	 * Default content type when the playlist item doesn't carry `mime`.
	 * Defaults to the value of `defaultContentType()` on the subclass.
	 */
	defaultContentType?: string;
	/**
	 * Treat the source as a live (unbounded) stream. Default `false` — VOD/buffered.
	 */
	live?: boolean;
}

/** Events emitted by {@link CastSenderPlugin}. */
export interface CastSenderEvents {
	'cast:available': { devices: number };
	'cast:connecting': { deviceName: string };
	'cast:connected': { deviceName: string };
	'cast:disconnected': void;
	'cast:error': { error: Error };
	'cast:remote-state': { time: number; state: 'playing' | 'paused' | 'buffering' };
	'cast:media-changed': { contentId: string };
	'unsupported': { reason: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal local typings for the Cast Web Sender SDK globals (`globalThis.cast`
// + `globalThis.chrome.cast`). Spec ref:
// https://developers.google.com/cast/docs/web_sender/integrate
// We only model the bits we actually call — the surface is tiny.
// ─────────────────────────────────────────────────────────────────────────────

type RemotePlayerEventHandler = (event: { value: unknown }) => void;

interface RemotePlayerLike {
	isConnected: boolean;
	isPaused: boolean;
	isMuted: boolean;
	currentTime: number;
	duration: number;
	volumeLevel: number;
	mediaInfo: { contentId?: string } | null;
}

interface RemotePlayerControllerLike {
	addEventListener: (event: string, handler: RemotePlayerEventHandler) => void;
	removeEventListener: (event: string, handler: RemotePlayerEventHandler) => void;
	playOrPause: () => void;
	stop: () => void;
	seek: () => void;
	setVolumeLevel: () => void;
	muteOrUnmute: () => void;
}

interface CastSessionLike {
	loadMedia: (req: unknown) => Promise<unknown>;
	getSessionId?: () => string;
	getCastDevice?: () => { friendlyName?: string };
}

interface CastContextLike {
	requestSession: () => Promise<unknown>;
	endCurrentSession?: (stopCasting?: boolean) => void;
	getCurrentSession?: () => null | CastSessionLike;
}

interface CastFrameworkGlobal {
	framework?: {
		CastContext?: { getInstance: () => CastContextLike };
		RemotePlayer?: new () => RemotePlayerLike;
		RemotePlayerController?: new (player: RemotePlayerLike) => RemotePlayerControllerLike;
		RemotePlayerEventType?: {
			IS_CONNECTED_CHANGED: string;
			IS_PAUSED_CHANGED: string;
			CURRENT_TIME_CHANGED: string;
			IS_MEDIA_LOADED_CHANGED: string;
			MEDIA_INFO_CHANGED: string;
			VOLUME_LEVEL_CHANGED: string;
			IS_MUTED_CHANGED: string;
		};
	};
}

/**
 * Minimum set of `chrome.cast.media` constructors the bridge needs.
 * Subclasses' `buildMetadata` may read additional constructors off the same
 * object — the entire `chrome.cast.media` namespace gets passed through.
 */
export interface ChromeCastMediaCtors {
	MediaInfo: new (contentId: string, contentType: string) => Record<string, unknown>;
	LoadRequest: new (mediaInfo: unknown) => Record<string, unknown>;
	GenericMediaMetadata: new () => Record<string, unknown>;
	StreamType: { BUFFERED: string; LIVE: string };
	[k: string]: unknown;
}

interface ChromeCastGlobal {
	cast?: {
		media?: ChromeCastMediaCtors;
	};
}

/** Loose surface of the player methods the bridge drives on Cast → player. */
interface PlayerSurface<TItem> {
	play?: (opts?: { source?: string; silent?: boolean }) => unknown;
	pause?: (opts?: { source?: string; silent?: boolean }) => unknown;
	stop?: (opts?: { source?: string; silent?: boolean }) => unknown;
	currentTime?: (t?: number, opts?: { source?: string; silent?: boolean }) => number | unknown | Promise<void>;
	current?: () => TItem | undefined;
	emit?: (event: string, payload: unknown) => void;
}

/**
 * Shared Cast sender plugin. Subclass per media library and override the
 * media-specific hooks; everything else is taken care of.
 */
export class CastSenderPlugin<
	TPlayer extends IPlayer<any> = IPlayer<any>,
	TItem extends BasePlaylistItem = BasePlaylistItem,
> extends Plugin<TPlayer, CastSenderOptions, CastSenderEvents> {
	static override readonly id: string = 'cast-sender';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'Chromecast sender — Web Sender SDK bridge';
	/**
	 * Auto-discovered translations. Drop a new `i18n/<tag>.ts` next to this
	 * file (default-exporting a flat key→string map) and the build picks it
	 * up — no manual registration. Each plugin in the chain ships ONLY its
	 * own keys; the kit's plugin registration walks the prototype chain so
	 * subclass bundles never shadow the parent.
	 */
	static override readonly translations: Translations = translationsFromGlob('./i18n/*.ts');

	private connected: boolean = false;
	private remotePlayer: RemotePlayerLike | null = null;
	private remoteController: RemotePlayerControllerLike | null = null;
	private listeners: Array<{ event: string; handler: RemotePlayerEventHandler }> = [];
	/** Suppress player → cast forwarding while we're applying a cast → player update. */
	private applyingFromRemote: boolean = false;

	/**
	 * Called by the plugin system when the plugin is mounted to a player.
	 * Subscribes to `current`, `play`, `pause`, `stop`, `seek`, `volume`, and
	 * `mute` player events, forwarding each to the active Cast session via the
	 * RemotePlayerController. Events tagged `{source: 'cast'}` are skipped to
	 * prevent re-broadcast loops when the bridge mirrors receiver state back.
	 */
	override use(): void {
		this.on('current', (_data) => {
			if (!this.isConnected() || this.applyingFromRemote)
				return;
			void this.forwardCurrent();
		});
		this.on('play', (data) => {
			const d = data as Record<string, unknown> | undefined;
			if (!this.isConnected() || this.applyingFromRemote || d?.['source'] === 'cast')
				return;
			this.forwardPlayPause(true);
		});
		this.on('pause', (data) => {
			const d = data as Record<string, unknown> | undefined;
			if (!this.isConnected() || this.applyingFromRemote || d?.['source'] === 'cast')
				return;
			this.forwardPlayPause(false);
		});
		this.on('stop', (data) => {
			const d = data as Record<string, unknown> | undefined;
			if (!this.isConnected() || this.applyingFromRemote || d?.['source'] === 'cast')
				return;
			this.forwardStop();
		});
		this.on('seek', (data) => {
			const d = data as Record<string, unknown> | undefined;
			if (!this.isConnected() || this.applyingFromRemote || d?.['source'] === 'cast')
				return;
			this.forwardSeek(typeof d?.['time'] === 'number' ? d['time'] as number : 0);
		});
		this.on('volume', (data) => {
			const d = data as Record<string, unknown> | undefined;
			if (!this.isConnected() || this.applyingFromRemote)
				return;
			this.forwardVolume(typeof d?.['level'] === 'number' ? d['level'] as number : 1);
		});
		this.on('mute', (data) => {
			const d = data as Record<string, unknown> | undefined;
			if (!this.isConnected() || this.applyingFromRemote)
				return;
			this.forwardMute(!!d?.['muted']);
		});
	}

	/**
	 * Called by the plugin system when the player is disposed or the plugin is
	 * removed. Tears down RemotePlayerController listeners and ends any active
	 * Cast session. Safe to call multiple times.
	 */
	override dispose(): void {
		this.detachRemoteListeners();
		if (this.connected) {
			try {
				this.castContext()?.endCurrentSession?.(true);
			}
			catch { /* SDK absent or in a bad state — drop. */ }
		}
		this.connected = false;
	}

	/** Returns `true` while a Cast session is established and `connect()` has not been followed by `disconnect()` or a remote disconnect. */
	isConnected(): boolean {
		return this.connected;
	}

	/**
	 * Opens the Cast session picker and waits for the user to choose a device.
	 * Once the session is established the bridge attaches RemotePlayerController
	 * listeners and immediately forwards the current playlist item to the receiver.
	 *
	 * Emits `cast:connected` on success. Emits `cast:error` and re-throws on
	 * failure. Emits `unsupported` and throws `BrowserPolicyError` if the Cast
	 * SDK (`cast.framework`) is absent from the page — non-Chromium browsers
	 * always land here.
	 *
	 * @throws {BrowserPolicyError} `core:policy/castUnavailable` — Cast SDK not loaded.
	 */
	async connect(): Promise<void> {
		const ctx = this.castContext();
		const id = (this.constructor as typeof CastSenderPlugin).id;
		if (!ctx) {
			this.emit('unsupported', { reason: 'cast-sdk-missing' });
			throw new BrowserPolicyError({
				code: 'core:policy/castUnavailable',
				severity: 'error',
				scope: {
					kind: 'plugin',
					id,
				},
				message: 'Cast SDK is not available — load cast.framework before calling connect().',
			});
		}
		try {
			await ctx.requestSession();
			this.attachRemoteListeners();
			this.connected = true;
			const session = ctx.getCurrentSession?.();
			const deviceName = session?.getCastDevice?.()?.friendlyName ?? 'Cast device';
			this.emit('cast:connected', { deviceName });
			// Forward whatever the local player has loaded right now.
			void this.forwardCurrent();
		}
		catch (err) {
			this.connected = false;
			this.emit('cast:error', { error: err instanceof Error ? err : new Error(String(err)) });
			throw err;
		}
	}

	/**
	 * Ends the current Cast session and tears down the RemotePlayerController
	 * listeners. Idempotent — safe to call when already disconnected. Emits
	 * `cast:disconnected`. Emits `unsupported` if the SDK is absent.
	 */
	disconnect(): void {
		const ctx = this.castContext();
		if (!ctx) {
			this.emit('unsupported', { reason: 'cast-sdk-missing' });
			return;
		}
		this.detachRemoteListeners();
		try {
			ctx.endCurrentSession?.(true);
		}
		catch { /* SDK in a bad state — drop. */ }
		this.connected = false;
		this.emit('cast:disconnected', undefined as never);
	}

	// ── Hooks for subclasses ───────────────────────────────────────────────

	/**
	 * Default content type when the playlist item lacks `mime` / `contentType`.
	 * Override to specialize per media library (audio vs video).
	 */
	protected defaultContentType(): string {
		return 'application/octet-stream';
	}

	/**
	 * Build a `chrome.cast.media.*MediaMetadata` from the current playlist
	 * item. Override to plug in `MusicTrackMediaMetadata`, `TvShowMediaMetadata`,
	 * etc., and resolve URLs via `this.resolveUrl(url, 'poster' | 'sprite')`.
	 *
	 * Default returns a minimal `GenericMediaMetadata` with the title only.
	 */
	protected async buildMetadata(item: TItem, ctors: ChromeCastMediaCtors): Promise<unknown> {
		const meta = new ctors.GenericMediaMetadata() as Record<string, unknown>;
		meta['title'] = (item as unknown as { title?: string; name?: string }).title
			?? (item as unknown as { name?: string }).name
			?? '';
		return meta;
	}

	// ── Internals ──────────────────────────────────────────────────────────

	/** Resolve the global cast.framework, or null if absent. */
	private castFramework(): CastFrameworkGlobal['framework'] | null {
		const g = (typeof globalThis !== 'undefined' ? globalThis : ({} as unknown)) as { cast?: CastFrameworkGlobal };
		return g.cast?.framework ?? null;
	}

	/** Resolve the global cast.framework.CastContext, or null if absent. */
	protected castContext(): CastContextLike | null {
		const fw = this.castFramework();
		if (!fw?.CastContext)
			return null;
		try {
			return fw.CastContext.getInstance();
		}
		catch { return null; }
	}

	/** Resolve the chrome.cast.media constructors, or null if absent. */
	protected chromeCastMedia(): ChromeCastMediaCtors | null {
		const g = (typeof globalThis !== 'undefined' ? globalThis : ({} as unknown)) as { chrome?: ChromeCastGlobal };
		return g.chrome?.cast?.media ?? null;
	}

	/** Wire up RemotePlayerController event subscriptions for cast → player mirroring. */
	private attachRemoteListeners(): void {
		this.detachRemoteListeners();
		const fw = this.castFramework();
		if (!fw?.RemotePlayer || !fw.RemotePlayerController || !fw.RemotePlayerEventType)
			return;
		try {
			const remote = new fw.RemotePlayer();
			const controller = new fw.RemotePlayerController(remote);
			const ev = fw.RemotePlayerEventType;
			this.remotePlayer = remote;
			this.remoteController = controller;

			const subscribe = (event: string, handler: RemotePlayerEventHandler): void => {
				controller.addEventListener(event, handler);
				this.listeners.push({
					event,
					handler,
				});
			};

			subscribe(ev.IS_CONNECTED_CHANGED, () => {
				if (!remote.isConnected) {
					this.handleRemoteDisconnect();
				}
				else {
					this.emitPlayer('castState', { state: 'connected' });
				}
			});
			subscribe(ev.IS_PAUSED_CHANGED, () => {
				const evtName = remote.isPaused ? 'pause' : 'play';
				this.applyingFromRemote = true;
				try {
					this.emitPlayer(evtName, {
						source: 'cast',
						silent: true,
					});
				}
				finally {
					this.applyingFromRemote = false;
				}
				this.emit('cast:remote-state', {
					time: remote.currentTime ?? 0,
					state: remote.isPaused ? 'paused' : 'playing',
				});
			});
			subscribe(ev.CURRENT_TIME_CHANGED, () => {
				this.applyingFromRemote = true;
				try {
					this.emitPlayer('time', {
						time: remote.currentTime ?? 0,
						source: 'cast',
					});
				}
				finally { this.applyingFromRemote = false; }
			});
			subscribe(ev.IS_MEDIA_LOADED_CHANGED, () => {
				if (remote.mediaInfo)
					this.emitPlayer('mediaReady', undefined);
			});
			subscribe(ev.MEDIA_INFO_CHANGED, () => {
				const id = remote.mediaInfo?.contentId;
				if (!id)
					return;
				const local = (this.player as unknown as PlayerSurface<TItem>).current?.();
				const localUrl = (local as unknown as { url?: string })?.url;
				if (localUrl && id !== localUrl) {
					this.emit('cast:media-changed', { contentId: id });
				}
			});
		}
		catch (err) {
			// SDK present but constructors failed — surface as cast:error.
			this.emit('cast:error', { error: err instanceof Error ? err : new Error(String(err)) });
		}
	}

	/** Unsubscribes every registered RemotePlayerController listener and clears the remote player references. */
	private detachRemoteListeners(): void {
		if (!this.remoteController) {
			this.listeners = [];
			this.remotePlayer = null;
			return;
		}
		for (const { event, handler } of this.listeners) {
			try {
				this.remoteController.removeEventListener(event, handler);
			}
			catch { /* receiver gone — drop. */ }
		}
		this.listeners = [];
		this.remoteController = null;
		this.remotePlayer = null;
	}

	/**
	 * Invoked by the IS_CONNECTED_CHANGED listener when `remote.isConnected`
	 * becomes false. Captures the receiver's last position and pause state,
	 * tears down the session, then optionally restores playback locally so the
	 * user's media keeps going without manual intervention.
	 * Controlled by `CastSenderOptions.resumeLocalOnDisconnect` (default `true`).
	 */
	private handleRemoteDisconnect(): void {
		const remote = this.remotePlayer;
		const wasPaused = remote?.isPaused ?? true;
		const lastTime = remote?.currentTime ?? 0;
		const opts: CastSenderOptions = this.opts ?? {};
		const resume = opts.resumeLocalOnDisconnect !== false;

		this.detachRemoteListeners();
		this.connected = false;
		this.emitPlayer('castState', { state: 'disconnected' });
		this.emit('cast:disconnected', undefined as never);

		if (resume) {
			const surface = this.player as unknown as PlayerSurface<TItem>;
			try {
				const setter = surface.currentTime;
				if (typeof setter === 'function' && lastTime > 0) {
					void setter.call(this.player, lastTime, { source: 'cast' });
				}
				if (wasPaused)
					surface.pause?.({ source: 'cast' });
				else void surface.play?.({ source: 'cast' });
			}
			catch { /* local player not ready — drop. */ }
		}
	}

	/**
	 * Reads the current playlist item, resolves its URL through the player's
	 * auth-aware URL resolver, constructs a `chrome.cast.media.MediaInfo`
	 * (via `buildMetadata()`), and calls `session.loadMedia()`. Emits
	 * `cast:error` on failure rather than throwing. No-ops if there is no
	 * active session, no `chrome.cast.media` namespace, or no current item.
	 */
	private async forwardCurrent(): Promise<void> {
		const ctx = this.castContext();
		const session = ctx?.getCurrentSession?.();
		const ctors = this.chromeCastMedia();
		if (!session?.loadMedia || !ctors)
			return;
		const item = (this.player as unknown as PlayerSurface<TItem>).current?.();
		if (!item)
			return;
		const opts: CastSenderOptions = this.opts ?? {};
		const rawUrl = (item as unknown as { url?: string }).url;
		if (!rawUrl)
			return;
		const itemAny = item as unknown as { mime?: string; contentType?: string };
		const contentType = itemAny.mime
			?? itemAny.contentType
			?? opts.defaultContentType
			?? this.defaultContentType();
		try {
			// Receiver fetches the URL itself — push auth via the player's
			// URL resolver so query-string / signed-URL schemes reach the
			// cast device.
			const url = (await this.resolveUrl(rawUrl, 'cast')).href;
			const mediaInfo = new ctors.MediaInfo(url, contentType) as Record<string, unknown> & {
				metadata?: unknown;
				streamType?: string;
			};
			const metadata = await this.buildMetadata(item, ctors);
			mediaInfo.metadata = metadata;
			mediaInfo.streamType = opts.live ? ctors.StreamType.LIVE : ctors.StreamType.BUFFERED;
			const request = new ctors.LoadRequest(mediaInfo);
			await session.loadMedia(request);
		}
		catch (err) {
			this.emit('cast:error', { error: err instanceof Error ? err : new Error(String(err)) });
		}
	}

	/**
	 * Calls `RemotePlayerController.playOrPause()` only when the receiver's
	 * state differs from `wantPlaying` — avoids redundant toggles that can
	 * confuse the Cast SDK state machine.
	 */
	private forwardPlayPause(wantPlaying: boolean): void {
		const remote = this.remotePlayer;
		const ctrl = this.remoteController;
		if (!remote || !ctrl)
			return;
		// playOrPause toggles — only call when remote state differs.
		if (remote.isPaused === !wantPlaying) {
			try {
				ctrl.playOrPause();
			}
			catch { /* receiver gone — drop. */ }
		}
	}

	/** Stops the receiver. No-ops gracefully if the receiver is gone. */
	private forwardStop(): void {
		try {
			this.remoteController?.stop();
		}
		catch { /* receiver gone — drop. */ }
	}

	/** Writes `time` (clamped to ≥ 0) into `remotePlayer.currentTime` then calls `seek()`. */
	private forwardSeek(time: number): void {
		const remote = this.remotePlayer;
		const ctrl = this.remoteController;
		if (!remote || !ctrl)
			return;
		try {
			remote.currentTime = Math.max(0, time);
			ctrl.seek();
		}
		catch { /* receiver gone — drop. */ }
	}

	/**
	 * Forward the player's 0-100 volume level to the Cast SDK.
	 * The SDK's `volumeLevel` field expects a 0-1 float, so we divide at the
	 * boundary and clamp to keep the value in spec range.
	 */
	private forwardVolume(level: number): void {
		const remote = this.remotePlayer;
		const ctrl = this.remoteController;
		if (!remote || !ctrl)
			return;

		try {
			remote.volumeLevel = Math.max(0, Math.min(1, level / 100));
			ctrl.setVolumeLevel();
		}
		catch { /* receiver gone — drop. */ }
	}

	/** Calls `RemotePlayerController.muteOrUnmute()` only when the receiver's mute state differs from `muted`. */
	private forwardMute(muted: boolean): void {
		const remote = this.remotePlayer;
		const ctrl = this.remoteController;
		if (!remote || !ctrl)
			return;
		if (remote.isMuted === muted)
			return;
		try {
			remote.isMuted = muted;
			ctrl.muteOrUnmute();
		}
		catch { /* receiver gone — drop. */ }
	}

	/**
	 * Emits an event directly on the player instance. Used by the cast → player
	 * mirror path where the event name is not statically known at compile time.
	 * Swallows errors so receiver-race teardown can't crash the plugin.
	 */
	private emitPlayer(event: string, payload: unknown): void {
		try {
			(this.player as unknown as PlayerSurface<TItem>).emit?.(event, payload);
		}
		catch { /* player teardown raced — drop. */ }
	}
}

/** Plugin alias for {@link CastSenderPlugin}. Pass to `addPlugin(castSenderPlugin)`. */
export const castSenderPlugin = CastSenderPlugin;
