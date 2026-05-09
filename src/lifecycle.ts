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
 *
 * Thread-safety: not relevant; all DOM/WebAPI work is on the main thread.
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
	 * Register an arbitrary cleanup callback. Used by Plugin.on() to remove
	 * player-event listeners on dispose (since those are in-memory, not on an
	 * EventTarget). Also available to consumers that need teardown logic
	 * scoped to the same lifecycle.
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

	observe<O extends DisconnectableObserver>(observer: O): O {
		if (this.disposed)
			return observer;
		this.observers.push(observer);
		return observer;
	}

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
	 * Auto-cancelled requestAnimationFrame loop. Stops cleanly on dispose. A
	 * single thrown frame is caught so it doesn't kill the loop or the player.
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
				// removeEventListener is spec'd not to throw, but be defensive
				// in case a custom EventTarget polyfill misbehaves.
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
				// AbortController.abort is spec'd not to throw, but be defensive.
			}
		}
		this.aborts.length = 0;

		// Run user-registered cleanups last, in reverse order — most recently
		// registered teardowns run first, like a stack.
		//
		// Snapshot before iterating: we already set `disposed = true` at the top
		// of dispose(), so any cleanup that calls `addCleanup()` re-entrantly
		// short-circuits and runs immediately instead of mutating this array.
		// We still snapshot defensively in case a future change relaxes that
		// guarantee, and we type-guard each entry rather than relying on `!`.
		const cleanups = this.cleanups.slice();
		this.cleanups.length = 0;
		for (let i = cleanups.length - 1; i >= 0; i--) {
			const fn = cleanups[i];
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

	isDisposed(): boolean {
		return this.disposed;
	}

	private logHandlerError(kind: string, err: unknown): void {
		if (typeof console !== 'undefined' && console.error) {
			console.error(`[LifecycleRegistry] ${kind} handler threw:`, err);
		}
	}
}
