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
export type RetryPolicy = Record<string, RetryConfig>;

/**
 * Built-in retry defaults. Covers the common HTTP + media error codes out of the
 * box. Consumers override individual entries via `setup({ retryPolicy })`.
 * All defaults err on the side of fewer retries — noisy retries are worse than
 * a fast failure for debugging.
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
	'core:network/timeout': {
		attempts: 5,
		backoff: 'exponential',
		baseMs: 500,
		maxMs: 30_000,
	},
	'core:network/server-error': {
		attempts: 3,
		backoff: 'exponential',
		baseMs: 500,
		maxMs: 10_000,
	},
	'core:stream/fragment-failed': {
		attempts: 5,
		backoff: 'linear',
		baseMs: 200,
		maxMs: 5_000,
	},
	'core:auth/unauthenticated': {
		attempts: 1,
		refreshFirst: true,
	},
	'core:auth/forbidden': { attempts: 0 },
	'core:media/codec-unsupported': { attempts: 0 },
	// aborted: user or browser aborted the resource fetch — no retry.
	'media/aborted': { attempts: 0 },
	// network: fetch failed mid-stream — retry with back-off.
	'media/network': {
		attempts: 3,
		backoff: 'exponential',
		baseMs: 1_000,
		maxMs: 8_000,
	},
	// decode error on the current rendition — try next rendition, no generic retry.
	'media/decode-fatal-variant': { attempts: 0 },
	// decode error across all renditions / format unsupported — no recovery.
	'media/decode-fatal-all': { attempts: 0 },
	'core:state/queue-empty': { attempts: 0 },
	'4xx': { attempts: 0 },
	'5xx': {
		attempts: 3,
		backoff: 'exponential',
		baseMs: 500,
		maxMs: 10_000,
	},
	'*': { attempts: 0 },
};
