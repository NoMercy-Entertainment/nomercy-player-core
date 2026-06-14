// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { IStorage } from './IStorage';

/**
 * Default localStorage-backed implementation. Defensive against environments
 * where `localStorage` exists but throws on access (Safari Private Mode
 * historically; server-side rendering) — degrades silently to in-memory
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

	/** Retrieve a raw string value, or `null` when the key is absent. */
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

	/** Store a raw string value under `key`. Writes to the in-memory fallback on localStorage failure. */
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

	/** Delete the entry for `key`. No-op when the key is absent. */
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

	/**
	 * Retrieve and JSON-parse the value stored under `key`. Returns `null` when
	 * the key is absent or the stored value is not valid JSON.
	 */
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

	/** JSON-serialize `value` and store it under `key`. Silent on circular references. */
	setJSON<T>(key: string, value: T): void {
		try {
			this.set(key, JSON.stringify(value));
		}
		catch {
			// JSON.stringify throws on circular references — swallow, matching the other backends.
		}
	}
}
