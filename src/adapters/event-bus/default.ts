type AnyHandler = (data: any) => void;

/**
 * Typed event emitter. Both player classes extend this; plugins consume it
 * via `this.on` / `this.once` / `this.off` / `this.emit`, which delegate to
 * a player-scoped instance.
 *
 * Design choices:
 * - Plain `Map<event, Set<handler>>` over `EventTarget` for reliable removal:
 *   `Set.delete(fn)` works without matching options; `EventTarget.removeEventListener`
 *   needs the exact same function reference and doesn't compose with `once`.
 * - `once()` wraps the caller's handler so it self-removes after the first
 *   call. The wrapper is stored in a `WeakMap<userHandler, wrapper>` so
 *   `off(event, userHandler)` can locate and remove the wrapper even though the
 *   caller passes their original function reference.
 * - `emit()` snapshots the listener set before iterating, so a listener that
 *   calls `off()` mid-dispatch doesn't mutate the live iteration.
 * - `emit()` catches handler exceptions rather than letting one bad listener
 *   abort the dispatch chain. The `Plugin` base routes plugin-handler throws
 *   through the `plugin:handler-threw` error path; for raw consumer listeners
 *   the error surfaces to `console.error` so developers see it in dev tools.
 */
export class EventEmitter<E extends Record<string, any> = Record<string, any>> {
	/**
	 * Phantom type brand — never assigned at runtime. Exists solely so
	 * `PlayerEventMap<P>` can infer `E` from a plain `P extends EventEmitter<infer E>`
	 * check without being confused by the overloaded `on()` signatures.
	 */
	declare readonly __eventMap__: E;

	private readonly listeners = new Map<string, Set<AnyHandler>>();
	private readonly onceWrappers = new WeakMap<AnyHandler, AnyHandler>();
	private readonly _lcPending = new Set<string>();

	private _scheduleListenersChanged(name: string, _count: number): void {
		if (this._lcPending.has(name)) return;
		this._lcPending.add(name);
		queueMicrotask(() => {
			this._lcPending.delete(name);
			const current = this.listeners.get(name)?.size ?? 0;
			this.emit('listeners-changed', { name, count: current });
		});
	}

	/**
	 * Register `fn` to be called every time `event` is emitted.
	 *
	 * Registering the same function reference twice for the same event adds it
	 * only once — the underlying `Set` deduplicates. Registering for a
	 * previously empty event fires a microtask-delayed `listeners-changed`
	 * event so interested parties (e.g. lazy-load logic) can react.
	 *
	 * The string overload accepts any event name and is intended for dynamic
	 * event names inside plugin internals. Prefer the typed `K` overload in
	 * application code so TypeScript catches event-name typos.
	 */
	on<K extends keyof E>(_event: K, _fn: (data: E[K]) => void): void;
	on(_event: string, _fn: AnyHandler): void;
	on(event: any, fn: AnyHandler): void {
		const key = String(event);
		let set = this.listeners.get(key);
		if (!set) {
			set = new Set();
			this.listeners.set(key, set);
		}
		const wasEmpty = set.size === 0;
		set.add(fn);
		if (wasEmpty && key !== 'listeners-changed') this._scheduleListenersChanged(key, 1);
	}

	/**
	 * Register `fn` to be called the next time `event` is emitted, then
	 * automatically removed.
	 *
	 * `off(event, fn)` can still cancel the subscription before it fires —
	 * pass the same `fn` reference that was passed to `once()`.
	 */
	once<K extends keyof E>(_event: K, _fn: (data: E[K]) => void): void;
	once(_event: string, _fn: AnyHandler): void;
	once(event: any, fn: AnyHandler): void {
		const wrapper: AnyHandler = (data) => {
			this.off(event, fn);
			fn(data);
		};
		this.onceWrappers.set(fn, wrapper);
		this.on(event, wrapper);
	}

	/**
	 * Remove a listener (or all listeners for an event).
	 *
	 * - `off(event, fn)` — remove the specific function. Works for both `on`
	 *   and `once` registrations; pass the original handler reference in both
	 *   cases.
	 * - `off(event)` — remove all listeners for that event.
	 * - `off('all')` — remove every listener across all events. Used during
	 *   player disposal to prevent leaks.
	 */
	off<K extends keyof E>(_event: K, _fn?: (data: E[K]) => void): void;
	off(_event: 'all'): void;
	off(_event: string, _fn?: AnyHandler): void;
	off(event: any, fn?: AnyHandler): void {
		if (event === 'all') {
			this.listeners.clear();
			return;
		}

		const key = String(event);
		const set = this.listeners.get(key);
		if (!set)
			return;

		if (!fn) {
			const wasNonEmpty = set.size > 0;
			set.clear();
			this.listeners.delete(key);
			if (wasNonEmpty && key !== 'listeners-changed') this._scheduleListenersChanged(key, 0);
			return;
		}

		const sizeBefore = set.size;
		const wrapper = this.onceWrappers.get(fn);
		if (wrapper) {
			set.delete(wrapper);
			this.onceWrappers.delete(fn);
		}
		else {
			set.delete(fn);
		}

		if (set.size === 0) {
			this.listeners.delete(key);
			if (sizeBefore > 0 && key !== 'listeners-changed') this._scheduleListenersChanged(key, 0);
		}
	}

	/**
	 * Emit `event` with `data`, calling every registered listener in insertion
	 * order.
	 *
	 * Returns immediately if no listeners are registered. Exceptions thrown by
	 * individual listeners are caught and logged; the remaining listeners still
	 * run. The listener set is snapshotted before iteration, so `off()` calls
	 * inside a handler take effect on the next emit, not the current one.
	 */
	emit<K extends keyof E>(_event: K, _data?: E[K]): void;
	emit(_event: string, _data?: any): void;
	emit(event: any, data?: any): void {
		const key = String(event);
		const set = this.listeners.get(key);
		if (!set || set.size === 0)
			return;

		const snapshot = Array.from(set);
		for (const fn of snapshot) {
			try {
				fn(data);
			}
			catch (err) {
				// One bad listener must not abort the rest of the dispatch chain.
				// Plugin handlers get routed through plugin:handler-threw; raw
				// consumer listeners surface here so devs see the throw in dev tools.
				if (typeof console !== 'undefined' && console.error) {
					console.error(`[EventEmitter] listener for "${key}" threw:`, err);
				}
			}
		}
	}

	/**
	 * Returns `true` if at least one listener is registered for `event`.
	 *
	 * Useful before constructing an expensive payload that would be discarded if
	 * no one is listening.
	 */
	hasListeners<K extends keyof E>(_event: K): boolean;
	hasListeners(_event: string): boolean;
	hasListeners(event: any): boolean {
		const set = this.listeners.get(String(event));
		return !!set && set.size > 0;
	}

	/**
	 * Total live listener count across all events. Used by the leak harness in
	 * `testing/leak-harness.ts` to assert plugins don't leak handlers across
	 * use → dispose cycles.
	 */
	listenerCount(): number {
		let total = 0;
		for (const set of this.listeners.values()) total += set.size;
		return total;
	}

	/**
	 * Internal: snapshot of the listeners registered for `event`, in insertion
	 * order. Returns an empty array when no listeners are registered.
	 *
	 * Used by `Plugin.dispatchBefore` to iterate listeners with a
	 * `BeforeEvent` payload so `stopImmediatePropagation()` can break the chain.
	 * The standard `emit()` path is fire-and-forget and can't honour that
	 * semantic.
	 *
	 * Plugin authors: do not call this — use `on(event, fn)` to listen.
	 */
	listenersOf<K extends keyof E>(event: K): ReadonlyArray<(data: E[K]) => void>;
	listenersOf(event: string): ReadonlyArray<AnyHandler>;
	listenersOf(event: any): ReadonlyArray<AnyHandler> {
		const set = this.listeners.get(String(event));
		if (!set)
			return [];
		return Array.from(set);
	}
}
