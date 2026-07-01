// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { RealtimeFactory } from './IRealtimeChannel';

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
	const handlers = new Map<string, Set<(data?: unknown) => void>>();

	const dispatch = (event: string, data?: unknown): void => {
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
	ws.addEventListener('message', messageEvent => dispatch('message', messageEvent.data));
	ws.addEventListener('close', closeEvent => dispatch('close', {
		code: closeEvent.code,
		reason: closeEvent.reason,
	}));
	ws.addEventListener('error', event => dispatch('error', event));

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
