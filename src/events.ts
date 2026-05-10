type AnyHandler = (data: any) => void;

/**
 * Typed event emitter. Both player classes extend this; plugins consume it
 * via `this.on/once/off/emit` (which delegate to a player-scoped instance).
 *
 * Implementation notes:
 * - Plain `Map<event, Set<handler>>` over `EventTarget` for clean removal
 *   semantics — Set.delete(fn) is reliable; EventTarget.removeEventListener
 *   needs the exact same function reference and doesn't compose with `once`.
 * - `once()` wraps the user's handler so it can self-remove. The wrapper is
 *   tracked in a `WeakMap<userHandler, wrapper>` so `off(event, userHandler)`
 *   can find and remove the wrapper even though the user passes their original
 *   function reference.
 * - `emit()` snapshots the listener set before iterating so a listener that
 *   calls `off()` during dispatch doesn't mutate the iteration set.
 * - `emit()` catches handler exceptions and routes to console.error in debug
 *   mode rather than letting one bad listener kill the dispatch. The full
 *   `plugin:handler-threw` flow lives in the Plugin base; the EventEmitter
 *   base just keeps the dispatch alive.
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

	private _scheduleListenersChanged(name: string, count: number): void {
		if (this._lcPending.has(name)) return;
		this._lcPending.add(name);
		queueMicrotask(() => {
			this._lcPending.delete(name);
			const current = this.listeners.get(name)?.size ?? 0;
			this.emit('listeners-changed', { name, count: current });
		});
	}

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

	emit<K extends keyof E>(_event: K, _data?: E[K]): void;
	emit(_event: string, _data?: any): void;
	emit(event: any, data?: any): void {
		const key = String(event);
		const set = this.listeners.get(key);
		if (!set || set.size === 0)
			return;

		// Snapshot to prevent mutation-during-iteration bugs when a listener
		// calls off() or registers another listener during dispatch.
		const snapshot = Array.from(set);
		for (const fn of snapshot) {
			try {
				fn(data);
			}
			catch (err) {
				// Don't let one bad listener kill the dispatch chain. The Plugin
				// base catches throws inside plugin handlers and routes them via
				// the plugin:handler-threw error path; for raw consumer listeners,
				// we surface to console so the dev sees the throw in dev tools.
				if (typeof console !== 'undefined' && console.error) {
					console.error(`[EventEmitter] listener for "${key}" threw:`, err);
				}
			}
		}
	}

	hasListeners<K extends keyof E>(_event: K): boolean;
	hasListeners(_event: string): boolean;
	hasListeners(event: any): boolean {
		const set = this.listeners.get(String(event));
		return !!set && set.size > 0;
	}

	/**
	 * Total live listener count across all events. Used by the leak harness in
	 * testing/leak-harness.ts to assert plugins don't leak handlers across
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
	 * Used by `Plugin.dispatchBefore` to iterate listeners directly with a
	 * `BeforeEvent` payload so `stopImmediatePropagation` can break the chain.
	 * The standard `emit()` path is fire-and-forget and can't honor that
	 * semantic.
	 *
	 * Plugin authors should NEVER call this — use `on(event, fn)` to listen.
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
