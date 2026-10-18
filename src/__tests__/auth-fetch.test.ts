// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

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

import type { IFetch } from '../adapters/fetch/IFetch';
import type { AuthConfig } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authFetch } from '../core/auth-fetch';
import { pluginFetch } from '../core/plugin/fetch';
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
			});
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
	// responseType discriminant
	// ─────────────────────────────────────────────────────────────────────

	describe('responseType', () => {
		it('responseType: json returns a parsed object', async () => {
			mockFetchResponse(200, '{"key":"value"}');
			const result = await authFetch<{ key: string }>({
				url: 'https://x/y',
				signal: ctrl().signal,
				responseType: 'json',
			});
			expect(result).toEqual({ key: 'value' });
		});

		it('responseType: json on a non-JSON body throws core:network/parse-failed', async () => {
			mockFetchResponse(200, 'not-json-at-all');
			await expect(
				authFetch<unknown>({
					url: 'https://x/y',
					signal: ctrl().signal,
					responseType: 'json',
				}),
			).rejects.toMatchObject({ code: 'core:network/parse-failed' });
		});

		it('responseType: arrayBuffer returns an ArrayBuffer', async () => {
			const buf = new Uint8Array([1, 2, 3]).buffer;
			(fetchSpy as any).mockResolvedValueOnce(new Response(buf, { status: 200 }));
			const result = await authFetch<ArrayBuffer>({
				url: 'https://x/y',
				signal: ctrl().signal,
				responseType: 'arrayBuffer',
			});
			expect(result).toBeInstanceOf(ArrayBuffer);
			expect(new Uint8Array(result).slice(0, 3)).toEqual(new Uint8Array([1, 2, 3]));
		});

		it('default (no responseType) returns text; parser still works', async () => {
			mockFetchResponse(200, '{"n":42}');
			const result = await authFetch<{ n: number }>({
				url: 'https://x/y',
				signal: ctrl().signal,
				parser: raw => JSON.parse(raw) as { n: number },
			});
			expect(result).toEqual({ n: 42 });
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

		it('retries with the token the refresh handler stored by replacing the auth object', async () => {
			mockFetchResponse(401);
			mockFetchResponse(200, 'after-refresh');
			let live: AuthConfig = {
				bearerToken: 'old',
				refreshOnUnauthenticated: async () => {
					live = { ...live, bearerToken: 'new' };
				},
			};
			const result = await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: live,
				liveAuth: () => live,
			});
			expect(result).toBe('after-refresh');
			expect((fetchSpy.mock.calls[0]![0] as Request).headers.get('Authorization')).toBe('Bearer old');
			expect((fetchSpy.mock.calls[1]![0] as Request).headers.get('Authorization')).toBe('Bearer new');
		});

		it('pluginFetch retries with the token player.auth() stored during the refresh', async () => {
			mockFetchResponse(401);
			mockFetchResponse(200, 'after-refresh');
			let live: AuthConfig = {
				bearerToken: 'old',
				refreshOnUnauthenticated: async () => {
					live = { ...live, bearerToken: 'new' };
				},
			};
			const host = {
				id: 'p',
				lifecycle: { abortable: () => new AbortController() },
				player: { options: {}, _rawAuth: () => live, emit: () => {} },
			};
			const result = await pluginFetch(host as never, 'https://x/y');
			expect(result).toBe('after-refresh');
			expect((fetchSpy.mock.calls[1]![0] as Request).headers.get('Authorization')).toBe('Bearer new');
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

		it('rejects at once with no retry event and no backoff when attempts is 0', async () => {
			mockFetchResponse(503);
			const events: string[] = [];
			const startedAt = Date.now();
			await expect(authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				retry: { attempts: 0 },
				emit: event => events.push(event),
			})).rejects.toMatchObject({ code: 'core:network/service-unavailable' });
			expect(Date.now() - startedAt).toBeLessThan(250);
			expect(events).toEqual(['fetch:start', 'fetch:complete']);
		});

		it('emits one retry event per retry that actually happens and none after the last attempt', async () => {
			mockFetchResponse(503);
			mockFetchResponse(503);
			const retries: number[] = [];
			await expect(authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				retry: { attempts: 1, baseMs: 1 },
				emit: (event, data) => {
					if (event === 'fetch:retry')
						retries.push((data as { attempt: number }).attempt);
				},
			})).rejects.toMatchObject({ code: 'core:network/service-unavailable' });
			expect(retries).toEqual([1]);
		});

		it('keeps the real error when the signal aborts after the last attempt failed', async () => {
			mockFetchResponse(503);
			const abortController = new AbortController();
			const result = authFetch({
				url: 'https://x/y',
				signal: abortController.signal,
				retry: { attempts: 0 },
			});
			const settled = expect(result).rejects.toMatchObject({ code: 'core:network/service-unavailable' });
			await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
			abortController.abort();
			await settled;
		});

		it('exponential backoff escalates across retries (500, 1000, 2000)', async () => {
			mockFetchResponse(500);
			mockFetchResponse(500);
			mockFetchResponse(500);
			mockFetchResponse(200, 'recovered');
			const retryDelays: number[] = [];
			const result = await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				retry: {
					attempts: 3,
					backoff: 'exponential',
					baseMs: 500,
				},
				emit: (event, data) => {
					if (event === 'fetch:retry') {
						retryDelays.push((data as { delayMs: number }).delayMs);
					}
				},
			});
			expect(result).toBe('recovered');
			expect(retryDelays).toEqual([500, 1000, 2000]);
		});

		it('linear backoff escalates across retries (500, 1000, 1500)', async () => {
			mockFetchResponse(500);
			mockFetchResponse(500);
			mockFetchResponse(500);
			mockFetchResponse(200, 'recovered');
			const retryDelays: number[] = [];
			const result = await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				retry: {
					attempts: 3,
					baseMs: 500,
				},
				emit: (event, data) => {
					if (event === 'fetch:retry') {
						retryDelays.push((data as { delayMs: number }).delayMs);
					}
				},
			});
			expect(result).toBe('recovered');
			expect(retryDelays).toEqual([500, 1000, 1500]);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Aborted
	// ─────────────────────────────────────────────────────────────────────

	describe('abort', () => {
		it('throws NetworkError(aborted) when signal aborts during fetch', async () => {
			(fetchSpy as any).mockImplementation(() => Promise.reject(new DOMException('aborted', 'AbortError')));
			const abortController = new AbortController();
			abortController.abort();
			const result = authFetch({
				url: 'https://x/y',
				signal: abortController.signal,
			});
			await expect(result).rejects.toMatchObject({
				code: 'core:network/aborted',
				severity: 'info',
			});
		});

		it('throws NetworkError(aborted) — not a raw DOMException — and still fires fetch:complete when aborted during the retry backoff sleep', async () => {
			mockFetchResponse(503);
			const abortController = new AbortController();
			const emitted: { event: string; data: any }[] = [];

			const resultPromise = authFetch({
				url: 'https://x/y',
				signal: abortController.signal,
				retry: { attempts: 1, baseMs: 1000 },
				emit: (event, data) => emitted.push({ event, data }),
			});

			await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
			abortController.abort();

			await expect(resultPromise).rejects.toMatchObject({
				code: 'core:network/aborted',
				severity: 'info',
			});
			expect(fetchSpy).toHaveBeenCalledTimes(1);
			const complete = emitted.find(entry => entry.event === 'fetch:complete');
			expect(complete).toBeDefined();
			expect(complete!.data.ok).toBe(false);
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
			expect(emitted.find(event => event.event === 'fetch:start')).toBeDefined();
			expect(emitted.find(event => event.event === 'fetch:complete')).toBeDefined();
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
			expect(emitted.some(eventName => eventName.startsWith('plugin:lyrics:fetch:'))).toBe(true);
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
			expect(emitted.find(event => event.event === 'fetch:retry')).toBeDefined();
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

	// ─────────────────────────────────────────────────────────────────────
	// Per-request headers
	// ─────────────────────────────────────────────────────────────────────

	describe('per-request headers', () => {
		it('forwards opts.headers onto the request', async () => {
			mockFetchResponse(200);
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				headers: { 'X-License-Sig': 'abc123' },
			});
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.headers.get('X-License-Sig')).toBe('abc123');
		});

		it('per-request headers override auth.headers on collision', async () => {
			mockFetchResponse(200);
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { headers: { 'X-Tenant': 'auth-default' } },
				headers: { 'X-Tenant': 'request-override' },
			});
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.headers.get('X-Tenant')).toBe('request-override');
		});

		it('keeps Authorization from bearerToken when per-request headers do not override it', async () => {
			mockFetchResponse(200);
			await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { bearerToken: 'kit-token' },
				headers: { 'X-License-Sig': 'abc123' },
			});
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.headers.get('Authorization')).toBe('Bearer kit-token');
			expect(req.headers.get('X-License-Sig')).toBe('abc123');
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Request building — callback and URL errors keep the throws contract
	// ─────────────────────────────────────────────────────────────────────

	describe('injected fetch', () => {
		it('sends the built request through the injected fetch instead of the global', async () => {
			const injected = vi.fn<IFetch>(async () => new Response('via-injected', { status: 200 }));
			const result = await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				method: 'POST',
				body: 'payload',
				auth: { bearerToken: 'tok' },
				fetch: injected,
			});
			expect(result).toBe('via-injected');
			expect(fetchSpy).not.toHaveBeenCalled();
			const [url, init] = injected.mock.calls[0]!;
			expect(url).toBe('https://x/y');
			expect(init!.method).toBe('POST');
			expect(new Headers(init!.headers).get('Authorization')).toBe('Bearer tok');
			expect(new TextDecoder().decode(init!.body as ArrayBuffer)).toBe('payload');
		});

		it('retries a 5xx through the injected fetch', async () => {
			const injected = vi.fn<IFetch>()
				.mockResolvedValueOnce(new Response('', { status: 503 }))
				.mockResolvedValueOnce(new Response('ok', { status: 200 }));
			const result = await authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				retry: { attempts: 1, baseMs: 1 },
				fetch: injected,
			});
			expect(result).toBe('ok');
			expect(injected).toHaveBeenCalledTimes(2);
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it('pluginFetch uses setup({ fetch }) from the player options', async () => {
			const injected = vi.fn<IFetch>(async () => new Response('via-options', { status: 200 }));
			const host = {
				id: 'p',
				lifecycle: { abortable: () => new AbortController() },
				player: { options: { fetch: injected }, emit: () => {} },
			};
			expect(await pluginFetch(host as never, 'https://x/y')).toBe('via-options');
			expect(fetchSpy).not.toHaveBeenCalled();
		});
	});

	describe('request building errors', () => {
		const boom = new Error('boom');

		it('wraps a throwing bearerToken callback in AuthError with the original as cause', async () => {
			const result = authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { bearerToken: () => { throw boom; } },
			});
			await expect(result).rejects.toBeInstanceOf(AuthError);
			await expect(result).rejects.toMatchObject({ code: 'core:auth/request-build-failed', cause: boom });
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it('wraps a throwing auth header callback in AuthError', async () => {
			const result = authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { headers: { 'X-Tenant': () => { throw boom; } } },
			});
			await expect(result).rejects.toBeInstanceOf(AuthError);
			await expect(result).rejects.toMatchObject({ cause: boom });
		});

		it('wraps a throwing signRequest in AuthError', async () => {
			const result = authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { signRequest: () => { throw boom; } },
			});
			await expect(result).rejects.toBeInstanceOf(AuthError);
			await expect(result).rejects.toMatchObject({ cause: boom });
		});

		it('wraps a throwing transformUrl in NetworkError', async () => {
			const result = authFetch({
				url: 'https://x/y',
				signal: ctrl().signal,
				auth: { transformUrl: () => { throw boom; } },
			});
			await expect(result).rejects.toBeInstanceOf(NetworkError);
			await expect(result).rejects.toMatchObject({ code: 'core:network/invalid-request', cause: boom });
		});

		it('wraps an unparseable URL in NetworkError', async () => {
			const result = authFetch({
				url: 'http://[bad',
				signal: ctrl().signal,
			});
			await expect(result).rejects.toBeInstanceOf(NetworkError);
			await expect(result).rejects.toMatchObject({ code: 'core:network/invalid-request' });
		});

		it('still fires fetch:complete with ok=false when the request cannot be built', async () => {
			const emitted: string[] = [];
			await expect(authFetch({
				url: 'http://[bad',
				signal: ctrl().signal,
				emit: event => emitted.push(event),
			})).rejects.toBeInstanceOf(NetworkError);
			expect(emitted).toEqual(['fetch:start', 'fetch:complete']);
		});
	});
});
