// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { AuthError, NetworkError, RetryConfig } from '../../errors';
import type { AuthConfig, AuthHeaderValue } from '../../types';

/**
 * Common fields shared by every fetch call. The `responseType` discriminator
 * lives on the `AuthFetchOptions` union below; this base is everything that's
 * unaffected by how the response body is decoded.
 */
export interface AuthFetchBase {
	url: string;
	auth?: AuthConfig;
	signal: AbortSignal;
	retry?: RetryConfig;
	/**
	 * Untyped emit — receives event names that may be plugin-scoped
	 * (`plugin:<id>:fetch:*`) or player-global (`fetch:*`) depending on
	 * `scope`. Caller passes the player's emit; routing decided here.
	 */
	emit?: (event: string, data: unknown) => void;
	pluginId?: string;
	/**
	 * Event scoping:
	 *  - `'plugin'` — emits `plugin:<pluginId>:fetch:*` only
	 *  - `'player'` — emits `fetch:*` on the player-global bus
	 *  - `'silent'` — emits nothing
	 *
	 * Default: `'player'` for kit-internal calls (no `pluginId`); plugins pass
	 * their preferred scope via `Plugin.fetch(url, { scope })`.
	 */
	scope?: 'plugin' | 'player' | 'silent';
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
	body?: BodyInit;
	/**
	 * Per-request headers, merged on top of `auth.headers` (per-request wins on
	 * collision). The `Authorization` header is still set from `auth.bearerToken`
	 * unless overridden here.
	 */
	headers?: Record<string, string>;
	timeoutMs?: number;
}

/**
 * Full options accepted by `authFetch`. `responseType` discriminates how the
 * response body is decoded:
 *  - `'text'` (default) — returns the raw response string. Optional `parser`
 *    callback transforms it; a thrown parser surfaces as `core:network/parse-failed`.
 *  - `'json'`           — `response.json()`. Invalid JSON throws `core:network/parse-failed`.
 *  - `'arrayBuffer'`    — `response.arrayBuffer()` for binary payloads.
 */
export type AuthFetchOptions<T> = AuthFetchBase & (
	| { responseType?: 'text'; parser?: (raw: string) => T }
	| { responseType: 'json' }
	| { responseType: 'arrayBuffer' }
);

/**
 * Result of a single attempt. The orchestrator branches on `kind`:
 *  - `'value'` — success; return the decoded body to the caller.
 *  - `'throw'` — terminal error; abort the loop and rethrow.
 *  - `'retry'` — recoverable; sleep `delayMs` and try again.
 *
 * Only `'retry'` outcomes carry a `consumesAttempt` flag: `true` for 5xx /
 * network / timeout (normal retry, eats one attempt slot), `false` for the
 * 401-refresh path (free retry, counted against `maxRefreshes` instead).
 */
export type Outcome<T>
	= | { kind: 'value'; value: T }
		| { kind: 'throw'; error: NetworkError | AuthError }
		| {
			kind: 'retry';
			reason: 'network' | 'timeout' | 'http-5xx' | 'unauthenticated';
			delayMs: number;
			consumesAttempt: boolean;
		};

/**
 * Per-call context shared across the three layers. Built once by
 * `prepareAttempt`, then read (and lightly written for budget tracking) by
 * `attemptOnce` and the orchestrator.
 *
 * Mutable fields (`lastStatus`, `lastError`, `refreshesUsed`) track state that
 * crosses attempt boundaries:
 *  - `lastStatus` — most recent HTTP status, used in completion telemetry.
 *  - `lastError`  — last 5xx / network error, surfaced if the retry budget runs
 *                    out without a successful attempt.
 *  - `refreshesUsed` — how many 401-refresh retries have fired; capped by `maxRefreshes`.
 *
 * Closure factories (`authErr`, `netErr`, `dispatch`, `complete`) capture `url`
 * and other immutables so call sites stay short.
 */
export interface AttemptCtx<T> {
	url: string;
	signal: AbortSignal;
	auth: AuthConfig | undefined;
	pluginId: string | undefined;
	timeoutMs: number | undefined;
	maxAttempts: number;
	maxRefreshes: number;
	responseType: 'text' | 'json' | 'arrayBuffer' | undefined;
	parser: ((raw: string) => T) | undefined;
	retry: RetryConfig;

	dispatch: (suffix: 'start' | 'retry' | 'complete', data: unknown) => void;
	complete: (ok: boolean, status: number | undefined) => void;
	authErr: (code: string, status: number | undefined, message: string, cause?: unknown) => AuthError;
	netErr: (code: string, status: number | undefined, message: string, cause?: unknown, severity?: 'fatal' | 'error' | 'warning' | 'info') => NetworkError;

	lastStatus: number | undefined;
	lastError: NetworkError | undefined;
	refreshesUsed: number;

	// Forwarded for buildRequest
	method: AuthFetchBase['method'];
	body: AuthFetchBase['body'];
	headers: AuthFetchBase['headers'];
}

export type { AuthConfig, AuthHeaderValue, RetryConfig };
