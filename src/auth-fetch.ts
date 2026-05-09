import type { RetryConfig } from './errors';
import type { AuthConfig, AuthHeaderValue, IPlayer } from './types';
import { AuthError, NetworkError } from './errors';

/**
 * Auth-aware fetch shared by `Plugin.fetch()` and the player core's setup-time
 * playlist URL load.
 *
 * Behaviour:
 *  - Resolves auth (transformUrl, bearer, headers, credentials, signRequest)
 *  - 401 → calls `refreshOnUnauthenticated`, retries once with fresh auth
 *  - 403 → throws `AuthError(forbidden)` immediately, never refreshed, never retried
 *  - 5xx / timeout / network → retries per `RetryConfig` with backoff
 *  - Aborts cleanly when the caller's `AbortController` aborts
 *  - Emits `fetch:start` / `fetch:retry` / `fetch:complete` for observability
 *  - Optional parser transforms response text to a typed result
 */
export interface AuthFetchOptions<T> {
	url: string;
	auth?: AuthConfig;
	signal: AbortSignal;
	parser?: (raw: string) => T;
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
	 * their preferred scope via `Plugin.fetch(url, parser, { scope })`.
	 */
	scope?: 'plugin' | 'player' | 'silent';
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
	body?: BodyInit;
	timeoutMs?: number;
}

const DEFAULT_RETRY: RetryConfig = { attempts: 0 };

export async function authFetch<T = string>(opts: AuthFetchOptions<T>): Promise<T> {
	const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
	const rawEmit = opts.emit ?? (() => { /* no-op */ });
	const scope = opts.scope ?? (opts.pluginId ? 'plugin' : 'player');
	const eventName = (suffix: 'start' | 'retry' | 'complete'): string | null => {
		if (scope === 'silent')
			return null;
		if (scope === 'plugin' && opts.pluginId)
			return `plugin:${opts.pluginId}:fetch:${suffix}`;
		return `fetch:${suffix}`;
	};
	const dispatch = (suffix: 'start' | 'retry' | 'complete', data: unknown): void => {
		const name = eventName(suffix);
		if (name)
			rawEmit(name, data);
	};

	const retry = opts.retry ?? DEFAULT_RETRY;
	const maxAttempts = Math.max(1, retry.attempts + 1);
	const maxRefreshes = (opts.auth?.refreshOnUnauthenticated && (opts.auth.retryAfterRefresh ?? 1) > 0) ? 1 : 0;

	let attempt = 0;
	let refreshes = 0;
	let lastError: unknown;

	const url = await applyTransformUrl(opts.url, opts.auth);
	dispatch('start', {
		url,
		pluginId: opts.pluginId,
	});

	// Two independent budgets:
	//  - `attempt` consumes maxAttempts (5xx + network retries)
	//  - `refreshes` consumes maxRefreshes (401 → refresh + free retry)
	// Refresh-retry doesn't consume an attempt slot; the `attempt -= 1` after
	// refresh gives it back so the next iteration starts with a clean budget.
	while (true) {
		attempt += 1;

		const request = await buildRequest(url, opts);

		let response: Response;
		try {
			response = await Promise.race([
				fetch(request),
				timeoutPromise(opts.timeoutMs, opts.signal),
			]);
		}
		catch (cause) {
			lastError = cause;
			if (opts.signal.aborted) {
				throw new NetworkError({
					code: 'core:network/aborted',
					severity: 'info',
					scope: { kind: 'network' },
					message: 'fetch aborted',
					cause,
					context: { url },
				});
			}

			// Network-level error (DNS, CORS, offline)
			if (attempt < maxAttempts) {
				const delay = computeBackoff(retry, attempt);
				dispatch('retry', {
					url,
					attempt,
					reason: isTimeout(cause) ? 'timeout' : 'network',
					delayMs: delay,
					pluginId: opts.pluginId,
				});
				await sleep(delay, opts.signal);
				continue;
			}
			throw new NetworkError({
				code: isTimeout(cause) ? 'core:network/timeout' : 'core:network/offline',
				severity: 'error',
				scope: { kind: 'network' },
				message: isTimeout(cause) ? `fetch timed out after ${opts.timeoutMs}ms` : 'network error',
				cause,
				context: { url },
			});
		}

		// 401 — try refresh once (free retry, doesn't consume attempt budget)
		if (response.status === 401) {
			if (refreshes < maxRefreshes) {
				refreshes += 1;
				try {
					await opts.auth!.refreshOnUnauthenticated!();
				}
				catch (refreshErr) {
					dispatchComplete(dispatch, url, false, response.status, start, opts.pluginId);
					throw new AuthError({
						code: 'core:auth/refresh-failed',
						severity: 'error',
						scope: { kind: 'auth' },
						message: 'token refresh failed',
						cause: refreshErr,
						context: {
							url,
							httpStatus: 401,
						},
					});
				}
				dispatch('retry', {
					url,
					attempt,
					reason: 'unauthenticated',
					delayMs: 0,
					pluginId: opts.pluginId,
				});
				attempt -= 1; // refresh-retry is free; give the slot back
				continue;
			}
			dispatchComplete(dispatch, url, false, response.status, start, opts.pluginId);
			throw new AuthError({
				code: 'core:auth/unauthenticated',
				severity: 'error',
				scope: { kind: 'auth' },
				message: 'authentication required (401)',
				context: {
					url,
					httpStatus: 401,
				},
			});
		}

		// 403 — never retry, never refresh, propagate immediately
		if (response.status === 403) {
			dispatchComplete(dispatch, url, false, 403, start, opts.pluginId);
			throw new AuthError({
				code: 'core:auth/forbidden',
				severity: 'error',
				scope: { kind: 'auth' },
				message: 'forbidden (403) — authenticated but not authorized for this resource',
				context: {
					url,
					httpStatus: 403,
				},
			});
		}

		// Other 4xx — propagate, do not retry
		if (response.status >= 400 && response.status < 500) {
			dispatchComplete(dispatch, url, false, response.status, start, opts.pluginId);
			throw new NetworkError({
				code: codeFor4xx(response.status),
				severity: 'error',
				scope: { kind: 'network' },
				message: `HTTP ${response.status}`,
				context: {
					url,
					httpStatus: response.status,
				},
			});
		}

		// 5xx — retry per policy
		if (response.status >= 500) {
			lastError = new NetworkError({
				code: codeFor5xx(response.status),
				severity: 'error',
				scope: { kind: 'network' },
				message: `HTTP ${response.status}`,
				context: {
					url,
					httpStatus: response.status,
				},
			});

			if (attempt < maxAttempts) {
				const delay = computeBackoff(retry, attempt);
				dispatch('retry', {
					url,
					attempt,
					reason: 'http-5xx',
					delayMs: delay,
					pluginId: opts.pluginId,
				});
				await sleep(delay, opts.signal);
				continue;
			}
			dispatchComplete(dispatch, url, false, response.status, start, opts.pluginId);
			throw lastError;
		}

		// Success path
		dispatchComplete(dispatch, url, true, response.status, start, opts.pluginId);
		const text = await response.text();
		if (opts.parser) {
			try {
				return opts.parser(text);
			}
			catch (parseErr) {
				throw new NetworkError({
					code: 'core:network/parse-failed',
					severity: 'error',
					scope: { kind: 'network' },
					message: 'response parser threw',
					cause: parseErr,
					context: {
						url,
						httpStatus: response.status,
					},
				});
			}
		}
		return text as unknown as T;
	}

	// Should be unreachable — every path above either continues, returns, or throws.
	throw lastError ?? new NetworkError({
		code: 'core:network/timeout',
		severity: 'error',
		scope: { kind: 'network' },
		message: 'fetch retry budget exhausted',
		context: { url },
	});
}

// ─────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────

async function applyTransformUrl(url: string, auth?: AuthConfig): Promise<string> {
	if (!auth?.transformUrl)
		return url;
	return auth.transformUrl(url);
}

async function resolveHeader(value: AuthHeaderValue): Promise<string> {
	if (typeof value === 'string')
		return value;
	const result = value();
	return result instanceof Promise ? await result : result;
}

async function buildRequest<T>(url: string, opts: AuthFetchOptions<T>): Promise<Request> {
	const headers = new Headers();

	if (opts.auth?.bearerToken !== undefined) {
		const token = await resolveHeader(opts.auth.bearerToken);
		if (token)
			headers.set('Authorization', `Bearer ${token}`);
	}

	if (opts.auth?.headers) {
		for (const [name, value] of Object.entries(opts.auth.headers)) {
			const resolved = await resolveHeader(value);
			if (resolved)
				headers.set(name, resolved);
		}
	}

	const init: RequestInit = {
		method: opts.method ?? 'GET',
		headers,
		credentials: opts.auth?.credentials ?? 'same-origin',
		signal: opts.signal,
		body: opts.body,
	};

	let request = new Request(url, init);
	if (opts.auth?.signRequest) {
		const signed = opts.auth.signRequest(request);
		request = signed instanceof Promise ? await signed : signed;
	}

	return request;
}

function timeoutPromise(timeoutMs: number | undefined, signal: AbortSignal): Promise<never> {
	if (!timeoutMs || timeoutMs <= 0) {
		// Resolve never — Promise.race will be decided by fetch()
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

class TimeoutError extends Error {
	constructor(msg: string) {
		super(msg);
		this.name = 'TimeoutError';
	}
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

function computeBackoff(retry: RetryConfig, attempt: number): number {
	const base = retry.baseMs ?? 500;
	const max = retry.maxMs ?? 30_000;
	if (retry.backoff === 'exponential') {
		return Math.min(base * 2 ** (attempt - 1), max);
	}
	return Math.min(base * attempt, max);
}

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

function dispatchComplete(
	dispatch: (suffix: 'start' | 'retry' | 'complete', data: unknown) => void,
	url: string,
	ok: boolean,
	status: number | undefined,
	startTime: number,
	pluginId: string | undefined,
): void {
	const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
	dispatch('complete', {
		url,
		ok,
		status,
		durationMs: now - startTime,
		pluginId,
	});
}

/** Type guard helper exposed for player + plugin code that needs to inspect errors. */
export function isAuthError(err: unknown): err is AuthError {
	return err instanceof AuthError;
}

/** Type guard helper exposed for player + plugin code that needs to inspect errors. */
export function isNetworkError(err: unknown): err is NetworkError {
	return err instanceof NetworkError;
}

/** Re-export for consumers that want to construct their own player adapter. */
export type { IPlayer };
