/**
 * Pluggable storage backend. Methods may return values directly or Promises so
 * that synchronous backends (localStorage) and asynchronous ones (IndexedDB,
 * remote API) share one interface. Plugin code always uses `await` regardless.
 *
 * Default: `LocalStorageBackend`. Swap via `setup({ storage })`.
 *
 * Kit-shipped backends:
 *  - `LocalStorageBackend` — default, sync, silently falls back to memory when blocked
 *  - `MemoryStorageBackend` — testing / SSR
 *  - `IndexedDBBackend` — opt-in for large values where the localStorage cap is too small
 *
 * Consumer-supplied: any class implementing this interface works, including an
 * API-backed remote store for cross-device persistence.
 */
export interface IStorage {
	/** Retrieve a raw string value, or `null` when the key is absent. */
	get(key: string): string | null | Promise<string | null>;

	/** Store a raw string value under `key`. */
	set(key: string, value: string): void | Promise<void>;

	/** Delete the entry for `key`. No-op when the key is absent. */
	remove(key: string): void | Promise<void>;

	/**
	 * Retrieve and JSON-parse the value stored under `key`. Returns `null` when
	 * the key is absent or the stored value is not valid JSON.
	 */
	getJSON<T>(key: string): T | null | Promise<T | null>;

	/** JSON-serialize `value` and store it under `key`. */
	setJSON<T>(key: string, value: T): void | Promise<void>;
}
