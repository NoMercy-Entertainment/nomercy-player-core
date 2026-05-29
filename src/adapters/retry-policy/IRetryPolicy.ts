/**
 * Per-code retry behaviour. All fields except `attempts` are optional; omitting
 * `backoff` means no delay between retries (immediate). `refreshFirst: true`
 * runs the auth refresh flow before the first retry attempt — used for 401s.
 *
 * `attempts: 0` is the canonical "do not retry" value. The kit checks this before
 * scheduling any delay, so `baseMs` / `maxMs` are irrelevant when `attempts` is 0.
 */
export interface RetryConfig {
	attempts: number;
	backoff?: 'linear' | 'exponential';
	baseMs?: number;
	maxMs?: number;
	refreshFirst?: boolean;
}

/**
 * Map from error-code matcher to `RetryConfig`. The player and `authFetch` walk
 * this map on every error to find the most-specific matching rule. Resolution
 * order, most specific wins:
 *
 *   1. Exact code:        `'core:auth/forbidden'`
 *   2. Category prefix:   `'core:auth/'`
 *   3. HTTP range:        `'4xx'` | `'5xx'`
 *   4. Wildcard fallback: `'*'`
 *
 * Consumers pass a custom policy to `setup({ retryPolicy })` — it's merged over
 * `DEFAULT_RETRY_POLICY` so only the overridden codes need to appear.
 */
export type IRetryPolicy = Record<string, RetryConfig>;
