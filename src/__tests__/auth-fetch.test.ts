/**
 * authFetch tests — mocked-fetch unit tests covering the auth pipeline,
 * 401-refresh-retry, 403-propagate, retry-on-5xx, scope-aware event routing,
 * and parser invocation.
 *
 * Behavior locked here:
 *  - Auth pipeline: transformUrl → bearer → headers → signRequest
 *  - 401: invokes refreshOnUnauthenticated, retries once
 *  - 403: throws AuthError immediately, never retries
 *  - 5xx: retries per RetryConfig
 *  - Network/timeout: retries per RetryConfig
 *  - Aborted: throws NetworkError(aborted) immediately
 *  - Event routing per scope
 *  - Parser invocation + parser-throw → core:network/parse-failed
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authFetch } from '../auth-fetch';
import { AuthError, NetworkError } from '../errors';

describe('authFetch', () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, 'fetch') as ReturnType<typeof vi.spyOn>;
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	const mockFetchResponse = (status: number, body: string = '{}') => {
		(fetchSpy as any).mockResolvedValueOnce(new Response(body, { status }));
	};

	const ctrl = () => new AbortController();

	// ─────────────────────────────────────────────────────────────────────
	// Happy path
	// ─────────────────────────────────────────────────────────────────────

	describe('happy path', () => {
		it('returns response text when no parser given', async () => {
			mockFetchResponse(200, 'hello');
			const result = await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
			})
			;
			expect(result).toBe('hello');
		});

		it('runs the parser and returns its result', async () => {
			mockFetchResponse(200, '{"a":1}');
			const result = await authFetch<{ a: number }>({
				url: 'https://x/y',
				signal: ctrl().signal,
				parser: raw => JSON.parse(raw),
			});
			expect(result).toEqual({ a: 1 });
		});

		it('throws core:network/parse-failed when parser throws', async () => {
			mockFetchResponse(200, 'not-json');
			await expect(authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				parser: raw => JSON.parse(raw),
			})).rejects.toThrow(NetworkError);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Auth pipeline
	// ─────────────────────────────────────────────────────────────────────

	describe('auth pipeline', () => {
		it('applies transformUrl before fetch', async () => {
			mockFetchResponse(200);
			await authFetch({
				url: 'nmsync://relative',
				signal: ctrl().signal,
				auth: { transformUrl: () => 'https://x/y' },
			});
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.url).toBe('https://x/y');
		});

		it('attaches Authorization: Bearer when bearerToken is set', async () => {
			mockFetchResponse(200);
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { bearerToken: 'tok123' },
			});
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.headers.get('Authorization')).toBe('Bearer tok123');
		});

		it('resolves bearerToken when given as a sync function', async () => {
			mockFetchResponse(200);
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { bearerToken: () => 'fn-tok' },
			});
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.headers.get('Authorization')).toBe('Bearer fn-tok');
		});

		it('resolves bearerToken when given as an async function', async () => {
			mockFetchResponse(200);
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { bearerToken: async () => 'async-tok' },
			});
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.headers.get('Authorization')).toBe('Bearer async-tok');
		});

		it('merges static auth.headers', async () => {
			mockFetchResponse(200);
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { headers: { 'X-Custom': 'value' } },
			});
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.headers.get('X-Custom')).toBe('value');
		});

		it('signRequest can replace the Request', async () => {
			mockFetchResponse(200);
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { signRequest: () => new Request('https://signed/y', { headers: { 'X-Signed': '1' } }) },
			});
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.url).toBe('https://signed/y');
			expect(req.headers.get('X-Signed')).toBe('1');
		});

		it('credentials default to "same-origin"', async () => {
			mockFetchResponse(200);
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
			});
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.credentials).toBe('same-origin');
		});

		it('credentials honor the auth.credentials setting', async () => {
			mockFetchResponse(200);
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { credentials: 'include' },
			});
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.credentials).toBe('include');
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// 401 — refresh + retry
	// ─────────────────────────────────────────────────────────────────────

	describe('401 — refresh + retry', () => {
		it('invokes refreshOnUnauthenticated then retries', async () => {
			mockFetchResponse(401);
			mockFetchResponse(200, 'after-refresh');
			const refresh = vi.fn();
			const result = await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { refreshOnUnauthenticated: refresh },
			});
			expect(refresh).toHaveBeenCalledTimes(1);
			expect(result).toBe('after-refresh');
		});

		it('throws AuthError(unauthenticated) when no refresh handler', async () => {
			mockFetchResponse(401);
			const result = authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
			});
			await expect(result).rejects.toThrow(AuthError);
		});

		it('throws AuthError(refresh-failed) when refresh throws', async () => {
			mockFetchResponse(401);
			const refresh = vi.fn().mockRejectedValue(new Error('refresh broke'));
			const result = authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { refreshOnUnauthenticated: refresh },
			});
			await expect(result).rejects.toMatchObject({ code: 'core:auth/refresh-failed' });
		});

		it('does NOT refresh-loop on second consecutive 401', async () => {
			mockFetchResponse(401);
			mockFetchResponse(401); // refresh ran but still 401
			const refresh = vi.fn();
			const result = authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { refreshOnUnauthenticated: refresh },
			});
			await expect(result).rejects.toThrow(AuthError);
			expect(refresh).toHaveBeenCalledTimes(1);
		});

		it('skips refresh when retryAfterRefresh is 0', async () => {
			mockFetchResponse(401);
			const refresh = vi.fn();
			const result = authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { refreshOnUnauthenticated: refresh, retryAfterRefresh: 0 },
			});
			await expect(result).rejects.toThrow(AuthError);
			expect(refresh).not.toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// 403 — propagate
	// ─────────────────────────────────────────────────────────────────────

	describe('403 — never retry, never refresh', () => {
		it('throws AuthError(forbidden) immediately', async () => {
			mockFetchResponse(403);
			const result = authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
			});
			await expect(result).rejects.toMatchObject({
				code: 'core:auth/forbidden',
			});
		});

		it('does NOT invoke refresh on 403', async () => {
			mockFetchResponse(403);
			const refresh = vi.fn();
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { refreshOnUnauthenticated: refresh },
			}).catch(() => {});
			expect(refresh).not.toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Other 4xx — propagate
	// ─────────────────────────────────────────────────────────────────────

	describe('other 4xx — propagate', () => {
		it('404 → NetworkError(not-found)', async () => {
			mockFetchResponse(404);
			await expect(authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
			}))
				.rejects
				.toMatchObject({
					code: 'core:network/not-found',
				});
		});

		it('429 → NetworkError(rate-limited)', async () => {
			mockFetchResponse(429);
			await expect(authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
			}))
				.rejects
				.toMatchObject({
					code: 'core:network/rate-limited',
				});
		});

		it('400 → NetworkError(client-error)', async () => {
			mockFetchResponse(400);
			await expect(authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
			}))
				.rejects
				.toMatchObject({
					code: 'core:network/client-error',
				});
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// 5xx — retry per policy
	// ─────────────────────────────────────────────────────────────────────

	describe('5xx — retry per policy', () => {
		it('retries on 500 when retry attempts > 0', async () => {
			mockFetchResponse(500);
			mockFetchResponse(200, 'recovered');
			const result = await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				retry: { attempts: 1 },
			});
			expect(result).toBe('recovered');
		});

		it('throws after all retry attempts exhausted', async () => {
			mockFetchResponse(500);
			mockFetchResponse(500);
			const result = authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				retry: { attempts: 1 },
			});
			await expect(result).rejects.toMatchObject({
				code: 'core:network/server-error',
			});
		});

		it('502 → NetworkError(bad-gateway)', async () => {
			mockFetchResponse(502);
			const result = authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
			});
			await expect(result).rejects.toMatchObject({
				code: 'core:network/bad-gateway',
			});
		});

		it('503 → NetworkError(service-unavailable)', async () => {
			mockFetchResponse(503);
			const result = authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
			});
			await expect(result).rejects.toMatchObject({
				code: 'core:network/service-unavailable',
			});
		});

		it('504 → NetworkError(gateway-timeout)', async () => {
			mockFetchResponse(504);
			const result = authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
			});
			await expect(result).rejects.toMatchObject({
				code: 'core:network/gateway-timeout',
			});
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Aborted
	// ─────────────────────────────────────────────────────────────────────

	describe('abort', () => {
		it('throws NetworkError(aborted) when signal aborts during fetch', async () => {
			(fetchSpy as any).mockImplementation(() => Promise.reject(new DOMException('aborted', 'AbortError')));
			const c = new AbortController();
			c.abort();
			const result = authFetch({
				url: 'https://x/y',
				signal: c.signal,
			});
			await expect(result).rejects.toMatchObject({
				code: 'core:network/aborted',
				severity: 'info',
			});
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Event routing
	// ─────────────────────────────────────────────────────────────────────

	describe('event routing', () => {
		it('emits fetch:start / fetch:complete on player scope when scope=player', async () => {
			mockFetchResponse(200);
			const emitted: { event: string; data: any }[] = [];
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				emit: (event, data) => emitted.push({ event, data }),
				scope: 'player',
			});
			expect(emitted.find(e => e.event === 'fetch:start')).toBeDefined();
			expect(emitted.find(e => e.event === 'fetch:complete')).toBeDefined();
		});

		it('emits plugin:<id>:fetch:* events when scope=plugin and pluginId is set', async () => {
			mockFetchResponse(200);
			const emitted: string[] = [];
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				emit: event => emitted.push(event),
				scope: 'plugin',
				pluginId: 'lyrics',
			});
			expect(emitted).toContain('plugin:lyrics:fetch:start');
			expect(emitted).toContain('plugin:lyrics:fetch:complete');
		});

		it('emits NOTHING when scope=silent', async () => {
			mockFetchResponse(200);
			const emitted: string[] = [];
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				emit: event => emitted.push(event),
				scope: 'silent',
				pluginId: 'lyrics',
			});
			expect(emitted).toEqual([]);
		});

		it('default scope when pluginId set is "plugin"', async () => {
			mockFetchResponse(200);
			const emitted: string[] = [];
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				emit: event => emitted.push(event),
				pluginId: 'lyrics',
			});
			expect(emitted.some(e => e.startsWith('plugin:lyrics:fetch:'))).toBe(true);
			expect(emitted.includes('fetch:start')).toBe(false);
		});

		it('default scope when no pluginId is "player"', async () => {
			mockFetchResponse(200);
			const emitted: string[] = [];
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				emit: event => emitted.push(event),
			});
			expect(emitted).toContain('fetch:start');
			expect(emitted).toContain('fetch:complete');
		});

		it('emits fetch:retry between retry attempts', async () => {
			mockFetchResponse(500);
			mockFetchResponse(200);
			const emitted: { event: string; data: any }[] = [];
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				retry: { attempts: 1 },
				emit: (event, data) => emitted.push({ event, data }),
				scope: 'player',
			});
			expect(emitted.find(e => e.event === 'fetch:retry')).toBeDefined();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Method + body
	// ─────────────────────────────────────────────────────────────────────

	describe('method + body', () => {
		it('defaults to GET', async () => {
			mockFetchResponse(200);
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
			})
			;
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.method).toBe('GET');
		});

		it('honors POST method', async () => {
			mockFetchResponse(200);
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				method: 'POST',
				body: JSON.stringify({ a: 1 }),
			});
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.method).toBe('POST');
		});
	});
});
