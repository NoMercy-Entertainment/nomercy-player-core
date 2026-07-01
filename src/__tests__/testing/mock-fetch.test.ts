// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Tests for `mockFetch` — the fetch mock helper in the ./testing subpath export.
 *
 * Covers every exported function/method:
 *  - mockFetch() factory
 *  - fetch() — records calls, dequeues responses, resolves to undefined when empty
 *  - respondWith() — enqueues FIFO responses
 *  - reset() — clears calls + queue
 */

import { describe, expect, it } from 'vitest';
import { mockFetch } from '../../testing/mock-fetch';

describe('mockFetch', () => {
	describe('factory', () => {
		it('returns an object with fetch, calls, respondWith, and reset', () => {
			const mock = mockFetch();
			expect(typeof mock.fetch).toBe('function');
			expect(Array.isArray(mock.calls)).toBe(true);
			expect(typeof mock.respondWith).toBe('function');
			expect(typeof mock.reset).toBe('function');
		});

		it('starts with empty calls', () => {
			expect(mockFetch().calls).toHaveLength(0);
		});
	});

	describe('fetch()', () => {
		it('records the url in calls', async () => {
			const mock = mockFetch();
			await mock.fetch('https://example.com/api');
			expect(mock.calls[0]!.url).toBe('https://example.com/api');
		});

		it('records options in calls', async () => {
			const mock = mockFetch();
			const opts = { method: 'POST' as const };
			await mock.fetch('https://x', opts as any);
			expect(mock.calls[0]!.options).toBe(opts);
		});

		it('records options as undefined when omitted', async () => {
			const mock = mockFetch();
			await mock.fetch('https://x');
			expect(mock.calls[0]!.options).toBeUndefined();
		});

		it('resolves with the first queued response body', async () => {
			const mock = mockFetch();
			mock.respondWith({ tracks: [1, 2, 3] });
			const result = await mock.fetch<{ tracks: number[] }>('https://x');
			expect(result).toEqual({ tracks: [1, 2, 3] });
		});

		it('dequeues responses in FIFO order', async () => {
			const mock = mockFetch();
			mock.respondWith('first');
			mock.respondWith('second');
			const resultA = await mock.fetch<string>('https://a');
			const resultB = await mock.fetch<string>('https://b');
			expect(resultA).toBe('first');
			expect(resultB).toBe('second');
		});

		it('resolves with undefined when no response is queued', async () => {
			const mock = mockFetch();
			const result = await mock.fetch('https://empty');
			expect(result).toBeUndefined();
		});

		it('accumulates multiple calls', async () => {
			const mock = mockFetch();
			await mock.fetch('https://a');
			await mock.fetch('https://b');
			await mock.fetch('https://c');
			expect(mock.calls).toHaveLength(3);
			expect(mock.calls[2]!.url).toBe('https://c');
		});
	});

	describe('respondWith()', () => {
		it('enqueues a null body', async () => {
			const mock = mockFetch();
			mock.respondWith(null);
			const result = await mock.fetch('https://x');
			expect(result).toBeNull();
		});

		it('enqueues a string body', async () => {
			const mock = mockFetch();
			mock.respondWith('plain text');
			const result = await mock.fetch<string>('https://x');
			expect(result).toBe('plain text');
		});

		it('queues multiple responses that are consumed in order', async () => {
			const mock = mockFetch();
			mock.respondWith(1);
			mock.respondWith(2);
			mock.respondWith(3);
			const results: unknown[] = [];
			results.push(await mock.fetch('https://x'));
			results.push(await mock.fetch('https://x'));
			results.push(await mock.fetch('https://x'));
			expect(results).toEqual([1, 2, 3]);
		});
	});

	describe('reset()', () => {
		it('clears the call history', async () => {
			const mock = mockFetch();
			await mock.fetch('https://a');
			await mock.fetch('https://b');
			mock.reset();
			expect(mock.calls).toHaveLength(0);
		});

		it('clears queued responses so next fetch resolves undefined', async () => {
			const mock = mockFetch();
			mock.respondWith('queued');
			mock.reset();
			const result = await mock.fetch('https://x');
			expect(result).toBeUndefined();
		});

		it('allows re-use after reset', async () => {
			const mock = mockFetch();
			await mock.fetch('https://before');
			mock.reset();
			mock.respondWith('after-reset');
			const result = await mock.fetch<string>('https://after');
			expect(result).toBe('after-reset');
			expect(mock.calls).toHaveLength(1);
			expect(mock.calls[0]!.url).toBe('https://after');
		});
	});
});
