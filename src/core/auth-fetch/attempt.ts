// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { AttemptCtx, Outcome, RetryConfig } from './types';

import { decodeBody } from './decode';
import { buildRequest } from './prepare';

class TimeoutError extends Error {
	constructor(msg: string) {
		super(msg);
		this.name = 'TimeoutError';
	}
}

function timeoutPromise(timeoutMs: number | undefined, signal: AbortSignal): Promise<never> {
	if (!timeoutMs || timeoutMs <= 0) {
		return new Promise<never>(() => { /* never resolves */ });
	}
	return new Promise<never>((_resolve, reject) => {
		const id = setTimeout(() => {
			reject(new TimeoutError(`fetch exceeded ${timeoutMs}ms`));
		}, timeoutMs);
		signal.addEventListener('abort', () => clearTimeout(id), { once: true });
	});
}

function isTimeout(err: unknown): boolean {
	return err instanceof TimeoutError;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const id = setTimeout(resolve, ms);
		signal.addEventListener('abort', () => {
			clearTimeout(id);
			reject(new DOMException('aborted', 'AbortError'));
		}, { once: true });
	});
}

/**
 * Compute the wait time before the next retry. `attempt` is the 1-indexed
 * iteration number (1 = first retry after the initial fetch failed).
 *
 *  - Linear (default): `baseMs * attempt`, capped at `maxMs`.
 *    Example with defaults (500ms / 30s): 500, 1000, 1500, 2000, ...
 *  - Exponential:      `baseMs * 2^(attempt - 1)`, capped at `maxMs`.
 *    Example with defaults: 500, 1000, 2000, 4000, 8000, ...
 */
export function computeBackoff(retry: RetryConfig, attempt: number): number {
	const base = retry.baseMs ?? 500;
	const max = retry.maxMs ?? 30_000;
	if (retry.backoff === 'exponential') {
		return Math.min(base * 2 ** (attempt - 1), max);
	}
	return Math.min(base * attempt, max);
}

export { sleep };

function codeFor4xx(status: number): string {
	switch (status) {
		case 404: return 'core:network/not-found';
		case 408: return 'core:network/request-timeout';
		case 410: return 'core:network/gone';
		case 429: return 'core:network/rate-limited';
		default: return 'core:network/client-error';
	}
}

function codeFor5xx(status: number): string {
	switch (status) {
		case 500: return 'core:network/server-error';
		case 502: return 'core:network/bad-gateway';
		case 503: return 'core:network/service-unavailable';
		case 504: return 'core:network/gateway-timeout';
		default: return 'core:network/server-error-other';
	}
}

/**
 * Perform one attempt against the server and classify the result into an
 * `Outcome`. Knows nothing about retry orchestration — it just describes what
 * happened. The orchestrator decides whether to loop again.
 *
 * `attempt` is the 1-indexed iteration number, used only to compute backoff
 * for retry outcomes. 401-refresh paths use `delayMs: 0` regardless.
 *
 * Classification ladder:
 *  - fetch threw + signal aborted     → `'throw'` with `core:network/aborted`
 *  - fetch threw (timeout or network) → `'retry'` (stashes a terminal error on ctx)
 *  - 401 with refresh budget          → invoke refresh, return `'retry'` (free)
 *  - 401 without budget               → `'throw'` with `core:auth/unauthenticated`
 *  - 403                              → `'throw'` with `core:auth/forbidden`
 *  - other 4xx                        → `'throw'` with the matching network code
 *  - 5xx                              → `'retry'` (stashes terminal for budget exhaustion)
 *  - 2xx / 3xx                        → defer to `decodeBody`
 */
export async function attemptOnce<T>(ctx: AttemptCtx<T>, attempt: number): Promise<Outcome<T>> {
	const request = await buildRequest(ctx.url, ctx);

	let response: Response;
	try {
		response = await Promise.race([
			fetch(request),
			timeoutPromise(ctx.timeoutMs, ctx.signal),
		]);
	}
	catch (cause) {
		if (ctx.signal.aborted) {
			return {
				kind: 'throw',
				error: ctx.netErr('core:network/aborted', undefined, 'fetch aborted', cause, 'info'),
			};
		}

		const timedOut = isTimeout(cause);
		ctx.lastError = ctx.netErr(
			timedOut ? 'core:network/timeout' : 'core:network/offline',
			undefined,
			timedOut ? `fetch timed out after ${ctx.timeoutMs}ms` : 'network error',
			cause,
		);

		return {
			kind: 'retry',
			reason: timedOut ? 'timeout' : 'network',
			delayMs: computeBackoff(ctx.retry, attempt),
			consumesAttempt: true,
		};
	}

	ctx.lastStatus = response.status;

	if (response.status === 401) {
		if (ctx.refreshesUsed < ctx.maxRefreshes) {
			ctx.refreshesUsed += 1;
			try {
				await ctx.auth!.refreshOnUnauthenticated!();
			}
			catch (cause) {
				return {
					kind: 'throw',
					error: ctx.authErr('core:auth/refresh-failed', 401, 'token refresh failed', cause),
				};
			}

			return {
				kind: 'retry',
				reason: 'unauthenticated',
				delayMs: 0,
				consumesAttempt: false,
			};
		}

		return {
			kind: 'throw',
			error: ctx.authErr('core:auth/unauthenticated', 401, 'authentication required (401)'),
		};
	}

	if (response.status === 403) {
		return {
			kind: 'throw',
			error: ctx.authErr('core:auth/forbidden', 403, 'forbidden (403) — authenticated but not authorized for this resource'),
		};
	}

	if (response.status >= 400 && response.status < 500) {
		return {
			kind: 'throw',
			error: ctx.netErr(codeFor4xx(response.status), response.status, `HTTP ${response.status}`),
		};
	}

	if (response.status >= 500) {
		ctx.lastError = ctx.netErr(codeFor5xx(response.status), response.status, `HTTP ${response.status}`);

		return {
			kind: 'retry',
			reason: 'http-5xx',
			delayMs: computeBackoff(ctx.retry, attempt),
			consumesAttempt: true,
		};
	}

	return decodeBody<T>(response, ctx);
}
