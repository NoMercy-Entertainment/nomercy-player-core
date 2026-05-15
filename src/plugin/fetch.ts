import type { RetryConfig } from '../errors';

/**
 * Options accepted by `Plugin.fetch<T>(url, options)`.
 * The discriminated `responseType` controls how the response body is decoded.
 * `pluginId` and `scope` are injected internally — plugin authors never set them.
 */
type FetchHttp = {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
	body?: BodyInit;
	headers?: Record<string, string>;
	timeoutMs?: number;
	retry?: RetryConfig;
	scope?: 'plugin' | 'player' | 'silent';
};

export type FetchOptions<T> =
	| (FetchHttp & { responseType?: 'text'; parser?: (raw: string) => T })
	| (FetchHttp & { responseType: 'json' })
	| (FetchHttp & { responseType: 'arrayBuffer' });
