import { BrowserPolicyError } from './errors';

/**
 * Pluggable storage backend. Async-tolerant — methods may return values
 * directly OR Promises. Plugin code uses `await` regardless, so synchronous
 * backends (localStorage) and asynchronous ones (IndexedDB, remote API) share
 * one interface.
 *
 * Default: `LocalStorageBackend`. Swap via `setup({ storage })`.
 *
 * Kit-shipped backends:
 *  - `LocalStorageBackend` — default, sync, falls back to memory when blocked
 *  - `MemoryStorageBackend` — testing / SSR
 *  - `IndexedDBBackend` — opt-in subpath import for large values
 *
 * Consumer-supplied: any class implementing this interface, including
 * API-backed remote storage for cross-device persistence.
 */
export interface IStorage {
	get(key: string): string | null | Promise<string | null>;
	set(key: string, value: string): void | Promise<void>;
	remove(key: string): void | Promise<void>;
	getJSON<T>(key: string): T | null | Promise<T | null>;
	setJSON<T>(key: string, value: T): void | Promise<void>;
}

/**
 * Default localStorage-backed implementation. Defensive against environments
 * (Safari Private Mode historically, server-side rendering) where
 * `localStorage` exists but throws on access — degrades silently to in-memory
 * storage rather than crashing the player.
 *
 * Synchronous internally; satisfies the async-tolerant `IStorage` contract by
 * returning values directly (which `await` resolves immediately).
 */
export class LocalStorageBackend implements IStorage {
	private fallback = new Map<string, string>();
	private useFallback = false;

	constructor() {
		try {
			if (typeof localStorage === 'undefined') {
				this.useFallback = true;
			}
			else {
				const probeKey = '__nmplayer_probe__';
				localStorage.setItem(probeKey, '1');
				localStorage.removeItem(probeKey);
			}
		}
		catch {
			this.useFallback = true;
		}
	}

	get(key: string): string | null {
		if (this.useFallback)
			return this.fallback.get(key) ?? null;
		try {
			return localStorage.getItem(key);
		}
		catch {
			return this.fallback.get(key) ?? null;
		}
	}

	set(key: string, value: string): void {
		if (this.useFallback) {
			this.fallback.set(key, value);
			return;
		}
		try {
			localStorage.setItem(key, value);
		}
		catch {
			this.fallback.set(key, value);
		}
	}

	remove(key: string): void {
		if (this.useFallback) {
			this.fallback.delete(key);
			return;
		}
		try {
			localStorage.removeItem(key);
		}
		catch {
			this.fallback.delete(key);
		}
	}

	getJSON<T>(key: string): T | null {
		const raw = this.get(key);
		if (raw === null)
			return null;
		try {
			return JSON.parse(raw) as T;
		}
		catch {
			return null;
		}
	}

	setJSON<T>(key: string, value: T): void {
		try {
			this.set(key, JSON.stringify(value));
		}
		catch {
			// JSON.stringify can throw on circular references; swallow.
		}
	}
}

/**
 * In-memory backend. Useful for tests and SSR. Non-persistent across reloads.
 */
export class MemoryStorageBackend implements IStorage {
	private data = new Map<string, string>();

	get(key: string): string | null {
		return this.data.get(key) ?? null;
	}

	set(key: string, value: string): void {
		this.data.set(key, value);
	}

	remove(key: string): void {
		this.data.delete(key);
	}

	getJSON<T>(key: string): T | null {
		const raw = this.data.get(key);
		if (raw === undefined)
			return null;
		try {
			return JSON.parse(raw) as T;
		}
		catch {
			return null;
		}
	}

	setJSON<T>(key: string, value: T): void {
		try {
			this.data.set(key, JSON.stringify(value));
		}
		catch { /* circular */ }
	}
}

/**
 * IndexedDB-backed implementation. Opt-in — import via subpath. Fully async.
 * Suitable for large values (cached metadata, decoded buffers, offline caches)
 * where the 5-10MB localStorage cap is too small.
 *
 * Construction is cheap and lazy — the database is opened on first method
 * call so that test envs without `indexedDB` (Node, SSR, happy-dom) don't
 * crash when the class is merely instantiated. Methods reject with a
 * `BrowserPolicyError` (`core:policy/indexedDBUnsupported`) when the global
 * is missing.
 */
export class IndexedDBBackend implements IStorage {
	private readonly dbName: string;
	private readonly storeName: string;
	private readonly version: number;
	private dbPromise: Promise<IDBDatabase> | null = null;

	constructor(opts?: { dbName?: string; storeName?: string; version?: number }) {
		this.dbName = opts?.dbName ?? 'nomercy-player';
		this.storeName = opts?.storeName ?? 'kv';
		this.version = opts?.version ?? 1;
	}

	private unsupportedError(): BrowserPolicyError {
		return new BrowserPolicyError({
			code: 'core:policy/indexedDBUnsupported',
			severity: 'error',
			scope: { kind: 'core' },
			message: 'core:policy/indexedDBUnsupported: indexedDB is not available in this environment',
			context: {
				dbName: this.dbName,
				storeName: this.storeName,
			},
			suggestion: 'Use LocalStorageBackend or MemoryStorageBackend in environments without IndexedDB.',
		});
	}

	private openDb(): Promise<IDBDatabase> {
		if (this.dbPromise)
			return this.dbPromise;
		const idb: IDBFactory | undefined = (typeof indexedDB !== 'undefined' ? indexedDB : undefined);
		if (!idb)
			return Promise.reject(this.unsupportedError());
		this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
			const req = idb.open(this.dbName, this.version);
			req.onupgradeneeded = () => {
				const db = req.result;
				if (!db.objectStoreNames.contains(this.storeName)) {
					db.createObjectStore(this.storeName);
				}
			};
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
			req.onblocked = () => reject(new Error('indexedDB open blocked'));
		});
		// Reset cache on failure so next call retries.
		this.dbPromise.catch(() => {
			this.dbPromise = null;
		});
		return this.dbPromise;
	}

	private async withStore<R>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<R>): Promise<R> {
		const db = await this.openDb();
		return new Promise<R>((resolve, reject) => {
			const tx = db.transaction(this.storeName, mode);
			const store = tx.objectStore(this.storeName);
			const req = fn(store);
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'));
			tx.onabort = () => reject(tx.error ?? new Error('indexedDB transaction aborted'));
		});
	}

	async get(key: string): Promise<string | null> {
		const value = await this.withStore<unknown>('readonly', store => store.get(key));
		if (value === undefined || value === null)
			return null;
		return typeof value === 'string' ? value : String(value);
	}

	async set(key: string, value: string): Promise<void> {
		await this.withStore<IDBValidKey>('readwrite', store => store.put(value, key));
	}

	async remove(key: string): Promise<void> {
		await this.withStore<undefined>('readwrite', store => store.delete(key));
	}

	async getJSON<T>(key: string): Promise<T | null> {
		const raw = await this.get(key);
		if (raw === null)
			return null;
		try {
			return JSON.parse(raw) as T;
		}
		catch {
			return null;
		}
	}

	async setJSON<T>(key: string, value: T): Promise<void> {
		let serialized: string;
		try {
			serialized = JSON.stringify(value);
		}
		catch {
			// Circular references — swallow, mirroring the other backends.
			return;
		}
		await this.set(key, serialized);
	}
}
