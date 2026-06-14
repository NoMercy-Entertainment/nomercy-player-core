// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Protocol-agnostic realtime channel. The kit's WebSocket helper returns one
 * of these; consumers swap the underlying transport (native WebSocket,
 * SignalR, Socket.IO, custom) by supplying a factory at setup time or by
 * overriding `Plugin.websocket()` per plugin.
 */
export interface IRealtimeChannel {
	/**
	 * Send a message to the server. Call only when `readyState === 'open'`;
	 * the underlying transport will throw if the connection is not yet ready.
	 */
	send(data: string | ArrayBuffer | Blob): void;

	/**
	 * Close the connection. `code` and `reason` follow the WebSocket close
	 * handshake convention (RFC 6455 §7.4). Omit both for a clean 1000 close.
	 */
	close(code?: number, reason?: string): void;

	/**
	 * Register a listener for a channel lifecycle or data event.
	 *
	 * - `'open'` — connection is established and ready to send.
	 * - `'message'` — a message arrived from the server; `data` holds the payload.
	 * - `'close'` — connection was closed; `data` is `{ code, reason }`.
	 * - `'error'` — a transport-level error occurred.
	 *
	 * Multiple listeners on the same event are all called. Register the
	 * matching `off()` call when the consumer is disposed.
	 */
	on(event: 'open' | 'message' | 'close' | 'error', fn: (data?: unknown) => void): void;

	/** Remove a listener previously registered with `on()`. */
	off(event: 'open' | 'message' | 'close' | 'error', fn: (data?: unknown) => void): void;

	/** Current transport state. Mirrors the WebSocket `readyState` constants. */
	readonly readyState: 'connecting' | 'open' | 'closing' | 'closed';
}

/**
 * Options accepted by `RealtimeFactory` and the kit's `Plugin.websocket()`
 * helper.
 */
export interface RealtimeFactoryOptions {
	/** Sub-protocol strings forwarded to the WebSocket handshake. */
	protocols?: string[];

	/**
	 * Whether the transport should attempt automatic reconnection on
	 * unexpected close. When `true`, `baseDelayMs` and `maxDelayMs` control
	 * the back-off window.
	 */
	reconnect?: boolean;

	/** Initial back-off delay in milliseconds. Defaults to 1 000. */
	baseDelayMs?: number;

	/** Maximum back-off delay in milliseconds. Defaults to 30 000. */
	maxDelayMs?: number;

	/**
	 * Per-call transport factory override. When omitted the player's
	 * configured `websocketFactory` is used; when that is also omitted the
	 * built-in `nativeWebSocketAdapter` is the final fallback.
	 */
	factory?: RealtimeFactory;
}

/**
 * Callable signature for a realtime transport factory.
 *
 * Consumer setup — replace the global default:
 *
 * ```ts
 * setup({ websocketFactory: signalRFactory });
 * ```
 *
 * Plugin per-call override — use a different transport for one connection:
 *
 * ```ts
 * this.websocket(url, { factory: socketIoFactory });
 * ```
 */
export type RealtimeFactory = (url: string, opts?: RealtimeFactoryOptions) => IRealtimeChannel;
