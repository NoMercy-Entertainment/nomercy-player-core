import { AuthError, NetworkError } from '../../errors';

import type { AuthFetchOptions, AttemptCtx, AuthFetchBase, AuthConfig, AuthHeaderValue, RetryConfig } from './types';

const DEFAULT_RETRY: RetryConfig = { attempts: 0 };

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
export async function buildRequest(url: string, opts: AuthFetchBase): Promise<Request> {
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
export async function prepareAttempt<T>(opts: AuthFetchOptions<T>): Promise<AttemptCtx<T>> {
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
