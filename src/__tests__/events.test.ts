/**
 * EventEmitter tests — exhaustive behavior lock for the event bus primitive.
 * Both player classes extend this; every plugin uses it via `this.on/emit`.
 *
 * Test groups:
 *  - on() — registration + duplicate detection (same fn = same set entry)
 *  - off() — single fn, all-of-event, all events ('all' magic)
 *  - once() — auto-remove after first dispatch + matching off() removes wrapper
 *  - emit() — fan-out, no-listener no-op, mutation-during-iteration safety
 *  - hasListeners() — presence check
 *  - listenerCount() — total across all events
 *  - error handling — bad listener doesn't kill dispatch
 *  - typed events — typed surface accepts known + unknown events
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../adapters/event-bus/default';

interface TestEvents {
	greet: { who: string };
	tick: { time: number };
	silence: void;
}

describe('EventEmitter', () => {
	let emitter: EventEmitter<TestEvents>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		emitter = new EventEmitter<TestEvents>();
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	// ─────────────────────────────────────────────────────────────────────
	// on()
	// ─────────────────────────────────────────────────────────────────────

	describe('on()', () => {
		it('registers a listener that receives emitted data', () => {
			const handler = vi.fn();
			emitter.on('greet', handler);
			emitter.emit('greet', { who: 'world' });
			expect(handler).toHaveBeenCalledWith({ who: 'world' });
		});

		it('registers multiple listeners on the same event', () => {
			const a = vi.fn();
			const b = vi.fn();
			emitter.on('greet', a);
			emitter.on('greet', b);
			emitter.emit('greet', { who: 'x' });
			expect(a).toHaveBeenCalledTimes(1);
			expect(b).toHaveBeenCalledTimes(1);
		});

		it('does NOT double-register the same fn (Set semantics)', () => {
			const handler = vi.fn();
			emitter.on('greet', handler);
			emitter.on('greet', handler);
			emitter.emit('greet', { who: 'x' });
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('listeners on different events are isolated', () => {
			const greetHandler = vi.fn();
			const tickHandler = vi.fn();
			emitter.on('greet', greetHandler);
			emitter.on('tick', tickHandler);
			emitter.emit('greet', { who: 'x' });
			expect(greetHandler).toHaveBeenCalled();
			expect(tickHandler).not.toHaveBeenCalled();
		});

		it('accepts arbitrary string events alongside the typed map', () => {
			const handler = vi.fn();
			emitter.on('custom-untyped-event', handler);
			emitter.emit('custom-untyped-event', { foo: 1 });
			expect(handler).toHaveBeenCalledWith({ foo: 1 });
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// off()
	// ─────────────────────────────────────────────────────────────────────

	describe('off()', () => {
		it('removes a specific listener', () => {
			const handler = vi.fn();
			emitter.on('greet', handler);
			emitter.off('greet', handler);
			emitter.emit('greet', { who: 'x' });
			expect(handler).not.toHaveBeenCalled();
		});

		it('removes only the matching listener (others remain)', () => {
			const a = vi.fn();
			const b = vi.fn();
			emitter.on('greet', a);
			emitter.on('greet', b);
			emitter.off('greet', a);
			emitter.emit('greet', { who: 'x' });
			expect(a).not.toHaveBeenCalled();
			expect(b).toHaveBeenCalled();
		});

		it('without fn argument, removes all listeners for the event', () => {
			const a = vi.fn();
			const b = vi.fn();
			emitter.on('greet', a);
			emitter.on('greet', b);
			emitter.off('greet');
			emitter.emit('greet', { who: 'x' });
			expect(a).not.toHaveBeenCalled();
			expect(b).not.toHaveBeenCalled();
		});

		it('off("all") clears every event registration', () => {
			const a = vi.fn();
			const b = vi.fn();
			emitter.on('greet', a);
			emitter.on('tick', b);
			emitter.off('all');
			emitter.emit('greet', { who: 'x' });
			emitter.emit('tick', { time: 1 });
			expect(a).not.toHaveBeenCalled();
			expect(b).not.toHaveBeenCalled();
		});

		it('no-op when removing from a non-existent event', () => {
			expect(() => emitter.off('greet', vi.fn())).not.toThrow();
		});

		it('no-op when removing a fn that was never registered', () => {
			emitter.on('greet', vi.fn());
			expect(() => emitter.off('greet', vi.fn())).not.toThrow();
		});

		it('cleans up the internal Map entry when last listener for an event is removed', () => {
			const handler = vi.fn();
			emitter.on('greet', handler);
			expect(emitter.hasListeners('greet')).toBe(true);
			emitter.off('greet', handler);
			expect(emitter.hasListeners('greet')).toBe(false);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// once()
	// ─────────────────────────────────────────────────────────────────────

	describe('once()', () => {
		it('fires the handler exactly once', () => {
			const handler = vi.fn();
			emitter.once('greet', handler);
			emitter.emit('greet', { who: 'x' });
			emitter.emit('greet', { who: 'y' });
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('passes the emitted data to the handler', () => {
			const handler = vi.fn();
			emitter.once('greet', handler);
			emitter.emit('greet', { who: 'world' });
			expect(handler).toHaveBeenCalledWith({ who: 'world' });
		});

		it('off() with the original handler removes the once-wrapper', () => {
			const handler = vi.fn();
			emitter.once('greet', handler);
			emitter.off('greet', handler);
			emitter.emit('greet', { who: 'x' });
			expect(handler).not.toHaveBeenCalled();
		});

		it('hasListeners() is true after once() until first dispatch', () => {
			emitter.once('greet', vi.fn());
			expect(emitter.hasListeners('greet')).toBe(true);
		});

		it('hasListeners() is false after the once handler fires', () => {
			emitter.once('greet', vi.fn());
			emitter.emit('greet', { who: 'x' });
			expect(emitter.hasListeners('greet')).toBe(false);
		});

		it('multiple once handlers on same event all fire on first emit', () => {
			const a = vi.fn();
			const b = vi.fn();
			emitter.once('greet', a);
			emitter.once('greet', b);
			emitter.emit('greet', { who: 'x' });
			expect(a).toHaveBeenCalledTimes(1);
			expect(b).toHaveBeenCalledTimes(1);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// emit()
	// ─────────────────────────────────────────────────────────────────────

	describe('emit()', () => {
		it('no-op when no listeners are registered', () => {
			expect(() => emitter.emit('greet', { who: 'x' })).not.toThrow();
		});

		it('void-payload events fire correctly', () => {
			const handler = vi.fn();
			emitter.on('silence', handler);
			emitter.emit('silence');
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('listener registering another listener during dispatch does NOT receive current emit', () => {
			const lateHandler = vi.fn();
			emitter.on('tick', () => emitter.on('tick', lateHandler));
			emitter.emit('tick', { time: 1 });
			expect(lateHandler).not.toHaveBeenCalled(); // snapshot semantics
			emitter.emit('tick', { time: 2 });
			expect(lateHandler).toHaveBeenCalledWith({ time: 2 });
		});

		it('listener removing itself during dispatch still gets called this iteration', () => {
			const handler = vi.fn(() => emitter.off('tick', handler));
			emitter.on('tick', handler);
			emitter.emit('tick', { time: 1 });
			expect(handler).toHaveBeenCalledTimes(1);
			emitter.emit('tick', { time: 2 });
			expect(handler).toHaveBeenCalledTimes(1); // only the first
		});

		it('listener removing another listener during dispatch may or may not affect that listener', () => {
			const b = vi.fn();
			const a = vi.fn(() => emitter.off('tick', b));
			emitter.on('tick', a);
			emitter.on('tick', b);
			emitter.emit('tick', { time: 1 });
			expect(a).toHaveBeenCalledTimes(1);
			// Snapshot is taken before iteration; b is still in the snapshot
			expect(b).toHaveBeenCalledTimes(1);
			// Second emit: b is gone
			emitter.emit('tick', { time: 2 });
			expect(b).toHaveBeenCalledTimes(1);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Error handling
	// ─────────────────────────────────────────────────────────────────────

	describe('error handling during dispatch', () => {
		it('catches a throw from one listener and continues to the next', () => {
			const a = vi.fn(() => {
				throw new Error('boom');
			});
			const b = vi.fn();
			emitter.on('greet', a);
			emitter.on('greet', b);
			emitter.emit('greet', { who: 'x' });
			expect(a).toHaveBeenCalled();
			expect(b).toHaveBeenCalled();
		});

		it('logs the error to console.error', () => {
			emitter.on('greet', () => {
				throw new Error('boom');
			});
			emitter.emit('greet', { who: 'x' });
			expect(consoleErrorSpy).toHaveBeenCalled();
			const args = consoleErrorSpy.mock.calls[0]!;
			expect(args[0]).toContain('[EventEmitter]');
			expect(args[0]).toContain('"greet"');
		});

		it('does NOT re-throw — emit() always returns normally', () => {
			emitter.on('greet', () => {
				throw new Error('boom');
			});
			expect(() => emitter.emit('greet', { who: 'x' })).not.toThrow();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// hasListeners()
	// ─────────────────────────────────────────────────────────────────────

	describe('hasListeners()', () => {
		it('returns false for an event with no listeners', () => {
			expect(emitter.hasListeners('greet')).toBe(false);
		});

		it('returns true after a listener is registered', () => {
			emitter.on('greet', vi.fn());
			expect(emitter.hasListeners('greet')).toBe(true);
		});

		it('returns false after the only listener is removed', () => {
			const handler = vi.fn();
			emitter.on('greet', handler);
			emitter.off('greet', handler);
			expect(emitter.hasListeners('greet')).toBe(false);
		});

		it('isolated per event', () => {
			emitter.on('greet', vi.fn());
			expect(emitter.hasListeners('greet')).toBe(true);
			expect(emitter.hasListeners('tick')).toBe(false);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// listenerCount()
	// ─────────────────────────────────────────────────────────────────────

	describe('listenerCount()', () => {
		it('returns 0 when no listeners are registered', () => {
			expect(emitter.listenerCount()).toBe(0);
		});

		it('counts all listeners across all events', () => {
			emitter.on('greet', vi.fn());
			emitter.on('greet', vi.fn());
			emitter.on('tick', vi.fn());
			expect(emitter.listenerCount()).toBe(3);
		});

		it('decreases when listeners are removed', () => {
			const handler = vi.fn();
			emitter.on('greet', handler);
			emitter.on('tick', vi.fn());
			expect(emitter.listenerCount()).toBe(2);
			emitter.off('greet', handler);
			expect(emitter.listenerCount()).toBe(1);
		});

		it('drops to 0 after off("all")', () => {
			emitter.on('greet', vi.fn());
			emitter.on('tick', vi.fn());
			emitter.off('all');
			expect(emitter.listenerCount()).toBe(0);
		});

		it('once() listener counts toward total before firing, not after', () => {
			emitter.once('greet', vi.fn());
			expect(emitter.listenerCount()).toBe(1);
			emitter.emit('greet', { who: 'x' });
			expect(emitter.listenerCount()).toBe(0);
		});
	});
});
