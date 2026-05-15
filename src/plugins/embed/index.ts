import type { BaseEventMap, IPlayer } from '../../types';

import { Plugin } from '../../plugin';

/** Commands the host page can send INTO the embedded player via `postMessage`. */
export type EmbedCommand
	= | { type: 'nm:command'; action: 'play' }
		| { type: 'nm:command'; action: 'pause' }
		| { type: 'nm:command'; action: 'stop' }
		| { type: 'nm:command'; action: 'seek'; time: number }
		| { type: 'nm:command'; action: 'volume'; level: number }
		| { type: 'nm:command'; action: 'mute' }
		| { type: 'nm:command'; action: 'unmute' }
		| { type: 'nm:command'; action: 'next' }
		| { type: 'nm:command'; action: 'previous' };

/** Events the embedded player emits OUT to the host page via `postMessage`. */
export type EmbedEventMessage
	= | { type: 'nm:event'; name: 'ready' }
		| { type: 'nm:event'; name: 'play' }
		| { type: 'nm:event'; name: 'pause' }
		| { type: 'nm:event'; name: 'ended' }
		| { type: 'nm:event'; name: 'time'; time: number; duration: number }
		| { type: 'nm:event'; name: 'volume'; level: number }
		| { type: 'nm:event'; name: 'mute'; muted: boolean }
		| { type: 'nm:event'; name: 'error'; code: string; severity: string; message?: string };

/** Options for {@link EmbedPlugin}. */
export interface EmbedOptions {
	/**
	 * Allowed origin(s) for incoming `nm:command` postMessages.
	 *
	 * - `'*'` — accept commands from any origin (convenient for development,
	 *   but not recommended in production).
	 * - A single string or an array of strings — only those origins may send
	 *   commands.
	 * - Omitted / empty — **no** origins are allowed. The plugin still forwards
	 *   player events outward, but ignores all inbound commands.
	 *
	 * Prefer an explicit origin list in production iframes.
	 */
	allowedOrigins?: string | string[];

	/**
	 * Player event names to forward to the host page as `nm:event` postMessages.
	 * When omitted the plugin forwards `ready`, `play`, `pause`, `ended`, `time`,
	 * `volume`, and `mute`.
	 */
	forwardEvents?: ReadonlyArray<EmbedEventMessage['name']>;

	/**
	 * When `true`, the plugin applies iframe-appropriate UI adjustments (smaller
	 * controls, suppressed popout button, etc.). Defaults to `true` when
	 * `inIframe()` detects a nested browsing context.
	 */
	applyIframeTweaks?: boolean;
}

/**
 * Cross-origin embed bridge. Handles the full postMessage protocol between a
 * host page and a player running in an `<iframe>`.
 *
 * **What it does:**
 * - Listens on `window` for inbound `nm:command` messages, validates the origin
 *   against `opts.allowedOrigins`, and dispatches them to the player.
 * - Subscribes to the configured player events and forwards them to the host
 *   page as `nm:event` postMessages.
 * - Detects whether the player is running inside a nested browsing context
 *   via `inIframe()`.
 *
 * **Required `<iframe>` attributes for full functionality:**
 * ```html
 * <iframe
 *   src="..."
 *   allow="autoplay; fullscreen; picture-in-picture; encrypted-media;
 *          accelerometer; gyroscope; web-share; clipboard-write"
 *   allowfullscreen
 *   loading="lazy"
 * ></iframe>
 * ```
 * `autoplay` is load-bearing: without it `MediaSession` never activates, so
 * OS-level controls (lock screen, Now Playing, Bluetooth) never appear even
 * if `MediaSessionPlugin` is also registered.
 *
 * **MediaSession note:** each browsing context owns its own
 * `navigator.mediaSession`. `MediaSessionPlugin` works automatically inside an
 * iframe — no postMessage bridging is needed or attempted by this plugin.
 *
 * **Security:** when exactly one origin is listed in `allowedOrigins`, outbound
 * postMessages are pinned to that origin. When multiple are listed or `'*'` is
 * used, outbound messages use `'*'` as the target. Pin to a single origin in
 * production for best security.
 *
 * **Extension points:**
 * - Override `handleCommand(msg)` to add custom command types.
 * - Override `formatEvent(name, data)` to change the outbound message shape.
 * - Override `isOriginAllowed(origin)` to apply custom allow/deny logic.
 * - Override `inIframe()` to inject a fixed value in tests.
 */
export class EmbedPlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, EmbedOptions> {
	static override readonly id: string = 'embed';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'iframe-context bridge — postMessage protocol for parent ↔ embed';

	private _allowedOrigins: string[] = [];
	private _messageListener?: (event: MessageEvent) => void;
	private _eventForwarders: Array<{ event: string; fn: (data: unknown) => void }> = [];

	/**
	 * Normalises `opts.allowedOrigins`, attaches the inbound `message` listener,
	 * and subscribes to the configured player events for outbound forwarding.
	 *
	 * The `message` listener is registered via the plugin lifecycle and is
	 * cleaned up automatically on dispose.
	 */
	override use(): void {
		const o = this.opts?.allowedOrigins;
		if (Array.isArray(o))
			this._allowedOrigins = [...o];
		else if (typeof o === 'string')
			this._allowedOrigins = [o];
		else this._allowedOrigins = [];

		if (typeof window === 'undefined')
			return;

		const onMessage = (event: MessageEvent): void => {
			if (!this.isOriginAllowed(event.origin))
				return;
			const data = event.data as { type?: string };
			if (!data || data.type !== 'nm:command')
				return;
			this.handleCommand(event.data as EmbedCommand);
		};
		this._messageListener = onMessage;
		this.listen(window, 'message', onMessage as EventListener);

		const defaultForward: ReadonlyArray<EmbedEventMessage['name']> = [
			'ready',
			'play',
			'pause',
			'ended',
			'time',
			'volume',
			'mute',
		];
		const forward = this.opts?.forwardEvents ?? defaultForward;

		for (const name of forward) {
			const fn = (data: unknown): void => {
				const msg = this.formatEvent(name, data);
				if (msg)
					this.sendToHost(msg);
			};
			this._eventForwarders.push({
				event: name,
				fn,
			});
			(this.player as IPlayer<BaseEventMap>).on(name as never, fn as never);
		}
	}

	/**
	 * Detaches all forwarded player event listeners and clears internal state.
	 * The `window` message listener is removed by the plugin lifecycle registry.
	 */
	override dispose(): void {
		for (const { event, fn } of this._eventForwarders) {
			(this.player as IPlayer<BaseEventMap>).off(event as never, fn as never);
		}
		this._eventForwarders = [];
		this._messageListener = undefined;
	}

	/**
	 * Send a structured event message to the host page via `window.parent.postMessage`.
	 *
	 * When exactly one origin is in the allowlist the message is posted to that
	 * origin. When the list has more than one entry or contains `'*'`, the target
	 * is `'*'`. Swallows cross-origin `DOMException` so the player never crashes
	 * due to a flaky or unloaded parent frame.
	 */
	sendToHost(message: EmbedEventMessage): void {
		if (typeof window === 'undefined' || !window.parent)
			return;
		const target = this._allowedOrigins.length === 1 ? this._allowedOrigins[0]! : '*';
		try {
			window.parent.postMessage(message, target);
		}
		catch {
			// Cross-origin DOMException — swallow so the player doesn't crash.
		}
	}

	/**
	 * Read or write the allowed-origins list at runtime.
	 *
	 * **Read** — `allowedOrigins()` returns a snapshot array of the current
	 * allowlist. Mutations to the returned array do not affect the live list.
	 *
	 * **Write** — `allowedOrigins(origins)` replaces the allowlist with the
	 * supplied value. Accepts a single string or an array.
	 */
	allowedOrigins(): readonly string[];
	allowedOrigins(origins: string | string[]): void;
	allowedOrigins(origins?: string | string[]): readonly string[] | void {
		if (origins === undefined)
			return [...this._allowedOrigins];
		this._allowedOrigins = Array.isArray(origins) ? [...origins] : [origins];
	}

	/**
	 * Returns `true` when the current page is running inside a nested browsing
	 * context (i.e. inside an `<iframe>`). Cross-origin top access throws —
	 * that exception is treated as confirmation that the page is iframed.
	 */
	protected inIframe(): boolean {
		if (typeof window === 'undefined')
			return false;
		try {
			return window.self !== window.top;
		}
		catch { return true; }
	}

	/**
	 * Dispatch an inbound `nm:command` message to the appropriate player method.
	 *
	 * Override to handle additional command types. Unknown commands are logged
	 * via `this.logger` so consumers can audit what the host page is sending.
	 */
	protected handleCommand(msg: EmbedCommand): void {
		const player = this.player as IPlayer<BaseEventMap> & {
			play?: (opts?: unknown) => Promise<void>;
			pause?: (opts?: unknown) => Promise<void>;
			stop?: (opts?: unknown) => Promise<void>;
			currentTime?: (t?: number) => unknown;
			volume?: (v?: number) => unknown;
			mute?: () => void;
			unmute?: () => void;
			next?: (opts?: unknown) => Promise<void>;
			previous?: (opts?: unknown) => Promise<void>;
		};
		const action = (msg as { action?: string }).action;
		switch (action) {
			case 'play':
				void player.play?.({ source: 'embed' });
				break;
			case 'pause':
				void player.pause?.({ source: 'embed' });
				break;
			case 'stop':
				void player.stop?.({ source: 'embed' });
				break;
			case 'seek':
				player.currentTime?.((msg as { time: number }).time);
				break;
			case 'volume':
				player.volume?.((msg as { level: number }).level);
				break;
			case 'mute':
				player.mute?.();
				break;
			case 'unmute':
				player.unmute?.();
				break;
			case 'next':
				void player.next?.({ source: 'embed' });
				break;
			case 'previous':
				void player.previous?.({ source: 'embed' });
				break;
			default:
				this.logger.warn(`[EmbedPlugin] unknown command: ${JSON.stringify(msg)}`);
		}
	}

	/**
	 * Shape an outbound event message before posting to the host.
	 *
	 * Returns `null` to suppress the message. The default implementation wraps
	 * the payload as `{ type: 'nm:event', name, data }` so the host page can
	 * switch on `name` and read `data` uniformly.
	 *
	 * Override to change the envelope shape or filter specific events.
	 */
	protected formatEvent(name: EmbedEventMessage['name'], data: unknown): EmbedEventMessage | null {
		return {
			type: 'nm:event',
			name,
			data: data ?? {},
		} as unknown as EmbedEventMessage;
	}

	/**
	 * Returns `true` when the given origin is permitted to send commands.
	 *
	 * Default logic:
	 * - Empty allowlist → reject all (secure default).
	 * - `'*'` in the list → accept any origin.
	 * - Exact string match → accept.
	 *
	 * Override to apply custom logic such as wildcard subdomain matching.
	 */
	protected isOriginAllowed(origin: string): boolean {
		if (this._allowedOrigins.length === 0)
			return false;
		if (this._allowedOrigins.includes('*'))
			return true;
		return this._allowedOrigins.includes(origin);
	}
}

/** Plugin alias for {@link EmbedPlugin}. Pass to `addPlugin(embedPlugin)`. */
export const embedPlugin = EmbedPlugin;
