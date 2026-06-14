// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { IStorage } from './IStorage';

/**
 * In-memory backend. Values are lost on page reload. Use in tests and SSR
 * environments where localStorage and IndexedDB are unavailable.
 */
export class MemoryStorageBackend implements IStorage {
	private data = new Map<string, string>();

	/** Retrieve a raw string value, or `null` when the key is absent. */
	get(key: string): string | null {
		return this.data.get(key) ?? null;
	}

	/** Store a raw string value under `key`. */
	set(key: string, value: string): void {
		this.data.set(key, value);
	}

	/** Delete the entry for `key`. No-op when the key is absent. */
	remove(key: string): void {
		this.data.delete(key);
	}

	/**
	 * Retrieve and JSON-parse the value stored under `key`. Returns `null` when
	 * the key is absent or the stored value is not valid JSON.
	 */
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

	/** JSON-serialize `value` and store it under `key`. Silent on circular references. */
	setJSON<T>(key: string, value: T): void {
		try {
			this.data.set(key, JSON.stringify(value));
		}
		catch { /* circular reference — swallow, mirroring the other backends */ }
	}
}
