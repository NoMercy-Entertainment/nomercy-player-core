// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { IRetryPolicy } from './IRetryPolicy';

export type { IRetryPolicy, RetryConfig } from './IRetryPolicy';

/**
 * Built-in retry defaults. Covers the common HTTP + media error codes out of the
 * box. Pass entries from this map to per-call `retry` options on `Plugin.fetch()`
 * to override the default for a specific call site.
 * All defaults err on the side of fewer retries — noisy retries are worse than
 * a fast failure for debugging.
 */
export const DEFAULT_RETRY_POLICY: IRetryPolicy = {
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
	'media/aborted': { attempts: 0 },
	'media/network': {
		attempts: 3,
		backoff: 'exponential',
		baseMs: 1_000,
		maxMs: 8_000,
	},
	'media/decode-fatal-variant': { attempts: 0 },
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
