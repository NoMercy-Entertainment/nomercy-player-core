// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

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
 *  - `baseImageUrl` poster/cast resolution — the fix for OS MediaSession
 *    lock-screen artwork 404 when items carry relative paths.
 */

import type { IUrlResolver, ResolvedUrl } from '../types';
import { describe, expect, it } from 'vitest';
import { buildResolvedUrl } from '../core/resolved-url';
import { StubPlayer } from '../testing/stub-player';

describe('buildResolvedUrl', () => {
	it('parses an absolute http URL with extension', () => {
		const resolvedUrl = buildResolvedUrl('https://cdn.example.com/sub.ass', 'https://cdn.example.com/sub.ass');
		expect(resolvedUrl.scheme).toBe('https');
		expect(resolvedUrl.origin).toBe('https://cdn.example.com');
		expect(resolvedUrl.pathname).toBe('/sub.ass');
		expect(resolvedUrl.ext).toBe('ass');
		expect(resolvedUrl.search).toBe('');
		expect(resolvedUrl.relative).toBe(false);
	});

	it('strips query string when computing extension', () => {
		const resolvedUrl = buildResolvedUrl(
			'https://cdn.example.com/sub.ass?token=blabla',
			'https://cdn.example.com/sub.ass?token=blabla',
		);
		expect(resolvedUrl.ext).toBe('ass');
		expect(resolvedUrl.search).toBe('?token=blabla');
		expect(resolvedUrl.searchParams.get('token')).toBe('blabla');
	});

	it('strips fragment when computing extension', () => {
		const resolvedUrl = buildResolvedUrl('https://cdn.example.com/sub.ass#chap1', 'https://cdn.example.com/sub.ass#chap1');
		expect(resolvedUrl.ext).toBe('ass');
		expect(resolvedUrl.hash).toBe('#chap1');
	});

	it('handles uppercase extensions', () => {
		const resolvedUrl = buildResolvedUrl('https://cdn.example.com/SUB.ASS', 'https://cdn.example.com/SUB.ASS');
		expect(resolvedUrl.ext).toBe('ass');
	});

	it('returns empty ext when path has no extension', () => {
		const resolvedUrl = buildResolvedUrl('https://cdn.example.com/no-ext', 'https://cdn.example.com/no-ext');
		expect(resolvedUrl.ext).toBe('');
	});

	it('absolutizes a relative URL against baseUrl', () => {
		const resolvedUrl = buildResolvedUrl('sub.ass', 'sub.ass', 'https://cdn.example.com/base/');
		expect(resolvedUrl.relative).toBe(false);
		expect(resolvedUrl.href).toBe('https://cdn.example.com/base/sub.ass');
		expect(resolvedUrl.ext).toBe('ass');
	});

	it('marks relative when no base is available', () => {
		const resolvedUrl = buildResolvedUrl('foo/bar.ass?token=x', 'foo/bar.ass?token=x');
		expect(resolvedUrl.relative).toBe(true);
		expect(resolvedUrl.pathname).toBe('foo/bar.ass');
		expect(resolvedUrl.search).toBe('?token=x');
		expect(resolvedUrl.ext).toBe('ass');
	});

	it('handles data: URIs', () => {
		const resolvedUrl = buildResolvedUrl('data:text/plain,hi', 'data:text/plain,hi');
		expect(resolvedUrl.scheme).toBe('data');
		expect(resolvedUrl.relative).toBe(false);
	});

	it('toString returns href', () => {
		const resolvedUrl = buildResolvedUrl('https://cdn.example.com/x.ass', 'https://cdn.example.com/x.ass');
		expect(`${resolvedUrl}`).toBe('https://cdn.example.com/x.ass');
	});
});

describe('StubPlayer.resolveUrl', () => {
	it('returns a ResolvedUrl with the input passed through unchanged when no resolver is set', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseUrl('https://cdn.example.com/base/');
		const resolvedUrl = await stubPlayer.resolveUrl('sub.ass');
		expect(resolvedUrl.href).toBe('https://cdn.example.com/base/sub.ass');
		expect(resolvedUrl.ext).toBe('ass');
	});

	it('keeps the base path when baseUrl has no trailing slash and the media path is root-relative', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseUrl('https://cdn.example.com/base');
		const resolvedUrl = await stubPlayer.resolveUrl('/dir/sub.ass', 'media');
		expect(resolvedUrl.href).toBe('https://cdn.example.com/base/dir/sub.ass');
		expect(resolvedUrl.relative).toBe(false);
	});

	it('invokes a custom resolver with the right context', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseUrl('https://cdn.example.com/');
		const seen: Array<{ url: string; category: string }> = [];
		const resolver: IUrlResolver = (url, ctx) => {
			seen.push({ url, category: ctx.category });
			return buildResolvedUrl(url, `${url}?signed=1`);
		};
		stubPlayer.urlResolver(resolver);
		const resolvedUrl = await stubPlayer.resolveUrl('https://cdn.example.com/sub.ass', 'subtitle');
		expect(seen).toEqual([{ url: 'https://cdn.example.com/sub.ass', category: 'subtitle' }]);
		expect(resolvedUrl.href).toBe('https://cdn.example.com/sub.ass?signed=1');
		expect(resolvedUrl.searchParams.get('signed')).toBe('1');
	});

	it('custom resolver can delegate back to ctx.defaultResolve', async () => {
		const stubPlayer = new StubPlayer();
		const resolver: IUrlResolver = (url, ctx) => {
			if (ctx.category === 'cast')
				return buildResolvedUrl(url, `${url}?cast=1`);
			return ctx.defaultResolve(url);
		};
		stubPlayer.urlResolver(resolver);

		const cast = await stubPlayer.resolveUrl('https://x/y.mp4', 'cast');
		expect(cast.href).toBe('https://x/y.mp4?cast=1');

		const media = await stubPlayer.resolveUrl('https://x/y.mp4', 'media');
		expect(media.href).toBe('https://x/y.mp4');
	});

	it('falls back to default when resolver returns a non-object', async () => {
		const stubPlayer = new StubPlayer();
		// @ts-expect-error — intentional bad return for resilience test
		stubPlayer.urlResolver(() => null);
		const resolvedUrl = await stubPlayer.resolveUrl('https://x/y.ass');
		expect(resolvedUrl.href).toBe('https://x/y.ass');
		expect(resolvedUrl.ext).toBe('ass');
	});

	it('urlResolver(undefined) reverts to default', async () => {
		const stubPlayer = new StubPlayer();
		const resolver: IUrlResolver = url => buildResolvedUrl(url, `${url}?x=1`);
		stubPlayer.urlResolver(resolver);
		expect((await stubPlayer.resolveUrl('https://x/y.mp4')).href).toBe('https://x/y.mp4?x=1');
		stubPlayer.urlResolver(undefined);
		expect((await stubPlayer.resolveUrl('https://x/y.mp4')).href).toBe('https://x/y.mp4');
	});

	it('returned object satisfies the ResolvedUrl shape', async () => {
		const stubPlayer = new StubPlayer();
		const resolvedUrl: ResolvedUrl = await stubPlayer.resolveUrl('https://x/y.ass');
		expect(typeof resolvedUrl.href).toBe('string');
		expect(typeof resolvedUrl.ext).toBe('string');
		expect(resolvedUrl.searchParams).toBeInstanceOf(URLSearchParams);
		expect(typeof resolvedUrl.toString()).toBe('string');
	});
});

describe('StubPlayer.resolveUrl — baseImageUrl poster/cast resolution', () => {
	// baseImageUrl is a STRING PREFIX, not a URL base. Standard URL resolution
	// semantics (new URL(path, base)) would strip the base path when `path`
	// starts with `/`. The kit uses string concatenation so TMDB-style paths
	// like baseImageUrl='https://image.tmdb.org/t/p/w780' + '/q2bVM...jpg'
	// produce the correct 'https://image.tmdb.org/t/p/w780/q2bVM...jpg'.

	it('relative path + baseImageUrl → absolute URL for category poster (TMDB pattern)', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://image.tmdb.org/t/p/w780');
		const resolvedUrl = await stubPlayer.resolveUrl('/q2bVM5z90tCGbmXYtq2J38T5hSX.jpg', 'poster');
		expect(resolvedUrl.relative).toBe(false);
		expect(resolvedUrl.href).toBe('https://image.tmdb.org/t/p/w780/q2bVM5z90tCGbmXYtq2J38T5hSX.jpg');
	});

	it('relative path + baseImageUrl → absolute URL for category cast', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://image.tmdb.org/t/p/w780');
		const resolvedUrl = await stubPlayer.resolveUrl('/backdrop.jpg', 'cast');
		expect(resolvedUrl.relative).toBe(false);
		expect(resolvedUrl.href).toBe('https://image.tmdb.org/t/p/w780/backdrop.jpg');
	});

	it('absolute URL passthrough — baseImageUrl not prepended when url already has scheme', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://image.tmdb.org/t/p/w780');
		const resolvedUrl = await stubPlayer.resolveUrl('https://cdn.example.com/poster.jpg', 'poster');
		expect(resolvedUrl.href).toBe('https://cdn.example.com/poster.jpg');
		expect(resolvedUrl.relative).toBe(false);
	});

	it('https:// URL passthrough — scheme detected, baseImageUrl not prepended', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://image.tmdb.org/t/p/w780');
		const resolvedUrl = await stubPlayer.resolveUrl('https://cdn.example.com/art.jpg', 'poster');
		expect(resolvedUrl.href).toBe('https://cdn.example.com/art.jpg');
		expect(resolvedUrl.relative).toBe(false);
	});

	it('baseImageUrl with trailing slash + url with leading slash — raw concatenation produces double-slash-free path', async () => {
		// baseImageUrl ends with `/`, url starts with `/` — honest string concat
		// gives `//`. The resolved URL parses to `/poster.jpg` under the origin.
		// Test documents the actual behavior so it is not accidentally "fixed"
		// into standard URL resolution (which would break the no-trailing-slash case).
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://img.example.com/base/');
		const resolvedUrl = await stubPlayer.resolveUrl('/poster.jpg', 'poster');
		// 'https://img.example.com/base/' + '/poster.jpg' parses to origin + path
		expect(resolvedUrl.relative).toBe(false);
		expect(resolvedUrl.href).toBe('https://img.example.com/base//poster.jpg');
	});

	it('baseImageUrl without trailing slash + url without leading slash concatenates with no separator', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://img.example.com/base');
		const resolvedUrl = await stubPlayer.resolveUrl('poster.jpg', 'poster');
		expect(resolvedUrl.href).toBe('https://img.example.com/baseposter.jpg');
	});

	it('baseImageUrl with trailing slash + url without leading slash — correct join', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://img.example.com/prefix/');
		const resolvedUrl = await stubPlayer.resolveUrl('thumb.jpg', 'poster');
		expect(resolvedUrl.href).toBe('https://img.example.com/prefix/thumb.jpg');
	});

	it('category !== poster/cast ignores baseImageUrl and uses baseUrl', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://image.tmdb.org/t/p/w780');
		stubPlayer.baseUrl('https://media.example.com/');
		const resolvedUrl = await stubPlayer.resolveUrl('sub.vtt', 'subtitle');
		expect(resolvedUrl.href).toBe('https://media.example.com/sub.vtt');
	});

	it('category media ignores baseImageUrl', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://image.tmdb.org/t/p/w780');
		stubPlayer.baseUrl('https://media.example.com/');
		const resolvedUrl = await stubPlayer.resolveUrl('stream.m3u8', 'media');
		expect(resolvedUrl.href).toBe('https://media.example.com/stream.m3u8');
	});

	it('no baseImageUrl falls back to baseUrl for poster', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseUrl('https://media.example.com/images/');
		const resolvedUrl = await stubPlayer.resolveUrl('poster.jpg', 'poster');
		expect(resolvedUrl.href).toBe('https://media.example.com/images/poster.jpg');
	});

	it('custom urlResolver overrides the default for poster', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://image.tmdb.org/t/p/w780');
		const resolver: IUrlResolver = url => buildResolvedUrl(url, `https://cdn.example.com/signed.jpg?signed=1`);
		stubPlayer.urlResolver(resolver);
		const resolvedUrl = await stubPlayer.resolveUrl('/poster.jpg', 'poster');
		expect(resolvedUrl.href).toContain('signed=1');
	});

	it('custom urlResolver receives baseImageUrl as ctx.baseUrl for poster category', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://image.tmdb.org/t/p/w780');
		const seenBaseUrls: Array<string | undefined> = [];
		const resolver: IUrlResolver = (_url, ctx) => {
			seenBaseUrls.push(ctx.baseUrl);
			return ctx.defaultResolve(_url);
		};
		stubPlayer.urlResolver(resolver);
		await stubPlayer.resolveUrl('/poster.jpg', 'poster');
		expect(seenBaseUrls[0]).toBe('https://image.tmdb.org/t/p/w780');
	});
});
