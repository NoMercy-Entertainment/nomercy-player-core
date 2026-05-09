/**
 * Stream interceptor wiring tests — verify the registry threads itself into
 * sources via `factory.create({ ..., registry })` so that backends can pipe
 * manifest/segment fetches through `runInterceptors()` before yielding bytes.
 *
 * The deep hls.js attach path is exercised in Playwright; here we lock the
 * contract that the registry IS handed off and the interceptor pipeline
 * composes correctly.
 */

import type { StreamFactory, StreamFactoryOptions, StreamSource } from '../../streams/source';
import { describe, expect, it, vi } from 'vitest';
import { hlsFactory, HlsStreamSource } from '../../streams/hls';
import { StreamRegistry } from '../../streams/registry';

describe('streams/intercept wiring', () => {
	describe('intercept() unsubscribe', () => {
		it('registration returns an unsubscribe that removes the interceptor', async () => {
			const registry = new StreamRegistry();
			const fn = vi.fn(async (_url: string, response: Response) => response);
			const unsubscribe = registry.intercept(fn);
			expect(typeof unsubscribe).toBe('function');

			unsubscribe();
			await registry.runInterceptors('https://x', new Response(''));
			expect(fn).not.toHaveBeenCalled();
		});

		it('only removes the unsubscribed fn when multiple are registered', async () => {
			const registry = new StreamRegistry();
			const a = vi.fn(async (_url: string, response: Response) => response);
			const b = vi.fn(async (_url: string, response: Response) => response);
			const unsubA = registry.intercept(a);
			registry.intercept(b);

			unsubA();
			await registry.runInterceptors('https://x', new Response(''));
			expect(a).not.toHaveBeenCalled();
			expect(b).toHaveBeenCalledOnce();
		});
	});

	describe('runInterceptors composition', () => {
		it('multiple interceptors run in registration order', async () => {
			const registry = new StreamRegistry();
			const order: string[] = [];
			registry.intercept(async (_url, response) => {
				order.push('first');
				return response;
			});
			registry.intercept(async (_url, response) => {
				order.push('second');
				return response;
			});
			registry.intercept(async (_url, response) => {
				order.push('third');
				return response;
			});

			await registry.runInterceptors('https://example.com/manifest.m3u8', new Response(''));
			expect(order).toEqual(['first', 'second', 'third']);
		});

		it('each interceptor sees the response returned by the previous one', async () => {
			const registry = new StreamRegistry();
			registry.intercept(async () => new Response('A'));
			registry.intercept(async (_url, response) => {
				const text = await response.text();
				return new Response(`${text}B`);
			});
			registry.intercept(async (_url, response) => {
				const text = await response.text();
				return new Response(`${text}C`);
			});

			const final = await registry.runInterceptors('https://x', new Response('original'));
			expect(await final.text()).toBe('ABC');
		});

		it('the manifest URL is passed through to every interceptor', async () => {
			const registry = new StreamRegistry();
			const seen: string[] = [];
			registry.intercept(async (url, response) => { seen.push(url); return response; });
			registry.intercept(async (url, response) => { seen.push(url); return response; });

			await registry.runInterceptors('https://cdn.example/master.m3u8', new Response(''));
			expect(seen).toEqual(['https://cdn.example/master.m3u8', 'https://cdn.example/master.m3u8']);
		});
	});

	describe('StreamRegistry.resolve() threads registry into factory', () => {
		it('factory.create receives the owning registry in opts', () => {
			const registry = new StreamRegistry();
			let captured: StreamFactoryOptions | undefined;
			const factory: StreamFactory = {
				id: 'capture',
				canPlay: () => true,
				create: (opts) => {
					captured = opts;
					return { kind: 'native' as const } as StreamSource;
				},
			};
			registry.register(factory);
			registry.resolve({ url: 'https://x/test.m3u8' });

			expect(captured?.registry).toBe(registry);
			expect(captured?.url).toBe('https://x/test.m3u8');
		});

		it('HlsStreamSource constructed via registry.resolve() carries the registry', () => {
			const registry = new StreamRegistry();
			registry.register(hlsFactory);
			const source = registry.resolve({ url: 'https://cdn/stream.m3u8' });

			expect(source).toBeInstanceOf(HlsStreamSource);
			expect((source as HlsStreamSource).getRegistry()).toBe(registry);
		});

		it('HlsStreamSource constructed directly without registry still works (back-compat)', () => {
			const source = hlsFactory.create({ url: 'https://cdn/stream.m3u8' });
			expect(source).toBeInstanceOf(HlsStreamSource);
			expect((source as HlsStreamSource).getRegistry()).toBeUndefined();
		});
	});
});
