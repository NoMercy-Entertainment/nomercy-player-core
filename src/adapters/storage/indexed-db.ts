// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { IStorage } from './IStorage';

import { BrowserPolicyError } from '../../errors';

/**
 * IndexedDB-backed implementation. Fully async. Suitable for large values
 * (cached metadata, offline data) where the localStorage cap is too small.
 *
 * Construction is cheap and lazy — the database opens on first method call so
 * that environments without `indexedDB` (Node, SSR, happy-dom) do not crash
 * when the class is merely instantiated. Methods reject with a
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
		// Reset cache on failure so the next call retries the open.
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

	/** Retrieve a raw string value, or `null` when the key is absent. */
	async get(key: string): Promise<string | null> {
		const value = await this.withStore<unknown>('readonly', store => store.get(key));
		if (value === undefined || value === null)
			return null;
		return typeof value === 'string' ? value : String(value);
	}

	/** Store a raw string value under `key`. */
	async set(key: string, value: string): Promise<void> {
		await this.withStore<IDBValidKey>('readwrite', store => store.put(value, key));
	}

	/** Delete the entry for `key`. No-op when the key is absent. */
	async remove(key: string): Promise<void> {
		await this.withStore<undefined>('readwrite', store => store.delete(key));
	}

	/**
	 * Retrieve and JSON-parse the value stored under `key`. Returns `null` when
	 * the key is absent or the stored value is not valid JSON.
	 */
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

	/** JSON-serialize `value` and store it under `key`. Silent on circular references. */
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
