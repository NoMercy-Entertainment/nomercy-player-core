import type { FetchOptions } from '../core/plugin';

/**
 * A mock fetch function compatible with `Plugin.fetch`. Install it on a plugin
 * instance in tests that need to assert on outgoing requests or return canned
 * responses without hitting the network.
 *
 * ```ts
 * const { fetch, calls, respondWith } = mockFetch();
 * plugin['fetch'] = fetch;          // override the plugin's fetch
 *
 * respondWith({ status: 200, body: '{}' });
 * await plugin.someMethodThatFetches();
 *
 * expect(calls[0].url).toBe('https://example.com/api');
 * ```
 */
export interface MockFetchCall {
	url: string;
	options: FetchOptions<unknown> | undefined;
}

export interface MockFetchResponse {
	body: unknown;
}

export interface MockFetch {
	/** Drop-in replacement for `Plugin.fetch`. Assign to `plugin['fetch']`. */
	fetch: <T = string>(url: string, options?: FetchOptions<T>) => Promise<T>;

	/** All calls made so far, in order. */
	calls: MockFetchCall[];

	/**
	 * Queue a response body for the next fetch call. Each queued value is
	 * consumed once in FIFO order. If no responses remain, the mock resolves
	 * with `undefined` cast to `T`.
	 */
	respondWith(body: unknown): void;

	/** Clear call history and queued responses. */
	reset(): void;
}

/**
 * Create a self-contained fetch mock for plugin unit tests.
 *
 * ```ts
 * import { mockFetch, createStubPlayer, describePlugin } from
 *   '@nomercy-entertainment/nomercy-player-core/testing';
 *
 * describePlugin(MyPlugin, ({ plugin }) => {
 *   it('fetches the manifest', async () => {
 *     const mock = mockFetch();
 *     plugin['fetch'] = mock.fetch;
 *     mock.respondWith({ tracks: [] });
 *     await plugin.loadManifest('https://cdn.example/m.json');
 *     expect(mock.calls[0].url).toBe('https://cdn.example/m.json');
 *   });
 * });
 * ```
 */
export function mockFetch(): MockFetch {
	const calls: MockFetchCall[] = [];
	const queue: unknown[] = [];

	const fetch = <T = string>(url: string, options?: FetchOptions<T>): Promise<T> => {
		calls.push({
			url,
			options: options as FetchOptions<unknown> | undefined,
		});
		const response = queue.length > 0 ? queue.shift() : undefined;
		return Promise.resolve(response as T);
	};

	return {
		fetch,
		calls,
		respondWith(body: unknown): void {
			queue.push(body);
		},
		reset(): void {
			calls.length = 0;
			queue.length = 0;
		},
	};
}
