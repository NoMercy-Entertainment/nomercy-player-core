// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Behavior tests for the auth mixin's URL resolution and translation paths.
 *
 * Targets:
 *  - resolveUrl() with baseImageUrl prefix for artwork categories
 *    (poster / cast) — asserts the resolved href is the correct concatenation
 *  - Custom urlResolver invoked with redacted auth context (no token in ctx.auth)
 *    Uses the real mixin player so _authConfig is wired into the resolver context.
 *  - translation() read / write round-trip via StubPlayer
 *  - removeTranslations() by prefix, with and without lang restriction
 */

import type { BaseEventMap, IUrlResolver, UrlResolverContext } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';
import { StubPlayer } from '../testing/stub-player';

// ───────────────────────���─────────────────────────────────────────────────────
// Real mixin player for tests that require live _authConfig wiring
// ───────────────────────────────────────────────────���─────────────────────────

const _authInstances = new Map<string, AuthMockPlayer>();

class AuthMockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = {} as HTMLElement;

	get id(): string {
		return this.playerId;
	}

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare phase: () => string;
	declare auth: {
		(): Readonly<Record<string, unknown>> | undefined;
		(cfg: Record<string, unknown>): void;
		(v: null): void;
	};

	declare resolveUrl: (url: string, category?: string) => Promise<{ href: string; relative: boolean }>;

	declare urlResolver: {
		(): IUrlResolver | undefined;
		(resolver: IUrlResolver | undefined): void;
	};

	declare baseImageUrl: {
		(): string | undefined;
		(path: string): void;
	};

	declare baseUrl: {
		(): string | undefined;
		(url: string): void;
	};

	declare queue: {
		(): ReadonlyArray<unknown>;
		(items: unknown[]): void;
	};

	constructor(id?: string | number) {
		super();
		const resolved = resolvePlayerConstructor(id, _authInstances, 'AuthMockPlayer');
		if (resolved.kind === 'existing') {
			return resolved.instance as unknown as this;
		}
		initPlayerCoreState(this, { className: 'AuthMockPlayer' });
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_authInstances.set(resolved.id, this);
	}

	static _resetRegistry(): void {
		_authInstances.clear();
	}
}

composeMixins(AuthMockPlayer.prototype, ...playerCoreMethods);

let _authDivCounter = 0;
function makeAuthPlayer(): AuthMockPlayer {
	const id = `auth-player-${_authDivCounter++}`;
	const div = document.createElement('div');
	div.id = id;
	document.body.appendChild(div);
	return new AuthMockPlayer(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveUrl() — baseImageUrl prefix for artwork categories
// ─────────────────────────────────────────────────────────────────────────────

describe('auth mixin — resolveUrl() baseImageUrl prefix (artwork categories)', () => {
	it('poster category: relative path is prefixed with baseImageUrl as a string', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://image.tmdb.org/t/p/w780');

		const resolvedUrl = await stubPlayer.resolveUrl('/poster-path.jpg', 'poster');

		expect(resolvedUrl.relative).toBe(false);
		expect(resolvedUrl.href).toBe('https://image.tmdb.org/t/p/w780/poster-path.jpg');
	});

	it('cast category: relative path is prefixed with baseImageUrl as a string', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://image.tmdb.org/t/p/w300');

		const resolvedUrl = await stubPlayer.resolveUrl('/cast-path.jpg', 'cast');

		expect(resolvedUrl.relative).toBe(false);
		expect(resolvedUrl.href).toBe('https://image.tmdb.org/t/p/w300/cast-path.jpg');
	});

	it('artwork category: already-absolute URL is not double-prefixed', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://image.tmdb.org/t/p/w780');

		const resolvedUrl = await stubPlayer.resolveUrl('https://cdn.example.com/art.jpg', 'poster');

		expect(resolvedUrl.href).toBe('https://cdn.example.com/art.jpg');
	});

	it('non-artwork category (subtitle) ignores baseImageUrl, uses baseUrl instead', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://image.tmdb.org/t/p/w780');
		stubPlayer.baseUrl('https://media.example.com/');

		const resolvedUrl = await stubPlayer.resolveUrl('sub.vtt', 'subtitle');

		expect(resolvedUrl.href).toBe('https://media.example.com/sub.vtt');
		expect(resolvedUrl.href).not.toContain('tmdb');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveUrl() — custom resolver receives REDACTED auth context
// (the encapsulation contract: bearer token must never reach consumer code)
// Uses the real mixin player so _authConfig flows into ctx.auth.
// ─────────────────────────────────────────────────────────────────────────────

describe('auth mixin — resolveUrl() custom resolver receives redacted auth', () => {
	beforeEach(() => AuthMockPlayer._resetRegistry());
	afterEach(() => {
		AuthMockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('custom resolver ctx.auth has no bearerToken field', async () => {
		const authMockPlayer = makeAuthPlayer();
		authMockPlayer.setup({ auth: { bearerToken: 'secret-bearer', credentials: 'include' } });
		await authMockPlayer.ready();

		const capturedContexts: UrlResolverContext[] = [];
		const resolver: IUrlResolver = (url, ctx) => {
			capturedContexts.push({ ...ctx, auth: ctx.auth ? { ...ctx.auth } : undefined });
			return ctx.defaultResolve(url);
		};
		authMockPlayer.urlResolver(resolver);

		await authMockPlayer.resolveUrl('https://cdn.example.com/video.mp4', 'media');

		expect(capturedContexts.length).toBeGreaterThan(0);
		const ctx = capturedContexts[0]!;
		expect(ctx.auth).toBeDefined();
		expect((ctx.auth as Record<string, unknown>)['bearerToken']).toBeUndefined();
		expect((ctx.auth as Record<string, unknown>)['accessToken']).toBeUndefined();
	});

	it('custom resolver ctx.auth retains non-secret fields (credentials)', async () => {
		const authMockPlayer = makeAuthPlayer();
		authMockPlayer.setup({ auth: { bearerToken: 'secret', credentials: 'include' } });
		await authMockPlayer.ready();

		const capturedContexts: UrlResolverContext[] = [];
		const resolver: IUrlResolver = (url, ctx) => {
			capturedContexts.push({ ...ctx, auth: ctx.auth ? { ...ctx.auth } : undefined });
			return ctx.defaultResolve(url);
		};
		authMockPlayer.urlResolver(resolver);

		await authMockPlayer.resolveUrl('https://cdn.example.com/video.mp4', 'media');

		const auth = capturedContexts[0]?.auth as Record<string, unknown> | undefined;
		expect(auth).toBeDefined();
		expect(auth?.['credentials']).toBe('include');
	});

	it('custom resolver is called with the category that was passed', async () => {
		const stubPlayer = new StubPlayer();

		const seen: string[] = [];
		const resolver: IUrlResolver = (url, ctx) => {
			seen.push(ctx.category);
			return ctx.defaultResolve(url);
		};
		stubPlayer.urlResolver(resolver);

		await stubPlayer.resolveUrl('https://cdn.example.com/poster.jpg', 'poster');

		expect(seen[0]).toBe('poster');
	});

	it('custom resolver for artwork category receives baseImageUrl as ctx.baseUrl', async () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.baseImageUrl('https://image.tmdb.org/t/p/w780');

		const seenBaseUrls: Array<string | undefined> = [];
		const resolver: IUrlResolver = (url, ctx) => {
			seenBaseUrls.push(ctx.baseUrl);
			return ctx.defaultResolve(url);
		};
		stubPlayer.urlResolver(resolver);

		await stubPlayer.resolveUrl('/poster.jpg', 'poster');

		expect(seenBaseUrls[0]).toBe('https://image.tmdb.org/t/p/w780');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// translation() — read / write round-trip via StubPlayer
// ─────────────────────────────────────────────────────────────────────────────

describe('i18n mixin — translation() read/write round-trip', () => {
	it('write then read returns the stored value', () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.translation('en', 'my.key', 'Hello World');

		expect(stubPlayer.translation('en', 'my.key')).toBe('Hello World');
	});

	it('read for an unknown key returns undefined', () => {
		const stubPlayer = new StubPlayer();

		expect(stubPlayer.translation('en', 'no.such.key')).toBeUndefined();
	});

	it('write in one language does not affect another', () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.translation('en', 'greet', 'Hello');
		stubPlayer.translation('fr', 'greet', 'Bonjour');

		expect(stubPlayer.translation('en', 'greet')).toBe('Hello');
		expect(stubPlayer.translation('fr', 'greet')).toBe('Bonjour');
	});

	it('overwrite replaces the previous value', () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.translation('en', 'my.key', 'v1');
		stubPlayer.translation('en', 'my.key', 'v2');

		expect(stubPlayer.translation('en', 'my.key')).toBe('v2');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// removeTranslations() — prefix removal
// ─────────────────────────────────────────────────────────────────────────────

describe('i18n mixin — removeTranslations() by prefix', () => {
	it('removes all keys with the matching prefix from a specific language', () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.addTranslations({
			en: {
				'plugin.test.a': 'A',
				'plugin.test.b': 'B',
				'other.key': 'C',
			},
		});

		stubPlayer.removeTranslations('plugin.test', 'en');

		expect(stubPlayer.translation('en', 'plugin.test.a')).toBeUndefined();
		expect(stubPlayer.translation('en', 'plugin.test.b')).toBeUndefined();
		expect(stubPlayer.translation('en', 'other.key')).toBe('C');
	});

	it('removeTranslations without lang removes from all languages', () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.addTranslations({
			en: { 'plugin.x.key': 'en-val' },
			fr: { 'plugin.x.key': 'fr-val' },
		});

		stubPlayer.removeTranslations('plugin.x');

		expect(stubPlayer.translation('en', 'plugin.x.key')).toBeUndefined();
		expect(stubPlayer.translation('fr', 'plugin.x.key')).toBeUndefined();
	});

	it('keys not matching the prefix are retained', () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.addTranslations({
			en: {
				'plugin.a.key': 'a',
				'plugin.b.key': 'b',
			},
		});

		stubPlayer.removeTranslations('plugin.a', 'en');

		expect(stubPlayer.translation('en', 'plugin.b.key')).toBe('b');
	});

	it('no-op when prefix does not match any key', () => {
		const stubPlayer = new StubPlayer();
		stubPlayer.addTranslations({ en: { 'my.key': 'v' } });

		expect(() => stubPlayer.removeTranslations('nonexistent.prefix', 'en')).not.toThrow();
		expect(stubPlayer.translation('en', 'my.key')).toBe('v');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// auth mixin — refreshAuth()
// Uses real mixin player so _authConfig wiring is live.
// ─────────────────────────────────────────────────────────────────────────────

describe('auth mixin — refreshAuth()', () => {
	beforeEach(() => AuthMockPlayer._resetRegistry());
	afterEach(() => {
		AuthMockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('emits auth:refreshed when no refreshOnUnauthenticated handler is set', async () => {
		const authMockPlayer = makeAuthPlayer();
		authMockPlayer.setup({ auth: { credentials: 'include' } });
		await authMockPlayer.ready();

		const refreshEvents: unknown[] = [];
		authMockPlayer.on('auth:refreshed', (data: unknown) => refreshEvents.push(data));

		const refreshAuth = (authMockPlayer as unknown as { refreshAuth: () => Promise<void> }).refreshAuth;
		await refreshAuth.call(authMockPlayer);

		expect(refreshEvents.length).toBe(1);
	});

	it('calls the refreshOnUnauthenticated handler and emits auth:refreshed on success', async () => {
		const handler = vi.fn().mockResolvedValue(undefined);
		const authMockPlayer = makeAuthPlayer();
		authMockPlayer.setup({ auth: { credentials: 'include', refreshOnUnauthenticated: handler } });
		await authMockPlayer.ready();

		const refreshEvents: unknown[] = [];
		authMockPlayer.on('auth:refreshed', (data: unknown) => refreshEvents.push(data));

		const refreshAuth = (authMockPlayer as unknown as { refreshAuth: () => Promise<void> }).refreshAuth;
		await refreshAuth.call(authMockPlayer);

		expect(handler).toHaveBeenCalledTimes(1);
		expect(refreshEvents.length).toBe(1);
	});

	it('handler throws → emits auth:failed (does not throw)', async () => {
		const handler = vi.fn().mockRejectedValue(new Error('token refresh failed'));
		const authMockPlayer = makeAuthPlayer();
		authMockPlayer.setup({ auth: { credentials: 'include', refreshOnUnauthenticated: handler } });
		await authMockPlayer.ready();

		const failedEvents: unknown[] = [];
		authMockPlayer.on('auth:failed', (data: unknown) => failedEvents.push(data));

		const refreshAuth = (authMockPlayer as unknown as { refreshAuth: () => Promise<void> }).refreshAuth;
		await expect(refreshAuth.call(authMockPlayer)).resolves.toBeUndefined();
		expect(failedEvents.length).toBe(1);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// auth mixin — resolveUrl() defaultResolve with baseImageUrl in the real mixin
// (exercises the branch in auth.ts line 139 that StubPlayer duplicates separately)
// ─────────────────────────────────────────────────────────────────────────────

describe('auth mixin — resolveUrl() real mixin baseImageUrl branch', () => {
	beforeEach(() => AuthMockPlayer._resetRegistry());
	afterEach(() => {
		AuthMockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('defaultResolve in real mixin prepends baseImageUrl for poster with no custom resolver', async () => {
		const authMockPlayer = makeAuthPlayer();
		authMockPlayer.setup({ baseImageUrl: 'https://image.tmdb.org/t/p/w780' });
		await authMockPlayer.ready();

		const r = await authMockPlayer.resolveUrl('/poster.jpg', 'poster');

		expect((r as { relative: boolean }).relative).toBe(false);
		expect((r as { href: string }).href).toBe('https://image.tmdb.org/t/p/w780/poster.jpg');
	});

	it('defaultResolve fallback fires when custom resolver returns a non-object', async () => {
		const authMockPlayer = makeAuthPlayer();
		authMockPlayer.setup({ baseUrl: 'https://cdn.example.com/' });
		await authMockPlayer.ready();

		authMockPlayer.urlResolver(() => null as unknown as ReturnType<IUrlResolver>);

		const r = await authMockPlayer.resolveUrl('https://cdn.example.com/x.mp4', 'media');

		expect((r as { href: string }).href).toBe('https://cdn.example.com/x.mp4');
	});
});
