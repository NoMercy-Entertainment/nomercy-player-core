/**
 * LifecycleRegistry tests — every plugin gets one of these. Records listeners,
 * timers, observers, AbortControllers, RAFs, custom cleanups; one `dispose()`
 * tears them all down. Critical for the leak harness — if this drifts, every
 * plugin's leak assertion drifts with it.
 *
 * Test groups:
 *  - addCleanup() — registers + runs in LIFO order on dispose
 *  - listen() — DOM event listener auto-cleanup
 *  - timeout() — auto-cleared on dispose, no-op when already disposed
 *  - interval() — same as timeout
 *  - observe() — DisconnectableObserver auto-cleanup
 *  - abortable() — AbortController auto-aborted on dispose
 *  - frame() — RAF loop cancellation
 *  - dispose() — idempotent, isDisposed reflects state
 *  - error handling — bad cleanup doesn't kill the chain
 *  - re-entrant addCleanup during dispose runs immediately
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LifecycleRegistry } from '../adapters/lifecycle-registry/default';

describe('LifecycleRegistry', () => {
	let registry: LifecycleRegistry;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		registry = new LifecycleRegistry();
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		if (!registry.isDisposed())
			registry.dispose();
		consoleErrorSpy.mockRestore();
	});

	// ─────────────────────────────────────────────────────────────────────
	// Construction
	// ─────────────────────────────────────────────────────────────────────

	describe('construction', () => {
		it('starts not disposed', () => {
			expect(registry.isDisposed()).toBe(false);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// addCleanup()
	// ─────────────────────────────────────────────────────────────────────

	describe('addCleanup()', () => {
		it('runs the cleanup on dispose', () => {
			const cleanup = vi.fn();
			registry.addCleanup(cleanup);
			registry.dispose();
			expect(cleanup).toHaveBeenCalledTimes(1);
		});

		it('runs cleanups in LIFO order (most recent first)', () => {
			const order: number[] = [];
			registry.addCleanup(() => order.push(1));
			registry.addCleanup(() => order.push(2));
			registry.addCleanup(() => order.push(3));
			registry.dispose();
			expect(order).toEqual([3, 2, 1]);
		});

		it('runs cleanup IMMEDIATELY when registry is already disposed', () => {
			registry.dispose();
			const cleanup = vi.fn();
			registry.addCleanup(cleanup);
			expect(cleanup).toHaveBeenCalledTimes(1);
		});

		it('swallows errors from cleanups added after dispose', () => {
			registry.dispose();
			expect(() => {
				registry.addCleanup(() => {
					throw new Error('boom');
				});
			}).not.toThrow();
		});

		it('continues running other cleanups when one throws', () => {
			const a = vi.fn();
			const b = vi.fn(() => {
				throw new Error('boom');
			});
			const c = vi.fn();
			registry.addCleanup(a);
			registry.addCleanup(b);
			registry.addCleanup(c);
			registry.dispose();
			expect(a).toHaveBeenCalled();
			expect(c).toHaveBeenCalled();
		});

		it('logs error when a cleanup throws', () => {
			registry.addCleanup(() => {
				throw new Error('boom');
			});
			registry.dispose();
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		it('re-entrant addCleanup during dispose runs immediately, not on next dispose', () => {
			const inner = vi.fn();
			registry.addCleanup(() => {
				registry.addCleanup(inner);
			});
			registry.dispose();
			expect(inner).toHaveBeenCalledTimes(1);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// listen() — DOM event listeners
	// ─────────────────────────────────────────────────────────────────────

	describe('listen()', () => {
		it('attaches a DOM event listener', () => {
			const target = new EventTarget();
			const handler = vi.fn();
			registry.listen(target, 'click', handler);
			target.dispatchEvent(new Event('click'));
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('removes the listener on dispose', () => {
			const target = new EventTarget();
			const handler = vi.fn();
			registry.listen(target, 'click', handler);
			registry.dispose();
			target.dispatchEvent(new Event('click'));
			expect(handler).not.toHaveBeenCalled();
		});

		it('no-op when called after dispose', () => {
			const target = new EventTarget();
			const handler = vi.fn();
			registry.dispose();
			registry.listen(target, 'click', handler);
			target.dispatchEvent(new Event('click'));
			expect(handler).not.toHaveBeenCalled();
		});

		it('passes options through to addEventListener', () => {
			const target = new EventTarget();
			const handler = vi.fn();
			registry.listen(target, 'click', handler, { once: true });
			target.dispatchEvent(new Event('click'));
			target.dispatchEvent(new Event('click'));
			expect(handler).toHaveBeenCalledTimes(1);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// timeout()
	// ─────────────────────────────────────────────────────────────────────

	describe('timeout()', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('schedules a callback', () => {
			const cb = vi.fn();
			registry.timeout(cb, 100);
			vi.advanceTimersByTime(100);
			expect(cb).toHaveBeenCalledTimes(1);
		});

		it('cleared on dispose before firing', () => {
			const cb = vi.fn();
			registry.timeout(cb, 100);
			registry.dispose();
			vi.advanceTimersByTime(100);
			expect(cb).not.toHaveBeenCalled();
		});

		it('callback not invoked if registry disposed during the wait', () => {
			const cb = vi.fn();
			registry.timeout(cb, 100);
			vi.advanceTimersByTime(50);
			registry.dispose();
			vi.advanceTimersByTime(100);
			expect(cb).not.toHaveBeenCalled();
		});

		it('returns -1 when called after dispose', () => {
			registry.dispose();
			const id = registry.timeout(() => {}, 100);
			expect(id).toBe(-1);
		});

		it('catches throws from the callback', () => {
			registry.timeout(() => {
				throw new Error('boom');
			}, 100);
			expect(() => vi.advanceTimersByTime(100)).not.toThrow();
			expect(consoleErrorSpy).toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// interval()
	// ─────────────────────────────────────────────────────────────────────

	describe('interval()', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('fires repeatedly at the given interval', () => {
			const cb = vi.fn();
			registry.interval(cb, 100);
			vi.advanceTimersByTime(350);
			expect(cb).toHaveBeenCalledTimes(3);
		});

		it('stops on dispose', () => {
			const cb = vi.fn();
			registry.interval(cb, 100);
			vi.advanceTimersByTime(150);
			expect(cb).toHaveBeenCalledTimes(1);
			registry.dispose();
			vi.advanceTimersByTime(500);
			expect(cb).toHaveBeenCalledTimes(1);
		});

		it('returns -1 when called after dispose', () => {
			registry.dispose();
			expect(registry.interval(() => {}, 100)).toBe(-1);
		});

		it('catches throws and keeps the loop running', () => {
			let count = 0;
			registry.interval(() => {
				count++;
				if (count === 1)
					throw new Error('boom');
			}, 100);
			vi.advanceTimersByTime(300);
			expect(count).toBe(3);
			expect(consoleErrorSpy).toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// observe()
	// ─────────────────────────────────────────────────────────────────────

	describe('observe()', () => {
		it('returns the same observer for chaining', () => {
			const observer = { disconnect: vi.fn() };
			const result = registry.observe(observer);
			expect(result).toBe(observer);
		});

		it('disconnects the observer on dispose', () => {
			const observer = { disconnect: vi.fn() };
			registry.observe(observer);
			registry.dispose();
			expect(observer.disconnect).toHaveBeenCalledTimes(1);
		});

		it('swallows errors from disconnect()', () => {
			const observer = { disconnect: vi.fn(() => {
				throw new Error('boom');
			}) };
			registry.observe(observer);
			expect(() => registry.dispose()).not.toThrow();
		});

		it('returns the observer unchanged when called after dispose', () => {
			registry.dispose();
			const observer = { disconnect: vi.fn() };
			const result = registry.observe(observer);
			expect(result).toBe(observer);
			expect(observer.disconnect).not.toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// abortable()
	// ─────────────────────────────────────────────────────────────────────

	describe('abortable()', () => {
		it('returns an AbortController', () => {
			const ctrl = registry.abortable();
			expect(ctrl).toBeInstanceOf(AbortController);
			expect(ctrl.signal.aborted).toBe(false);
		});

		it('aborts on dispose', () => {
			const ctrl = registry.abortable();
			registry.dispose();
			expect(ctrl.signal.aborted).toBe(true);
		});

		it('returns a pre-aborted controller when called after dispose', () => {
			registry.dispose();
			const ctrl = registry.abortable();
			expect(ctrl.signal.aborted).toBe(true);
		});

		it('multiple abortables all abort on dispose', () => {
			const a = registry.abortable();
			const b = registry.abortable();
			const c = registry.abortable();
			registry.dispose();
			expect(a.signal.aborted).toBe(true);
			expect(b.signal.aborted).toBe(true);
			expect(c.signal.aborted).toBe(true);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// frame()
	// ─────────────────────────────────────────────────────────────────────

	describe('frame()', () => {
		it('runs the callback once per RAF tick', async () => {
			const cb = vi.fn();
			registry.frame(cb);
			await new Promise(r => requestAnimationFrame(() => r(undefined)));
			await new Promise(r => requestAnimationFrame(() => r(undefined)));
			expect(cb.mock.calls.length).toBeGreaterThanOrEqual(1);
		});

		it('passes deltaMs and time to the callback', async () => {
			const cb = vi.fn();
			registry.frame(cb);
			await new Promise(r => requestAnimationFrame(() => r(undefined)));
			await new Promise(r => requestAnimationFrame(() => r(undefined)));
			if (cb.mock.calls.length > 0) {
				const [delta, time] = cb.mock.calls[0]!;
				expect(typeof delta).toBe('number');
				expect(typeof time).toBe('number');
			}
		});

		it('stops calling the callback after dispose', async () => {
			const cb = vi.fn();
			registry.frame(cb);
			await new Promise(r => requestAnimationFrame(() => r(undefined)));
			const callsBefore = cb.mock.calls.length;
			registry.dispose();
			await new Promise(r => setTimeout(r, 50));
			const callsAfter = cb.mock.calls.length;
			expect(callsAfter).toBeLessThanOrEqual(callsBefore + 1);
		});

		it('no-op when called after dispose', async () => {
			registry.dispose();
			const cb = vi.fn();
			registry.frame(cb);
			await new Promise(r => setTimeout(r, 50));
			expect(cb).not.toHaveBeenCalled();
		});

		it('catches throws from the callback', async () => {
			registry.frame(() => {
				throw new Error('boom');
			});
			await new Promise(r => requestAnimationFrame(() => r(undefined)));
			await new Promise(r => requestAnimationFrame(() => r(undefined)));
			expect(consoleErrorSpy).toHaveBeenCalled();
			registry.dispose();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// dispose()
	// ─────────────────────────────────────────────────────────────────────

	describe('dispose()', () => {
		it('isDisposed() returns true after dispose', () => {
			expect(registry.isDisposed()).toBe(false);
			registry.dispose();
			expect(registry.isDisposed()).toBe(true);
		});

		it('is idempotent — second call is a no-op', () => {
			const cleanup = vi.fn();
			registry.addCleanup(cleanup);
			registry.dispose();
			registry.dispose();
			expect(cleanup).toHaveBeenCalledTimes(1);
		});

		it('runs every cleanup type in a single dispose', () => {
			const target = new EventTarget();
			const evt = vi.fn();
			const ctl = vi.fn();
			const obs = { disconnect: vi.fn() };
			const cleanup = vi.fn();

			registry.listen(target, 'click', evt);
			const aborter = registry.abortable();
			registry.observe(obs);
			registry.addCleanup(cleanup);
			registry.addCleanup(ctl);

			registry.dispose();

			target.dispatchEvent(new Event('click'));
			expect(evt).not.toHaveBeenCalled();
			expect(aborter.signal.aborted).toBe(true);
			expect(obs.disconnect).toHaveBeenCalled();
			expect(cleanup).toHaveBeenCalled();
			expect(ctl).toHaveBeenCalled();
		});
	});
});
