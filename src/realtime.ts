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
	send(data: string | ArrayBuffer | Blob): void;
	close(code?: number, reason?: string): void;
	on(event: 'open' | 'message' | 'close' | 'error', fn: (data?: any) => void): void;
	off(event: 'open' | 'message' | 'close' | 'error', fn: (data?: any) => void): void;
	readonly readyState: 'connecting' | 'open' | 'closing' | 'closed';
}

export interface RealtimeFactoryOptions {
	protocols?: string[];
	reconnect?: boolean;
	baseDelayMs?: number;
	maxDelayMs?: number;
	/**
	 * Per-call override — the transport factory. When omitted, the player's
	 * configured `websocketFactory` is used; when that's also omitted, the
	 * built-in `nativeWebSocketAdapter` is used.
	 */
	factory?: RealtimeFactory;
}

/**
 * Factory signature. Consumer setup:
 *
 * ```ts
 * setup({ websocketFactory: signalRFactory });
 * ```
 *
 * Plugin per-call override:
 *
 * ```ts
 * this.websocket(url, { factory: socketIoFactory });
 * ```
 */
export type RealtimeFactory = (url: string, opts?: RealtimeFactoryOptions) => IRealtimeChannel;

/**
 * Default adapter. Wraps a native browser `WebSocket` to satisfy
 * `IRealtimeChannel`. No reconnect logic here — the lifecycle layer above
 * handles auto-reconnect and disposal.
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
