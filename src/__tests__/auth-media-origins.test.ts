// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * `auth.mediaOrigins` — the token goes on media requests to the listed origins
 * and nowhere else. The players ask the internal `_mediaAuthorization` per
 * request, so the tests ask the real mixin player the same question.
 */

import type { BaseEventMap, IUrlResolver, UrlResolverContext } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';

const instances = new Map<string, OriginMockPlayer>();

class OriginMockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = {} as HTMLElement;

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare auth: {
		(): Readonly<Record<string, unknown>> | undefined;
		(cfg: Record<string, unknown>): void;
	};

	declare _mediaAuthorization: (url: string) => string | undefined;

	declare resolveUrl: (url: string, category?: string) => Promise<{ href: string }>;
	declare urlResolver: (resolver: IUrlResolver | undefined) => void;

	constructor(id?: string | number) {
		super();
		const resolved = resolvePlayerConstructor(id, instances, 'OriginMockPlayer');
		if (resolved.kind === 'existing') {
			return resolved.instance as unknown as this;
		}
		initPlayerCoreState(this, { className: 'OriginMockPlayer' });
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		instances.set(resolved.id, this);
	}

	static _resetRegistry(): void {
		instances.clear();
	}
}

composeMixins(OriginMockPlayer.prototype, ...playerCoreMethods);

const OURS = 'https://media.example.test';

let divCounter = 0;
function makePlayer(auth: Record<string, unknown>): OriginMockPlayer {
	const id = `origin-player-${divCounter++}`;
	const div = document.createElement('div');
	div.id = id;
	document.body.appendChild(div);
	return new OriginMockPlayer(id).setup({ auth });
}

function mediaAuthorizationOf(player: OriginMockPlayer): (url: string) => string | undefined {
	return (url: string) => player._mediaAuthorization(url);
}

// Every function the public auth snapshot exposes, asked for a listed url.
function publicAnswers(player: OriginMockPlayer, url: string): unknown[] {
	const snapshot = player.auth() ?? {};
	return Object.values(snapshot).flatMap((value) => {
		if (typeof value !== 'function')
			return [];
		try {
			return [value(url)];
		}
		catch {
			return [];
		}
	});
}

describe('auth.mediaOrigins', () => {
	beforeEach(() => OriginMockPlayer._resetRegistry());
	afterEach(() => {
		OriginMockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('sends the bearer to a listed origin', () => {
		const player = makePlayer({ bearerToken: 'tok-1', mediaOrigins: `${OURS}/` });

		expect(mediaAuthorizationOf(player)(`${OURS}/api/v1/music/track.m3u8`)).toBe('Bearer tok-1');
	});

	it('sends nothing to another origin', () => {
		const player = makePlayer({ bearerToken: 'tok-1', mediaOrigins: OURS });

		expect(mediaAuthorizationOf(player)('https://ice1.radio.example.test/stream-128-mp3')).toBeUndefined();
		expect(mediaAuthorizationOf(player)('https://cdn.stranger.test/segment-1.ts')).toBeUndefined();
	});

	it('will not match a host that merely ends in a listed one', () => {
		const player = makePlayer({ bearerToken: 'tok-1', mediaOrigins: OURS });

		expect(mediaAuthorizationOf(player)('https://media.example.test.attacker.test/x.ts')).toBeUndefined();
	});

	it('treats a different scheme or port as a different origin', () => {
		const player = makePlayer({ bearerToken: 'tok-1', mediaOrigins: OURS });

		expect(mediaAuthorizationOf(player)('http://media.example.test/x.ts')).toBeUndefined();
		expect(mediaAuthorizationOf(player)('https://media.example.test:8443/x.ts')).toBeUndefined();
	});

	it('sends nothing when the url cannot be parsed', () => {
		const player = makePlayer({ bearerToken: 'tok-1', mediaOrigins: OURS });

		expect(mediaAuthorizationOf(player)('http://[::1')).toBeUndefined();
	});

	it('takes a list of origins and a getter that is read per request', () => {
		let current: string[] | undefined = [OURS, 'https://second.example.test'];
		const player = makePlayer({ bearerToken: 'tok-1', mediaOrigins: () => current });
		const rule = mediaAuthorizationOf(player);

		expect(rule('https://second.example.test/a.ts')).toBe('Bearer tok-1');

		current = undefined;

		expect(rule('https://second.example.test/a.ts')).toBeUndefined();
	});

	it('reads the token per request, so a refreshed token reaches the next one', () => {
		let token: string | undefined = 'tok-1';
		const player = makePlayer({ bearerToken: () => token, mediaOrigins: OURS });
		const rule = mediaAuthorizationOf(player);

		expect(rule(`${OURS}/a.ts`)).toBe('Bearer tok-1');

		token = undefined;

		expect(rule(`${OURS}/a.ts`)).toBeUndefined();
	});

	it('sends nothing when the token getter is async, because media headers are synchronous', () => {
		const player = makePlayer({ bearerToken: async () => 'tok-1', mediaOrigins: OURS });

		expect(mediaAuthorizationOf(player)(`${OURS}/a.ts`)).toBeUndefined();
	});

	it('follows an origin list replaced with player.auth() after setup', () => {
		const player = makePlayer({ bearerToken: 'tok-1', mediaOrigins: 'https://old.example.test' });
		const rule = mediaAuthorizationOf(player);

		player.auth({ mediaOrigins: OURS });

		expect(rule(`${OURS}/a.ts`)).toBe('Bearer tok-1');
		expect(rule('https://old.example.test/a.ts')).toBeUndefined();
	});

	it('leaves an explicit mediaAuthorization in charge', () => {
		const player = makePlayer({
			bearerToken: 'tok-1',
			mediaOrigins: OURS,
			mediaAuthorization: () => 'Bearer custom',
		});

		expect(mediaAuthorizationOf(player)('https://elsewhere.example.test/a.ts')).toBe('Bearer custom');
	});

	it('sends nothing when no origin is configured', () => {
		const player = makePlayer({ bearerToken: 'tok-1' });

		expect(player._mediaAuthorization(`${OURS}/a.ts`)).toBeUndefined();
	});

	it('has no callable on the public auth object that returns the bearer for a listed origin', () => {
		const player = makePlayer({ bearerToken: 'tok-secret', mediaOrigins: OURS });

		const answers = publicAnswers(player, `${OURS}/a.ts`);

		expect(JSON.stringify(answers)).not.toContain('tok-secret');
		expect(Object.keys(player.auth() ?? {})).not.toContain('mediaAuthorization');
	});

	it('answers the old callback for a consumer that passes its own', () => {
		const player = makePlayer({
			bearerToken: 'tok-1',
			mediaOrigins: OURS,
			mediaAuthorization: (url: string) => (url.startsWith('https://only.example.test') ? 'Bearer only' : undefined),
		});

		expect(player._mediaAuthorization('https://only.example.test/a.ts')).toBe('Bearer only');
		expect(player._mediaAuthorization(`${OURS}/a.ts`)).toBeUndefined();
	});

	it('keeps the bearer out of the snapshot and out of a url resolver context', async () => {
		const player = makePlayer({ bearerToken: 'tok-1', mediaOrigins: OURS });
		await player.ready();

		expect((player.auth() as Record<string, unknown>)['bearerToken']).toBeUndefined();

		const seen: UrlResolverContext[] = [];
		player.urlResolver((url, ctx) => {
			seen.push(ctx);
			return ctx.defaultResolve(url);
		});
		await player.resolveUrl(`${OURS}/a.ts`, 'media');

		expect(Object.keys(seen[0]?.auth ?? {})).not.toContain('mediaAuthorization');
	});
});
