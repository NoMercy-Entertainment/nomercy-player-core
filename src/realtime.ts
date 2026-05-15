/**
 * Protocol-agnostic realtime channel. The kit's WebSocket helper returns one
 * of these; consumers swap the underlying transport (native WebSocket,
 * SignalR, Socket.IO, custom) by supplying a factory at setup time or by
 * overriding `Plugin.websocket()` per plugin.
 *
 * Adapter packages live outside the kit (`@nomercy/realtime-signalr`,
 * `@nomercy/realtime-socket-io`) so consumers only pull the SDK weight they
 * actually want.
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
	on(event: 'open' | 'message' | 'close' | 'error', fn: (data?: any) => void): void;

	/** Remove a listener previously registered with `on()`. */
	off(event: 'open' | 'message' | 'close' | 'error', fn: (data?: any) => void): void;

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

/**
 * Default transport adapter. Wraps a native browser `WebSocket` to satisfy
 * `IRealtimeChannel`.
 *
 * Reconnect logic is intentionally absent here — the lifecycle layer above
 * handles auto-reconnect and disposal so every adapter benefits from it
 * without duplicating the logic.
 *
 * Listener errors are swallowed per-listener so a broken handler does not
 * block subsequent listeners on the same event.
 */
export const nativeWebSocketAdapter: RealtimeFactory = (url, opts) => {
	const ws = new WebSocket(url, opts?.protocols);
	const handlers = new Map<string, Set<(data?: any) => void>>();

	const dispatch = (event: string, data?: any) => {
		const set = handlers.get(event);
		if (!set)
			return;
		for (const fn of [...set]) {
			try {
				fn(data);
			}
			catch (err) { void err; }
		}
	};

	ws.addEventListener('open', () => dispatch('open'));
	ws.addEventListener('message', e => dispatch('message', e.data));
	ws.addEventListener('close', e => dispatch('close', {
		code: e.code,
		reason: e.reason,
	}));
	ws.addEventListener('error', e => dispatch('error', e));

	return {
		send(data) { ws.send(data); },
		close(code, reason) { ws.close(code, reason); },
		on(event, fn) {
			let set = handlers.get(event);
			if (!set) {
				set = new Set();
				handlers.set(event, set);
			}
			set.add(fn);
		},
		off(event, fn) {
			handlers.get(event)?.delete(fn);
		},
		get readyState() {
			switch (ws.readyState) {
				case WebSocket.CONNECTING: return 'connecting';
				case WebSocket.OPEN: return 'open';
				case WebSocket.CLOSING: return 'closing';
				default: return 'closed';
			}
		},
	};
};
