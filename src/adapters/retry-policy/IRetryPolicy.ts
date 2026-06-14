// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

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
 * Map from error-code matcher to `RetryConfig`. Used as a reference table for
 * per-call retry configuration. Resolution order when looking up a code,
 * most specific wins:
 *
 *   1. Exact code:        `'core:auth/forbidden'`
 *   2. Category prefix:   `'core:auth/'`
 *   3. HTTP range:        `'4xx'` | `'5xx'`
 *   4. Wildcard fallback: `'*'`
 */
export type IRetryPolicy = Record<string, RetryConfig>;
