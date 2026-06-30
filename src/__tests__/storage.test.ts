// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Storage backend tests — both the LocalStorage and Memory backends.
 *
 * The async-tolerant `IStorage` contract: methods may return value OR Promise;
 * test code uses `await` for both. LocalStorageBackend is synchronous
 * internally; MemoryStorageBackend is also synchronous; IndexedDBBackend (not
 * tested here, opt-in) is fully async.
 *
 * Test groups:
 *  - Construction
 *  - get / set / remove (string)
 *  - getJSON / setJSON
 *  - localStorage unavailable — falls back to in-memory
 *  - localStorage throws (quota / private mode) — falls back gracefully
 *  - JSON parse failure — returns null
 *  - JSON stringify failure (circular) — swallowed
 *  - MemoryStorageBackend isolation between instances
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexedDBBackend, LocalStorageBackend, MemoryStorageBackend } from '../adapters/storage';
import { BrowserPolicyError } from '../errors';

describe('LocalStorageBackend', () => {
	let backend: LocalStorageBackend;

	beforeEach(() => {
		localStorage.clear();
		backend = new LocalStorageBackend();
	});

	afterEach(() => {
		localStorage.clear();
	});

	describe('get / set / remove', () => {
		it('set then get returns the value', async () => {
			backend.set('key', 'value');
			expect(await backend.get('key')).toBe('value');
		});

		it('get returns null for missing key', async () => {
			expect(await backend.get('missing')).toBeNull();
		});

		it('remove deletes the key', async () => {
			backend.set('key', 'value');
			backend.remove('key');
			expect(await backend.get('key')).toBeNull();
		});

		it('overwrites an existing key', async () => {
			backend.set('key', 'a');
			backend.set('key', 'b');
			expect(await backend.get('key')).toBe('b');
		});
	});

	describe('getJSON / setJSON', () => {
		it('round-trips a plain object', async () => {
			backend.setJSON('config', { volume: 0.5, muted: true });
			expect(await backend.getJSON('config')).toEqual({ volume: 0.5, muted: true });
		});

		it('round-trips an array', async () => {
			backend.setJSON('list', [1, 2, 3]);
			expect(await backend.getJSON('list')).toEqual([1, 2, 3]);
		});

		it('returns null for missing key', async () => {
			expect(await backend.getJSON('missing')).toBeNull();
		});

		it('returns null when stored value is malformed JSON', async () => {
			backend.set('bad', 'not-json');
			expect(await backend.getJSON('bad')).toBeNull();
		});

		it('swallows circular reference errors in setJSON', () => {
			const obj: any = { a: 1 };
			obj.self = obj;
			expect(() => backend.setJSON('circular', obj)).not.toThrow();
		});
	});

	describe('localStorage unavailable / throwing', () => {
		it('falls back to in-memory when set throws (quota exceeded)', async () => {
			const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
				throw new Error('quota exceeded');
			});
			try {
				const fb = new LocalStorageBackend();
				fb.set('key', 'value');
				// in-memory fallback should still serve get
				const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
					throw new Error('still failing');
				});
				expect(await fb.get('key')).toBe('value');
				getItemSpy.mockRestore();
			}
			finally {
				setItemSpy.mockRestore();
			}
		});

		it('falls back to in-memory when get throws', async () => {
			backend.set('key', 'a');
			// happy-dom localStorage isn't overridable per-method (Proxy / readonly),
			// so swap the entire globalThis.localStorage with a throwing fake. The
			// LocalStorageBackend's `get()` re-reads the global identifier at call
			// time, so it'll see the throwing impl.
			const original = globalThis.localStorage;
			const throwing = {
				getItem: () => { throw new Error('private mode'); },
				setItem: () => {},
				removeItem: () => {},
				clear: () => {},
				key: () => null,
				length: 0,
			};
			Object.defineProperty(globalThis, 'localStorage', { value: throwing, configurable: true, writable: true });
			try {
				expect(await backend.get('key')).toBeNull();
			}
			finally {
				Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true, writable: true });
			}
		});
	});
});

describe('MemoryStorageBackend', () => {
	let backend: MemoryStorageBackend;

	beforeEach(() => {
		backend = new MemoryStorageBackend();
	});

	describe('get / set / remove', () => {
		it('set then get returns the value', async () => {
			backend.set('key', 'value');
			expect(await backend.get('key')).toBe('value');
		});

		it('get returns null for missing key', async () => {
			expect(await backend.get('missing')).toBeNull();
		});

		it('remove deletes the key', async () => {
			backend.set('key', 'value');
			backend.remove('key');
			expect(await backend.get('key')).toBeNull();
		});
	});

	describe('getJSON / setJSON', () => {
		it('round-trips an object', async () => {
			backend.setJSON('config', { a: 1 });
			expect(await backend.getJSON('config')).toEqual({ a: 1 });
		});

		it('returns null for missing key', async () => {
			expect(await backend.getJSON('missing')).toBeNull();
		});

		it('returns null when stored value is malformed JSON', async () => {
			backend.set('bad', 'not-json');
			expect(await backend.getJSON('bad')).toBeNull();
		});
	});

	describe('isolation', () => {
		it('two MemoryStorageBackend instances do not share state', async () => {
			const a = new MemoryStorageBackend();
			const b = new MemoryStorageBackend();
			a.set('shared', 'a-only');
			expect(await b.get('shared')).toBeNull();
		});

		it('does not persist across construction', async () => {
			backend.set('persist', 'value');
			const fresh = new MemoryStorageBackend();
			expect(await fresh.get('persist')).toBeNull();
		});
	});
});

describe('IndexedDBBackend', () => {
	// happy-dom doesn't ship indexedDB; the test env runs the unsupported path.
	// When indexedDB IS available (e.g. real browsers, fake-indexeddb), the
	// happy-path tests below activate.
	const hasIndexedDB = typeof indexedDB !== 'undefined';

	it('constructor is lazy and does not throw without indexedDB', () => {
		expect(() => new IndexedDBBackend()).not.toThrow();
		expect(() => new IndexedDBBackend({ dbName: 'd', storeName: 's', version: 2 })).not.toThrow();
	});

	if (!hasIndexedDB) {
		it('rejects with BrowserPolicyError when indexedDB is unavailable', async () => {
			const backend = new IndexedDBBackend();
			await expect(backend.get('k')).rejects.toBeInstanceOf(BrowserPolicyError);
			await expect(backend.set('k', 'v')).rejects.toBeInstanceOf(BrowserPolicyError);
			await expect(backend.remove('k')).rejects.toBeInstanceOf(BrowserPolicyError);
			await expect(backend.getJSON('k')).rejects.toBeInstanceOf(BrowserPolicyError);
			await expect(backend.setJSON('k', { a: 1 })).rejects.toBeInstanceOf(BrowserPolicyError);
		});

		it('uses the indexedDBUnsupported error code', async () => {
			const backend = new IndexedDBBackend();
			try {
				await backend.get('k');
				throw new Error('expected rejection');
			}
			catch (err) {
				expect(err).toBeInstanceOf(BrowserPolicyError);
				expect((err as BrowserPolicyError).code).toBe('core:policy/indexedDBUnsupported');
			}
		});
	}
	else {
		it('round-trips a string value', async () => {
			const backend = new IndexedDBBackend({ dbName: `t-${Date.now()}-${Math.random()}` });
			await backend.set('k', 'v');
			expect(await backend.get('k')).toBe('v');
			await backend.remove('k');
			expect(await backend.get('k')).toBeNull();
		});

		it('round-trips JSON', async () => {
			const backend = new IndexedDBBackend({ dbName: `t-${Date.now()}-${Math.random()}` });
			await backend.setJSON('cfg', { volume: 0.5 });
			expect(await backend.getJSON('cfg')).toEqual({ volume: 0.5 });
		});
	}
});
