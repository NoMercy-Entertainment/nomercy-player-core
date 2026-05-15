interface ListenerRecord {
	target: EventTarget;
	event: string;
	handler: EventListener;
	options?: AddEventListenerOptions | boolean;
}

interface DisconnectableObserver { disconnect(): void }

/**
 * Disposable registry — every plugin gets one of these. Records every
 * listener / timer / observer / abort controller / RAF that the plugin
 * registers, so a single `dispose()` call tears them all down. Plugin authors
 * never write manual teardown for these primitives — the registry guarantees
 * cleanup whether or not the plugin remembers.
 *
 * Idempotent: calling `dispose()` twice is safe; the second call is a no-op.
 */
export class LifecycleRegistry {
	private readonly listeners: ListenerRecord[] = [];
	private readonly timeouts = new Set<ReturnType<typeof setTimeout>>();
	private readonly intervals = new Set<ReturnType<typeof setInterval>>();
	private readonly observers: DisconnectableObserver[] = [];
	private readonly aborts: AbortController[] = [];
	private readonly rafs = new Set<number>();
	private readonly cleanups: Array<() => void> = [];
	private disposed = false;

	/**
	 * Register an arbitrary cleanup callback. Used by `Plugin.on()` to remove
	 * player-event listeners on dispose (those are in-memory, not on an
	 * `EventTarget`). Also available to plugins that need teardown logic scoped
	 * to this same lifecycle — e.g. removing a MutationObserver whose constructor
	 * reference is lost.
	 *
	 * If called after `dispose()`, the callback runs immediately so the caller
	 * does not need to guard against double-dispose.
	 */
	addCleanup(fn: () => void): void {
		if (this.disposed) {
			try {
				fn();
			}
			catch { /* swallow during double-dispose */ }
			return;
		}
		this.cleanups.push(fn);
	}

	/**
	 * Attach a DOM event listener and schedule its removal for `dispose()`. Drop-in
	 * replacement for `target.addEventListener` — same signature, same behaviour,
	 * automatic teardown.
	 *
	 * Silent no-op after `dispose()`.
	 */
	listen(target: EventTarget, event: string, handler: EventListener, options?: AddEventListenerOptions | boolean): void {
		if (this.disposed)
			return;
		target.addEventListener(event, handler, options);
		this.listeners.push({
			target,
			event,
			handler,
			options,
		});
	}

	/**
	 * Schedule a one-shot callback and auto-cancel it on `dispose()`. Wraps
	 * `setTimeout` — errors inside `fn` are caught and logged so they cannot kill
	 * the player.
	 *
	 * Returns the timer id (same shape as `setTimeout`). Returns `-1` after
	 * `dispose()`.
	 */
	timeout(fn: () => void, ms: number): number {
		if (this.disposed)
			return -1;
		const id = setTimeout(() => {
			this.timeouts.delete(id);
			if (this.disposed)
				return;
			try {
				fn();
			}
			catch (err) {
				this.logHandlerError('timeout', err);
			}
		}, ms);
		this.timeouts.add(id);
		return id as unknown as number;
	}

	/**
	 * Schedule a repeating callback and auto-cancel it on `dispose()`. Wraps
	 * `setInterval` — errors inside `fn` are caught per tick so a single failure
	 * does not stop the interval.
	 *
	 * Returns the interval id. Returns `-1` after `dispose()`.
	 */
	interval(fn: () => void, ms: number): number {
		if (this.disposed)
			return -1;
		const id = setInterval(() => {
			if (this.disposed)
				return;
			try {
				fn();
			}
			catch (err) {
				this.logHandlerError('interval', err);
			}
		}, ms);
		this.intervals.add(id);
		return id as unknown as number;
	}

	/**
	 * Register a `MutationObserver`, `ResizeObserver`, `IntersectionObserver`, or
	 * any object with a `disconnect()` method and auto-disconnect it on `dispose()`.
	 *
	 * Returns the observer unchanged so callers can chain:
	 * `this.lifecycle.observe(new ResizeObserver(cb)).observe(el)`.
	 *
	 * Silent no-op (still returns the observer) after `dispose()`.
	 */
	observe<O extends DisconnectableObserver>(observer: O): O {
		if (this.disposed)
			return observer;
		this.observers.push(observer);
		return observer;
	}

	/**
	 * Create an `AbortController` whose signal is cancelled when `dispose()` runs.
	 * Pass the returned controller's signal to `fetch`, `addEventListener`, or any
	 * other abort-aware API — the signal fires automatically on teardown.
	 *
	 * If called after `dispose()`, returns a pre-aborted controller.
	 */
	abortable(): AbortController {
		const ctrl = new AbortController();
		if (this.disposed) {
			ctrl.abort();
			return ctrl;
		}
		this.aborts.push(ctrl);
		return ctrl;
	}

	/**
	 * Start an auto-cancelled `requestAnimationFrame` loop. The callback receives
	 * `(deltaMs, now)` on each frame. A single thrown frame is caught and logged
	 * so it does not kill the loop or the player. The loop stops cleanly on
	 * `dispose()`.
	 *
	 * Silent no-op in environments without `requestAnimationFrame` (Node, SSR).
	 */
	frame(fn: (deltaMs: number, time: number) => void): void {
		if (this.disposed)
			return;
		if (typeof requestAnimationFrame === 'undefined')
			return;

		let lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

		const tick = (now: number): void => {
			if (this.disposed)
				return;
			const delta = now - lastTime;
			lastTime = now;
			try {
				fn(delta, now);
			}
			catch (err) {
				this.logHandlerError('frame', err);
			}
			if (!this.disposed) {
				const nextId = requestAnimationFrame(tick);
				this.rafs.add(nextId);
			}
		};

		const initialId = requestAnimationFrame(tick);
		this.rafs.add(initialId);
	}

	/**
	 * Tear down everything the registry tracks. Removes all listeners, cancels all
	 * timers and RAF loops, disconnects all observers, aborts all controllers, and
	 * runs user-registered cleanup callbacks in reverse registration order (most
	 * recently registered runs first, like a stack unwind).
	 *
	 * Safe to call multiple times — subsequent calls are no-ops.
	 */
	dispose(): void {
		if (this.disposed)
			return;
		this.disposed = true;

		for (const {
			target,
			event,
			handler,
			options,
		} of this.listeners) {
			try {
				target.removeEventListener(event, handler, options);
			}
			catch {
				// Defensive against custom EventTarget polyfills that misbehave.
			}
		}
		this.listeners.length = 0;

		for (const id of this.timeouts) clearTimeout(id);
		this.timeouts.clear();

		for (const id of this.intervals) clearInterval(id);
		this.intervals.clear();

		for (const id of this.rafs) {
			if (typeof cancelAnimationFrame !== 'undefined')
				cancelAnimationFrame(id);
		}
		this.rafs.clear();

		for (const observer of this.observers) {
			try {
				observer.disconnect();
			}
			catch {
				// Observers may have already been disconnected by other code paths.
			}
		}
		this.observers.length = 0;

		for (const ctrl of this.aborts) {
			try {
				ctrl.abort();
			}
			catch {
				// Defensive — abort should not throw, but guard anyway.
			}
		}
		this.aborts.length = 0;

		// Snapshot before iterating: `disposed = true` is already set, so any
		// re-entrant `addCleanup()` call runs immediately rather than mutating
		// this array mid-loop.
		const snapshot = this.cleanups.slice();
		this.cleanups.length = 0;
		for (let index = snapshot.length - 1; index >= 0; index--) {
			const fn = snapshot[index];
			if (typeof fn !== 'function')
				continue;
			try {
				fn();
			}
			catch (err) {
				this.logHandlerError('cleanup', err);
			}
		}
	}

	/** Whether `dispose()` has been called. Useful in plugin guards. */
	isDisposed(): boolean {
		return this.disposed;
	}

	private logHandlerError(kind: string, err: unknown): void {
		if (typeof console !== 'undefined' && console.error) {
			console.error(`[LifecycleRegistry] ${kind} handler threw:`, err);
		}
	}
}
