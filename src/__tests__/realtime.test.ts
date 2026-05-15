/**
 * nativeWebSocketAdapter tests — wraps native WebSocket as IRealtimeChannel.
 * Mocks the global WebSocket so tests don't need a server.
 *
 * Test groups:
 *  - Adapter shape (IRealtimeChannel surface)
 *  - on/off — open / message / close / error
 *  - send — passes through to underlying socket
 *  - close — passes through with code + reason
 *  - readyState — maps WebSocket numeric states to string union
 *  - Multiple listeners on same event
 *  - Listener throw doesn't break dispatch
 */

import type { IRealtimeChannel } from '../adapters/realtime/IRealtimeChannel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nativeWebSocketAdapter } from '../adapters/realtime/websocket';

// Module-level capture of constructed instances so tests can introspect them.
const constructedSockets: MockWebSocket[] = [];

class MockWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	readyState = 0;
	url: string;
	protocols?: string | string[];
	private listeners = new Map<string, Set<EventListener>>();
	send = vi.fn();
	close = vi.fn();

	constructor(url: string, protocols?: string | string[]) {
		this.url = url;
		this.protocols = protocols;
		constructedSockets.push(this);
	}

	addEventListener(type: string, listener: EventListener): void {
		let set = this.listeners.get(type);
		if (!set) {
			set = new Set();
			this.listeners.set(type, set);
		}
		set.add(listener);
	}

	removeEventListener(type: string, listener: EventListener): void {
		this.listeners.get(type)?.delete(listener);
	}

	dispatchEvent(event: Event): boolean {
		this.listeners.get(event.type)?.forEach(l => l(event));
		return true;
	}
}

describe('nativeWebSocketAdapter', () => {
	let originalWebSocket: typeof WebSocket;

	beforeEach(() => {
		originalWebSocket = globalThis.WebSocket;
		constructedSockets.length = 0;
		// Direct class assignment — `new MockWebSocket(...)` works as expected.
		globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
	});

	afterEach(() => {
		globalThis.WebSocket = originalWebSocket;
	});

	describe('adapter shape', () => {
		it('returns an object that satisfies IRealtimeChannel', () => {
			const channel: IRealtimeChannel = nativeWebSocketAdapter('wss://x');
			expect(typeof channel.send).toBe('function');
			expect(typeof channel.close).toBe('function');
			expect(typeof channel.on).toBe('function');
			expect(typeof channel.off).toBe('function');
			expect(typeof channel.readyState).toBe('string');
		});

		it('passes URL and protocols through to WebSocket constructor', () => {
			nativeWebSocketAdapter('wss://x/y', { protocols: ['v1', 'v2'] });
			expect(constructedSockets[0]!.url).toBe('wss://x/y');
			expect(constructedSockets[0]!.protocols).toEqual(['v1', 'v2']);
		});

		it('omits protocols when none given', () => {
			nativeWebSocketAdapter('wss://x/y');
			expect(constructedSockets[0]!.url).toBe('wss://x/y');
			expect(constructedSockets[0]!.protocols).toBeUndefined();
		});
	});

	describe('on() / off()', () => {
		it('on("open") fires when underlying socket opens', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			const handler = vi.fn();
			channel.on('open', handler);
			constructedSockets[0]!.dispatchEvent(new Event('open'));
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('on("message") receives the message data', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			const handler = vi.fn();
			channel.on('message', handler);
			const event = new MessageEvent('message', { data: 'payload' });
			constructedSockets[0]!.dispatchEvent(event);
			expect(handler).toHaveBeenCalledWith('payload');
		});

		it('on("close") receives { code, reason }', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			const handler = vi.fn();
			channel.on('close', handler);
			const event = new CloseEvent('close', { code: 1000, reason: 'normal' });
			constructedSockets[0]!.dispatchEvent(event);
			expect(handler).toHaveBeenCalledWith({ code: 1000, reason: 'normal' });
		});

		it('on("error") receives the error event', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			const handler = vi.fn();
			channel.on('error', handler);
			constructedSockets[0]!.dispatchEvent(new Event('error'));
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('off() removes a specific listener', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			const handler = vi.fn();
			channel.on('message', handler);
			channel.off('message', handler);
			constructedSockets[0]!.dispatchEvent(new MessageEvent('message', { data: 'x' }));
			expect(handler).not.toHaveBeenCalled();
		});

		it('multiple listeners on same event all fire', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			const a = vi.fn();
			const b = vi.fn();
			channel.on('message', a);
			channel.on('message', b);
			constructedSockets[0]!.dispatchEvent(new MessageEvent('message', { data: 'x' }));
			expect(a).toHaveBeenCalled();
			expect(b).toHaveBeenCalled();
		});

		it('listener throw does not break dispatch chain', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			const a = vi.fn(() => {
				throw new Error('boom');
			});
			const b = vi.fn();
			channel.on('message', a);
			channel.on('message', b);
			expect(() => {
				constructedSockets[0]!.dispatchEvent(new MessageEvent('message', { data: 'x' }));
			}).not.toThrow();
			expect(b).toHaveBeenCalled();
		});
	});

	describe('send()', () => {
		it('forwards send() call to underlying socket', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			channel.send('hello');
			expect(constructedSockets[0]!.send).toHaveBeenCalledWith('hello');
		});

		it('forwards ArrayBuffer payload', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			const buf = new ArrayBuffer(4);
			channel.send(buf);
			expect(constructedSockets[0]!.send).toHaveBeenCalledWith(buf);
		});
	});

	describe('close()', () => {
		it('forwards close() to underlying socket', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			channel.close();
			expect(constructedSockets[0]!.close).toHaveBeenCalledWith(undefined, undefined);
		});

		it('forwards code + reason', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			channel.close(1000, 'normal');
			expect(constructedSockets[0]!.close).toHaveBeenCalledWith(1000, 'normal');
		});
	});

	describe('readyState mapping', () => {
		it('CONNECTING (0) → "connecting"', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			constructedSockets[0]!.readyState = 0;
			expect(channel.readyState).toBe('connecting');
		});

		it('OPEN (1) → "open"', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			constructedSockets[0]!.readyState = 1;
			expect(channel.readyState).toBe('open');
		});

		it('CLOSING (2) → "closing"', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			constructedSockets[0]!.readyState = 2;
			expect(channel.readyState).toBe('closing');
		});

		it('CLOSED (3) → "closed"', () => {
			const channel = nativeWebSocketAdapter('wss://x');
			constructedSockets[0]!.readyState = 3;
			expect(channel.readyState).toBe('closed');
		});
	});
});
