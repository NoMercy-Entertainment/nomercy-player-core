import type { RetryConfig } from './errors';
import type { AuthConfig, AuthHeaderValue, IPlayer } from './types';
import { AuthError, NetworkError } from './errors';

/**
 * Auth-aware fetch shared by `Plugin.fetch()` and the player core's setup-time
 * playlist URL load.
 *
 * Implementation lives in three layers further down:
 *  - `prepareAttempt`  — builds a per-call context bag (closures, factories, budgets).
 *  - `attemptOnce`     — one fetch + classify + decode pass, returns an `Outcome`.
 *  - `authFetch`       — bounded retry orchestrator that consumes outcomes.
 *
 * Public entry point is `authFetch` near the bottom of the file.
 */

/**
 * Common fields shared by every fetch call. The `responseType` discriminator
 * lives on the `AuthFetchOptions` union below; this base is everything that's
 * unaffected by how the response body is decoded.
 */
interface AuthFetchBase {
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


// ─────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────

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
type Outcome<T> =
	| { kind: 'value'; value: T }
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
interface AttemptCtx<T> {
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


// ─────────────────────────────────────────────────────────────────────────
// Layer 1 — context bag built once per call
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_RETRY: RetryConfig = { attempts: 0 };

/**
 * Build the per-call context. Runs once at the start of every `authFetch`.
 *
 * Captures URL (post `auth.transformUrl`), event-scope routing, error/dispatch
 * closures, and retry budgets. The returned context object is the only thing
 * `attemptOnce` and the orchestrator need.
 *
 * Async because `auth.transformUrl` may return a Promise (consumer might
 * resolve a signed URL via fetch / IndexedDB / native bridge).
 */
async function prepareAttempt<T>(opts: AuthFetchOptions<T>): Promise<AttemptCtx<T>> {
	const url = await applyTransformUrl(opts.url, opts.auth);

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

	const complete = (ok: boolean, status: number | undefined): void => {
		const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
		dispatch('complete', {
			url,
			ok,
			status,
			durationMs: now - start,
			pluginId: opts.pluginId,
		});
	};

	const authErr = (code: string, status: number | undefined, message: string, cause?: unknown): AuthError =>
		new AuthError({
			code,
			severity: 'error',
			scope: { kind: 'auth' },
			message,
			cause,
			context: {
				url,
				httpStatus: status,
			},
		});

	const netErr = (code: string, status: number | undefined, message: string, cause?: unknown, severity: 'fatal' | 'error' | 'warning' | 'info' = 'error'): NetworkError =>
		new NetworkError({
			code,
			severity,
			scope: { kind: 'network' },
			message,
			cause,
			context: {
				url,
				httpStatus: status,
			},
		});

	const retry = opts.retry ?? DEFAULT_RETRY;
	const maxAttempts = Math.max(1, retry.attempts + 1);
	const maxRefreshes = (opts.auth?.refreshOnUnauthenticated && (opts.auth.retryAfterRefresh ?? 1) > 0) ? 1 : 0;

	const responseType = opts.responseType;
	const parser = (opts as AuthFetchBase & { parser?: (raw: string) => T }).parser;

	return {
		url,
		signal: opts.signal,
		auth: opts.auth,
		pluginId: opts.pluginId,
		timeoutMs: opts.timeoutMs,
		maxAttempts,
		maxRefreshes,
		responseType,
		parser,
		retry,
		dispatch,
		complete,
		authErr,
		netErr,
		lastStatus: undefined,
		lastError: undefined,
		refreshesUsed: 0,
		method: opts.method,
		body: opts.body,
		headers: opts.headers,
	};
}


// ─────────────────────────────────────────────────────────────────────────
// Layer 2 — single fetch + classify + decode
// ─────────────────────────────────────────────────────────────────────────

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
async function attemptOnce<T>(ctx: AttemptCtx<T>, attempt: number): Promise<Outcome<T>> {
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

/**
 * Decode a successful response body per `ctx.responseType`. Returns a `'value'`
 * outcome on success, or a `'throw'` outcome wrapping the parse failure.
 *
 * `'text'` is the default; an optional `ctx.parser` post-processes the string
 * (e.g. JSON.parse, custom format). Parser exceptions and malformed JSON both
 * surface as `core:network/parse-failed` so consumers can catch the class.
 */
async function decodeBody<T>(response: Response, ctx: AttemptCtx<T>): Promise<Outcome<T>> {
	if (ctx.responseType === 'arrayBuffer') {
		const buffer = await response.arrayBuffer();
		return { kind: 'value', value: buffer as unknown as T };
	}

	if (ctx.responseType === 'json') {
		try {
			const parsed = await response.json() as T;
			return { kind: 'value', value: parsed };
		}
		catch (parseErr) {
			return {
				kind: 'throw',
				error: ctx.netErr('core:network/parse-failed', response.status, 'response body is not valid JSON', parseErr),
			};
		}
	}

	const text = await response.text();

	if (ctx.parser) {
		try {
			return { kind: 'value', value: ctx.parser(text) };
		}
		catch (parseErr) {
			return {
				kind: 'throw',
				error: ctx.netErr('core:network/parse-failed', response.status, 'response parser threw', parseErr),
			};
		}
	}

	return { kind: 'value', value: text as unknown as T };
}


// ─────────────────────────────────────────────────────────────────────────
// Layer 3 — orchestrator, bounded loop
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fetch a URL through the player's auth pipeline.
 *
 * Applies the consumer's `auth` config (URL transform, bearer token, per-call
 * and static headers, credentials, signRequest hook), then drives a bounded
 * retry loop over `attemptOnce`. The body is decoded per `opts.responseType`
 * and returned typed as `T`.
 *
 * Retry behaviour, in one sentence per branch:
 *  - 401 → invoke `auth.refreshOnUnauthenticated` once, retry without consuming an attempt slot.
 *  - 403 → throw `core:auth/forbidden` immediately, never refresh, never retry.
 *  - other 4xx → throw the matching `core:network/*` code, no retry.
 *  - 5xx / network / timeout → retry per `RetryConfig`, with the last error
 *    surfacing if the budget runs out.
 *
 * Observability is on by default: `fetch:start`, `fetch:retry`, `fetch:complete`
 * fire on the player bus (or `plugin:<id>:fetch:*` when called from a Plugin).
 * Pass `scope: 'silent'` to suppress.
 *
 * Throws `NetworkError` or `AuthError` only; both extend `PlayerError` and
 * carry `code`, `httpStatus`, `url`, and `cause` for inspection.
 */
export async function authFetch<T = string>(opts: AuthFetchOptions<T>): Promise<T> {
	const ctx = await prepareAttempt<T>(opts);

	ctx.dispatch('start', {
		url: ctx.url,
		pluginId: ctx.pluginId,
	});

	let attempt = 0;

	while (attempt < ctx.maxAttempts) {
		const outcome = await attemptOnce<T>(ctx, attempt + 1);

		if (outcome.kind === 'value') {
			ctx.complete(true, ctx.lastStatus);
			return outcome.value;
		}

		if (outcome.kind === 'throw') {
			ctx.complete(false, ctx.lastStatus);
			throw outcome.error;
		}

		ctx.dispatch('retry', {
			url: ctx.url,
			attempt: attempt + 1,
			reason: outcome.reason,
			delayMs: outcome.delayMs,
			pluginId: ctx.pluginId,
		});

		if (outcome.consumesAttempt) {
			attempt += 1;
		}

		await sleep(outcome.delayMs, ctx.signal);
	}

	ctx.complete(false, ctx.lastStatus);
	throw ctx.lastError ?? ctx.netErr('core:network/timeout', undefined, 'fetch retry budget exhausted');
}


// ─────────────────────────────────────────────────────────────────────────
// Helpers
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

/**
 * Construct the `Request` that gets handed to `fetch()`.
 *
 * Header layering (later wins on collision):
 *  1. `Authorization: Bearer <token>` from `auth.bearerToken` / `auth.accessToken`.
 *  2. Static `auth.headers` (resolved through `resolveHeader` so a function-valued
 *     header gets invoked per request — useful for tenant ids, request signatures).
 *  3. Per-request `opts.headers` (highest priority; lets a DRM POST override the
 *     bearer with a license-server signature, etc.).
 *
 * After the Request is built, `auth.signRequest` (if supplied) gets the final
 * say — it can mutate headers, swap the URL, or return a brand-new Request.
 */
async function buildRequest(url: string, opts: AuthFetchBase): Promise<Request> {
	const headers = new Headers();

	const effectiveBearer = opts.auth?.bearerToken ?? opts.auth?.accessToken;
	if (effectiveBearer !== undefined) {
		const token = await resolveHeader(effectiveBearer);
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

	if (opts.headers) {
		for (const [name, value] of Object.entries(opts.headers)) {
			if (value)
				headers.set(name, value);
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

/**
 * Compute the wait time before the next retry. `attempt` is the 1-indexed
 * iteration number (1 = first retry after the initial fetch failed).
 *
 *  - Linear (default): `baseMs * attempt`, capped at `maxMs`.
 *    Example with defaults (500ms / 30s): 500, 1000, 1500, 2000, ...
 *  - Exponential:      `baseMs * 2^(attempt - 1)`, capped at `maxMs`.
 *    Example with defaults: 500, 1000, 2000, 4000, 8000, ...
 */
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
