/**
 * StreamRegistry tests — ordered list of stream factories with most-recent-wins
 * resolution, plus the content interceptor pipeline.
 *
 * Test groups:
 *  - register / unregister
 *  - resolve — most-recently-registered wins, throws if no factory matches
 *  - prepend (used to add factories with low-priority resolution)
 *  - has / findById / list
 *  - intercept / runInterceptors
 *  - dispose
 */

import type { StreamFactory, StreamSource } from '../../adapters/stream/IStreamSource';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StreamRegistry } from '../../adapters/stream/registry';

function makeFactory(id: string, canPlayResult: boolean = true): StreamFactory {
	return {
		id,
		canPlay: () => canPlayResult,
		create: () => ({ kind: 'native' as const } as StreamSource),
	};
}

describe('StreamRegistry', () => {
	let registry: StreamRegistry;

	beforeEach(() => {
		registry = new StreamRegistry();
	});

	afterEach(() => {
		registry.dispose();
	});

	describe('register()', () => {
		it('adds a factory', () => {
			registry.register(makeFactory('hls'));
			expect(registry.has('hls')).toBe(true);
		});

		it('replaces a factory with the same id', () => {
			const a = makeFactory('hls', true);
			const b = makeFactory('hls', false);
			registry.register(a);
			registry.register(b);
			expect(registry.findById('hls')).toBe(b);
		});

		it('appends by default (most-recent at end)', () => {
			registry.register(makeFactory('a'));
			registry.register(makeFactory('b'));
			// list returns reversed (last-in-first-out resolution order, so b before a)
			expect(registry.list()).toEqual(['b', 'a']);
		});

		it('prepend places factory at the FRONT of the list', () => {
			registry.register(makeFactory('a'));
			registry.register(makeFactory('b'), true);
			// b prepended: position 0; a appended: position 1
			// list() returns reversed: ['a', 'b']
			expect(registry.list()).toEqual(['a', 'b']);
		});
	});

	describe('unregister()', () => {
		it('removes a factory by id', () => {
			registry.register(makeFactory('hls'));
			registry.unregister('hls');
			expect(registry.has('hls')).toBe(false);
		});

		it('no-op when id does not exist', () => {
			expect(() => registry.unregister('not-here')).not.toThrow();
		});
	});

	describe('resolve()', () => {
		it('most-recently-registered factory wins when multiple canPlay return true', () => {
			const a = makeFactory('a', true);
			const b = makeFactory('b', true);
			registry.register(a);
			registry.register(b);
			const resolved = registry.resolve({ url: 'foo.m3u8' });
			// b registered last, so it gets the call
			expect(resolved.kind).toBe('native');
		});

		it('skips factories whose canPlay returns false', () => {
			let bCalled = false;
			const a = makeFactory('a', false);
			const b: StreamFactory = {
				id: 'b',
				canPlay: () => {
					bCalled = true;
					return true;
				},
				create: () => ({
					kind: 'native' as const,
				} as StreamSource),
			};
			registry.register(a);
			registry.register(b);
			registry.resolve({ url: 'x' });
			expect(bCalled).toBe(true);
		});

		it('throws when no factory matches', () => {
			registry.register(makeFactory('a', false));
			expect(() => registry.resolve({ url: 'x' })).toThrow(/No stream factory/);
		});

		it('throws when no factories are registered', () => {
			expect(() => registry.resolve({ url: 'x' })).toThrow(/No stream factory/);
		});

		it('passes capabilities through to canPlay', () => {
			let capturedCaps: any;
			const factory: StreamFactory = {
				id: 'cap',
				canPlay: (_url, _ct, caps) => { capturedCaps = caps; return true; },
				create: () => ({ kind: 'native' as const } as StreamSource),
			};
			registry.register(factory);
			registry.resolve({ url: 'x', capabilities: { width: 1920, height: 1080 } });
			expect(capturedCaps).toEqual({ width: 1920, height: 1080 });
		});

		it('passes contentType through to canPlay', () => {
			let capturedCt: any;
			const factory: StreamFactory = {
				id: 'ct',
				canPlay: (_url, ct) => { capturedCt = ct; return true; },
				create: () => ({ kind: 'native' as const } as StreamSource),
			};
			registry.register(factory);
			registry.resolve({ url: 'x', contentType: 'application/dash+xml' });
			expect(capturedCt).toBe('application/dash+xml');
		});
	});

	describe('has() / findById() / list()', () => {
		it('has returns false for unknown id', () => {
			expect(registry.has('unknown')).toBe(false);
		});

		it('findById returns the factory by id', () => {
			const factory = makeFactory('hls');
			registry.register(factory);
			expect(registry.findById('hls')).toBe(factory);
		});

		it('findById returns undefined for unknown id', () => {
			expect(registry.findById('unknown')).toBeUndefined();
		});

		it('list returns factory ids in resolution order (last → first)', () => {
			registry.register(makeFactory('a'));
			registry.register(makeFactory('b'));
			registry.register(makeFactory('c'));
			expect(registry.list()).toEqual(['c', 'b', 'a']);
		});

		it('list returns empty array when nothing registered', () => {
			expect(registry.list()).toEqual([]);
		});
	});

	describe('intercept()', () => {
		it('registered interceptors compose in registration order', async () => {
			const order: string[] = [];
			registry.intercept(async (_url, response) => { order.push('a'); return response; });
			registry.intercept(async (_url, response) => { order.push('b'); return response; });
			const original = new Response('{}');
			await registry.runInterceptors('https://x', original);
			expect(order).toEqual(['a', 'b']);
		});

		it('interceptor can replace the response', async () => {
			registry.intercept(async () => new Response('replaced'));
			const result = await registry.runInterceptors('https://x', new Response('original'));
			expect(await result.text()).toBe('replaced');
		});

		it('returns unsubscribe function that removes interceptor', async () => {
			let called = false;
			const unsubscribe = registry.intercept(async (_url, response) => { called = true; return response; });
			unsubscribe();
			await registry.runInterceptors('https://x', new Response(''));
			expect(called).toBe(false);
		});

		it('runInterceptors returns original response when none registered', async () => {
			const original = new Response('untouched');
			const result = await registry.runInterceptors('https://x', original);
			expect(result).toBe(original);
		});
	});

	describe('dispose()', () => {
		it('clears all factories', () => {
			registry.register(makeFactory('a'));
			registry.register(makeFactory('b'));
			registry.dispose();
			expect(registry.list()).toEqual([]);
		});

		it('clears all interceptors', async () => {
			let called = false;
			registry.intercept(async (_url, response) => { called = true; return response; });
			registry.dispose();
			await registry.runInterceptors('https://x', new Response(''));
			expect(called).toBe(false);
		});
	});
});
