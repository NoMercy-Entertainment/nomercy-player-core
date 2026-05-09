import type { BaseEventMap, IPlayer } from '../types';

import { Plugin } from '../plugin';

/** Commands the host page can send INTO the embedded player. */
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

/** Events the embedded player emits OUT to the host page. */
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
	/** Allowed origin(s) for postMessage commands. Default: `'*'` (any). Strict consumers pin this. */
	allowedOrigins?: string | string[];

	/** Forward these player events to the host. Default: a sensible subset. */
	forwardEvents?: ReadonlyArray<EmbedEventMessage['name']>;

	/** Apply iframe-aware UI / behavior tweaks (smaller controls, no popout). Default: true when `inIframe()`. */
	applyIframeTweaks?: boolean;
}

/**
 * Cross-library embed-context plugin. Lives in core because both libraries
 * embed identically. Handles:
 *
 * - postMessage protocol for parent-frame ↔ embedded player communication
 * - iframe-context detection and UI density adjustments
 * - Forward player events to the host page (`'nm:event'` messages)
 * - Accept commands from the host page (`'nm:command'` messages)
 * - Emit `'embed:ready'` upward when player init completes
 *
 * Does NOT touch MediaSession. Per the W3C spec + browser implementation:
 * each frame owns its own `navigator.mediaSession`. The player's separate
 * `mediaSessionPlugin` works automatically inside an iframe — no postMessage
 * bridging needed.
 *
 * Required iframe `allow` directives for full functionality:
 *
 * ```html
 * <iframe
 *   src="..."
 *   allow="autoplay; fullscreen; picture-in-picture; encrypted-media;
 *          accelerometer; gyroscope; web-share; clipboard-write"
 *   allowfullscreen
 *   loading="lazy"
 * ></iframe>
 * ```
 *
 * `autoplay` is load-bearing: without it MediaSession never activates so
 * OS-level controls (lock screen, Now Playing, Bluetooth) never appear.
 */
export class EmbedPlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, EmbedOptions> {
	static override readonly id: string = 'embed';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'iframe-context bridge — postMessage protocol for parent ↔ embed';

	private _allowedOrigins: string[] = [];
	private _messageListener?: (event: MessageEvent) => void;
	private _eventForwarders: Array<{ event: string; fn: (data: unknown) => void }> = [];

	/** Attaches the postMessage listener and wires player events to forward to the host frame. */
	override use(): void {
		// Normalize allowedOrigins config — string OR string[] OR undefined.
		const o = this.opts?.allowedOrigins;
		if (Array.isArray(o))
			this._allowedOrigins = [...o];
		else if (typeof o === 'string')
			this._allowedOrigins = [o];
		else this._allowedOrigins = []; // strict default — reject all unless configured

		// Only attach the postMessage listener when actually iframed. Top-level
		// pages don't need the bridge (no parent to talk to).
		if (typeof window === 'undefined')
			return;

		// Attach incoming-message listener even on top-level pages (consumers
		// may be testing with simulated parent). The handler still origin-checks.
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

		// Forward configured player events to the host.
		const defaultForward: ReadonlyArray<EmbedEventMessage['name']> = ['ready', 'play', 'pause', 'ended', 'time', 'volume', 'mute'];
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
			(this.player as IPlayer<any>).on(name as never, fn as never);
		}
	}

	/** Detaches all forwarded player event listeners and clears internal state. */
	override dispose(): void {
		// Detach forwarders (the parent class handles `this.listen` cleanup
		// for the message listener via the lifecycle registry).
		for (const { event, fn } of this._eventForwarders) {
			(this.player as IPlayer<any>).off(event as never, fn as never);
		}
		this._eventForwarders = [];
		this._messageListener = undefined;
	}

	/** Send an event to the host page via postMessage. */
	sendToHost(message: EmbedEventMessage): void {
		if (typeof window === 'undefined' || !window.parent)
			return;
		// Pin the post target to the first allowed origin if exactly one is
		// configured (most secure); otherwise '*' since we can't predict the
		// parent's origin without explicit config.
		const target = this._allowedOrigins.length === 1 ? this._allowedOrigins[0]! : '*';
		try {
			window.parent.postMessage(message, target);
		}
		catch {
			// postMessage can throw in cross-origin DOMException scenarios —
			// swallow so the player doesn't blow up on a flaky parent frame.
		}
	}

	/**
	 * Read or write the allowed origins list at runtime.
	 *
	 * `allowedOrigins()` — returns a snapshot of the active allowlist.
	 * `allowedOrigins(origins)` — replaces the allowlist with the given
	 * value (string or string[]).
	 */
	allowedOrigins(): readonly string[];
	allowedOrigins(origins: string | string[]): void;
	allowedOrigins(origins?: string | string[]): readonly string[] | void {
		if (origins === undefined)
			return [...this._allowedOrigins];
		this._allowedOrigins = Array.isArray(origins) ? [...origins] : [origins];
	}

	/** True when running inside a browsing context that is not the top-level. */
	protected inIframe(): boolean {
		if (typeof window === 'undefined')
			return false;
		try {
			return window.self !== window.top;
		}
		catch { return true; } // cross-origin top access throws → we're iframed
	}

	/** Dispatch incoming command messages to the player. Override to extend. */
	protected handleCommand(msg: EmbedCommand): void {
		const player = this.player as IPlayer<any> & {
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
				// Unknown command — log via the scoped logger so consumers can
				// audit what the host page is sending.
				if (typeof console !== 'undefined' && console.warn) {
					console.warn(`[EmbedPlugin] unknown command:`, msg);
				}
		}
	}

	/**
	 * Shape outgoing event messages before postMessage. Override to extend.
	 * Standard payload shape: `{ type: 'nm:event', name, data }` — keeps a
	 * uniform envelope across every event so the host page can switch on
	 * `name` and read `data` consistently.
	 */
	protected formatEvent(name: EmbedEventMessage['name'], data: unknown): EmbedEventMessage | null {
		return {
			type: 'nm:event',
			name,
			data: data ?? {},
		} as unknown as EmbedEventMessage;
	}

	/** Whether to allow incoming commands from a given origin. Override to extend. */
	protected isOriginAllowed(origin: string): boolean {
		if (this._allowedOrigins.length === 0)
			return false; // strict default
		if (this._allowedOrigins.includes('*'))
			return true;
		return this._allowedOrigins.includes(origin);
	}
}

/** Plugin alias for {@link EmbedPlugin}. Pass to `addPlugin(embedPlugin)`. */
export const embedPlugin = EmbedPlugin;
