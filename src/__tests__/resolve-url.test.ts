/**
 * URL resolver tests.
 *
 * Covers:
 *  - `buildResolvedUrl` parser correctness (absolute / relative / data /
 *    blob / fragment / extension stripping for query strings).
 *  - `player.resolveUrl(url, category)` default pipeline applies
 *    `auth.transformUrl` and returns a structured `ResolvedUrl`.
 *  - Custom `urlResolver` is invoked, receives the right context, and can
 *    delegate back to the default via `ctx.defaultResolve`.
 *  - `setUrlResolver` swaps the resolver at runtime; `undefined` reverts
 *    to the default.
 *  - Bad-shape resolver output falls back to the default (no crash).
 */

import type { ResolvedUrl, UrlResolver } from '../types';
import { describe, expect, it } from 'vitest';
import { buildResolvedUrl } from '../resolved-url';
import { StubPlayer } from '../testing/stub-player';

describe('buildResolvedUrl', () => {
	it('parses an absolute http URL with extension', () => {
		const r = buildResolvedUrl('https://cdn.example.com/sub.ass', 'https://cdn.example.com/sub.ass');
		expect(r.scheme).toBe('https');
		expect(r.origin).toBe('https://cdn.example.com');
		expect(r.pathname).toBe('/sub.ass');
		expect(r.ext).toBe('ass');
		expect(r.search).toBe('');
		expect(r.relative).toBe(false);
	});

	it('strips query string when computing extension', () => {
		const r = buildResolvedUrl(
			'https://cdn.example.com/sub.ass?token=blabla',
			'https://cdn.example.com/sub.ass?token=blabla',
		);
		expect(r.ext).toBe('ass');
		expect(r.search).toBe('?token=blabla');
		expect(r.searchParams.get('token')).toBe('blabla');
	});

	it('strips fragment when computing extension', () => {
		const r = buildResolvedUrl('https://cdn.example.com/sub.ass#chap1', 'https://cdn.example.com/sub.ass#chap1');
		expect(r.ext).toBe('ass');
		expect(r.hash).toBe('#chap1');
	});

	it('handles uppercase extensions', () => {
		const r = buildResolvedUrl('https://cdn.example.com/SUB.ASS', 'https://cdn.example.com/SUB.ASS');
		expect(r.ext).toBe('ass');
	});

	it('returns empty ext when path has no extension', () => {
		const r = buildResolvedUrl('https://cdn.example.com/no-ext', 'https://cdn.example.com/no-ext');
		expect(r.ext).toBe('');
	});

	it('absolutizes a relative URL against baseUrl', () => {
		const r = buildResolvedUrl('sub.ass', 'sub.ass', 'https://cdn.example.com/base/');
		expect(r.relative).toBe(false);
		expect(r.href).toBe('https://cdn.example.com/base/sub.ass');
		expect(r.ext).toBe('ass');
	});

	it('marks relative when no base is available', () => {
		const r = buildResolvedUrl('foo/bar.ass?token=x', 'foo/bar.ass?token=x');
		expect(r.relative).toBe(true);
		expect(r.pathname).toBe('foo/bar.ass');
		expect(r.search).toBe('?token=x');
		expect(r.ext).toBe('ass');
	});

	it('handles data: URIs', () => {
		const r = buildResolvedUrl('data:text/plain,hi', 'data:text/plain,hi');
		expect(r.scheme).toBe('data');
		expect(r.relative).toBe(false);
	});

	it('toString returns href', () => {
		const r = buildResolvedUrl('https://cdn.example.com/x.ass', 'https://cdn.example.com/x.ass');
		expect(`${r}`).toBe('https://cdn.example.com/x.ass');
	});
});

describe('StubPlayer.resolveUrl', () => {
	it('returns a ResolvedUrl with the input passed through unchanged when no resolver is set', async () => {
		const p = new StubPlayer();
		p.baseUrl('https://cdn.example.com/base/');
		const r = await p.resolveUrl('sub.ass');
		expect(r.href).toBe('https://cdn.example.com/base/sub.ass');
		expect(r.ext).toBe('ass');
	});

	it('invokes a custom resolver with the right context', async () => {
		const p = new StubPlayer();
		p.baseUrl('https://cdn.example.com/');
		const seen: Array<{ url: string; category: string }> = [];
		const resolver: UrlResolver = (url, ctx) => {
			seen.push({ url, category: ctx.category });
			return buildResolvedUrl(url, `${url}?signed=1`);
		};
		p.urlResolver(resolver);
		const r = await p.resolveUrl('https://cdn.example.com/sub.ass', 'subtitle');
		expect(seen).toEqual([{ url: 'https://cdn.example.com/sub.ass', category: 'subtitle' }]);
		expect(r.href).toBe('https://cdn.example.com/sub.ass?signed=1');
		expect(r.searchParams.get('signed')).toBe('1');
	});

	it('custom resolver can delegate back to ctx.defaultResolve', async () => {
		const p = new StubPlayer();
		const resolver: UrlResolver = (url, ctx) => {
			if (ctx.category === 'cast')
				return buildResolvedUrl(url, `${url}?cast=1`);
			return ctx.defaultResolve(url);
		};
		p.urlResolver(resolver);

		const cast = await p.resolveUrl('https://x/y.mp4', 'cast');
		expect(cast.href).toBe('https://x/y.mp4?cast=1');

		const media = await p.resolveUrl('https://x/y.mp4', 'media');
		expect(media.href).toBe('https://x/y.mp4');
	});

	it('falls back to default when resolver returns a non-object', async () => {
		const p = new StubPlayer();
		// @ts-expect-error — intentional bad return for resilience test
		p.urlResolver(() => null);
		const r = await p.resolveUrl('https://x/y.ass');
		expect(r.href).toBe('https://x/y.ass');
		expect(r.ext).toBe('ass');
	});

	it('urlResolver(undefined) reverts to default', async () => {
		const p = new StubPlayer();
		const resolver: UrlResolver = url => buildResolvedUrl(url, `${url}?x=1`);
		p.urlResolver(resolver);
		expect((await p.resolveUrl('https://x/y.mp4')).href).toBe('https://x/y.mp4?x=1');
		p.urlResolver(undefined);
		expect((await p.resolveUrl('https://x/y.mp4')).href).toBe('https://x/y.mp4');
	});

	it('returned object satisfies the ResolvedUrl shape', async () => {
		const p = new StubPlayer();
		const r: ResolvedUrl = await p.resolveUrl('https://x/y.ass');
		expect(typeof r.href).toBe('string');
		expect(typeof r.ext).toBe('string');
		expect(r.searchParams).toBeInstanceOf(URLSearchParams);
		expect(typeof r.toString()).toBe('string');
	});
});
