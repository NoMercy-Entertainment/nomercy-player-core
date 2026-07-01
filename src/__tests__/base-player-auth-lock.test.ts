// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Auth-lock contract tests.
 *
 * Verifies that:
 *  1. `hasAuth()` returns false when no auth is configured, true after `auth(config)`.
 *  2. `auth(null)` clears auth so `hasAuth()` returns false.
 *  3. `auth()` returns a frozen snapshot — mutations to the returned object do not
 *     affect the internal state.
 *  4. The reactive getter pattern: `bearerToken: () => mutableRef.value` — the
 *     Authorization header reflects the current ref value per-request via `authFetch`.
 *  5. `auth()` NEVER exposes the bearer token — `bearerToken` is
 *     absent from the public snapshot regardless of whether it is a string or a function.
 *  6. The encapsulation proof (adversarial surface walk): the sentinel token cannot
 *     be reached through ANY public avenue — property enumeration, JSON serialisation,
 *     public method returns, emitted event payloads, or string coercion.
 *  7. POSITIVE control: the internal fetch pipeline DOES send the bearer header.
 */

import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	authFetch,
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';

const _instances = new Map<string, AuthMockPlayer>();

class AuthMockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = document.createElement('div');

	get id(): string {
		return this.playerId;
	}

	declare options: any;
	declare setup: (config: any) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare phase: () => string;
	declare dispatching: () => ReadonlyArray<string>;
	declare auth: { (): Readonly<any> | undefined; (cfg: any): void; (clear: null): void };
	declare hasAuth: () => boolean;

	// Stub out the large declare surface so composeMixins doesn't fail.
	declare baseUrl: any;
	declare audioContext: any;
	declare experimental: any;
	declare t: any;
	declare language: any;
	declare addTranslations: any;
	declare translation: any;
	declare removeTranslations: any;
	declare registerCueParser: any;
	declare unregisterCueParser: any;
	declare play: any;
	declare pause: any;
	declare stop: any;
	declare togglePlayback: any;
	declare next: any;
	declare previous: any;
	declare rewind: any;
	declare forward: any;
	declare restart: any;
	declare time: any;
	declare duration: any;
	declare buffered: any;
	declare timeData: any;
	declare playbackRate: any;
	declare playbackRates: any;
	declare volume: any;
	declare mute: any;
	declare unmute: any;
	declare toggleMute: any;
	declare volumeUp: any;
	declare volumeDown: any;
	declare playState: any;
	declare volumeState: any;
	declare repeatState: any;
	declare shuffleState: any;
	declare queue: any;
	declare queueAppend: any;
	declare queuePrepend: any;
	declare queueInsert: any;
	declare queueRemove: any;
	declare queueRemoveAt: any;
	declare queueMove: any;
	declare queueClear: any;
	declare queueShuffle: any;
	declare queueSort: any;
	declare peekNext: any;
	declare peekPrevious: any;
	declare queueLength: any;
	declare queueIndexOf: any;
	declare item: any;
	declare index: any;
	declare backlog: any;
	declare backlogAppend: any;
	declare backlogRemove: any;
	declare backlogClear: any;
	declare addPlugin: any;
	declare getPlugin: any;
	declare getPluginById: any;
	declare removePlugin: any;
	declare removePluginById: any;
	declare plugins: any;
	declare enabledPlugins: any;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'AuthMockPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'AuthMockPlayer');
		if (resolved.kind === 'existing') {
			return resolved.instance as unknown as this;
		}
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void {
		_instances.clear();
	}
}

composeMixins(AuthMockPlayer.prototype, ...playerCoreMethods);

function setupPlayer(): AuthMockPlayer {
	const div = document.createElement('div');
	div.id = 'auth-lock-test';
	document.body.appendChild(div);
	return new AuthMockPlayer('auth-lock-test').setup({});
}

describe('auth-lock contract', () => {
	beforeEach(() => {
		AuthMockPlayer._resetRegistry();
	});

	afterEach(() => {
		AuthMockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	describe('hasAuth / auth(null)', () => {
		it('hasAuth() returns false when no auth is configured', () => {
			const player = setupPlayer();
			expect(player.hasAuth()).toBe(false);
		});

		it('hasAuth() returns true after auth(config) is called', () => {
			const player = setupPlayer();
			player.auth({ bearerToken: 'tok' });
			expect(player.hasAuth()).toBe(true);
		});

		it('auth(null) clears auth so hasAuth() returns false', () => {
			const player = setupPlayer();
			player.auth({ bearerToken: 'tok' });
			expect(player.hasAuth()).toBe(true);
			player.auth(null);
			expect(player.hasAuth()).toBe(false);
		});

		it('auth(config) sets auth so hasAuth() returns true', () => {
			const player = setupPlayer();
			player.auth({ bearerToken: 'tok2' });
			expect(player.hasAuth()).toBe(true);
		});
	});

	describe('frozen snapshot', () => {
		it('auth() returns a frozen object', () => {
			const player = setupPlayer();
			player.auth({ bearerToken: 'original', credentials: 'include' });
			const snapshot = player.auth();
			expect(Object.isFrozen(snapshot)).toBe(true);
		});

		it('auth() snapshot does not contain bearerToken', () => {
			const player = setupPlayer();
			player.auth({ bearerToken: 'original', credentials: 'include' });
			expect(player.auth()?.['bearerToken']).toBeUndefined();
		});

		it('auth() snapshot retains non-secret fields', () => {
			const player = setupPlayer();
			player.auth({ bearerToken: 'tok', credentials: 'include', retryAfterRefresh: 2 });
			const snapshot = player.auth();
			expect(snapshot?.['credentials']).toBe('include');
			expect(snapshot?.['retryAfterRefresh']).toBe(2);
		});

		it('auth() returns undefined when no auth is configured', () => {
			const player = setupPlayer();
			expect(player.auth()).toBeUndefined();
		});
	});

	describe('reactive getter pattern', () => {
		it('bearerToken as a function: internal fetch path uses initial ref value', async () => {
			const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('ok', { status: 200 }));

			const tokenValue = 'initial-token';
			const player = setupPlayer();
			player.auth({ bearerToken: () => tokenValue });

			await authFetch({
				url: 'https://x/y',
				auth: (player as unknown as { _rawAuth: () => any })._rawAuth(),
				signal: new AbortController().signal,
			});

			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.headers.get('Authorization')).toBe('Bearer initial-token');

			fetchSpy.mockRestore();
		});

		it('bearerToken as a function: subsequent internal fetch calls see the mutated ref value', async () => {
			const fetchSpy = vi.spyOn(globalThis, 'fetch')
				.mockImplementation(async () => new Response('ok', { status: 200 })) as ReturnType<typeof vi.spyOn>;

			let tokenValue = 'first-token';
			const player = setupPlayer();
			player.auth({ bearerToken: () => tokenValue });

			const rawAuth = (player as unknown as { _rawAuth: () => any })._rawAuth();

			await authFetch({ url: 'https://x/y', auth: rawAuth, signal: new AbortController().signal });
			expect((fetchSpy.mock.calls[0]![0] as Request).headers.get('Authorization')).toBe('Bearer first-token');

			tokenValue = 'second-token';
			await authFetch({ url: 'https://x/y', auth: rawAuth, signal: new AbortController().signal });
			expect((fetchSpy.mock.calls[1]![0] as Request).headers.get('Authorization')).toBe('Bearer second-token');

			fetchSpy.mockRestore();
		});

		it('function-form bearerToken: JSON.stringify(auth()) does not contain the raw token string', () => {
			const player = setupPlayer();
			player.auth({ bearerToken: () => 'secret-token' });
			const snapshot = player.auth();
			const serialized = JSON.stringify(snapshot);
			expect(serialized).not.toContain('secret-token');
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Adversarial encapsulation proof
//
// Sets a known sentinel token as a plain string (the worst-case form — directly
// readable if it leaks). Then walks every public avenue a malicious or careless
// consumer could use to read the player surface, asserting the sentinel is absent
// from every path.
//
// POSITIVE control at the end: the internal fetch pipeline DOES send the token.
// ─────────────────────────────────────────────────────────────────────────────

const SENTINEL = 'SENTINEL_SECRET_TOKEN_xyz';

describe('token encapsulation — adversarial surface walk', () => {
	let player: AuthMockPlayer;

	beforeEach(() => {
		AuthMockPlayer._resetRegistry();
		player = setupPlayer();
		player.auth({ bearerToken: SENTINEL, credentials: 'include' });
	});

	afterEach(() => {
		AuthMockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	// ── Property enumeration ─────────────────────────────────────────────────

	it('Object.keys(player) values do not contain the sentinel', () => {
		const values = Object.keys(player).map(k => (player as unknown as Record<string, unknown>)[k]);
		for (const v of values) {
			expect(String(v ?? '')).not.toContain(SENTINEL);
		}
	});

	it('Object.getOwnPropertyNames(player) values do not contain the sentinel', () => {
		const names = Object.getOwnPropertyNames(player);
		for (const name of names) {
			const descriptor = Object.getOwnPropertyDescriptor(player, name);
			if (descriptor && 'value' in descriptor) {
				const v = descriptor.value;
				if (typeof v === 'string') {
					expect(v).not.toContain(SENTINEL);
				}
			}
		}
	});

	it('prototype chain property values do not expose the sentinel', () => {
		let proto = Object.getPrototypeOf(player) as Record<string, unknown> | null;
		while (proto !== null && proto !== Object.prototype) {
			for (const name of Object.getOwnPropertyNames(proto)) {
				const descriptor = Object.getOwnPropertyDescriptor(proto, name);
				if (descriptor && typeof descriptor.value === 'string') {
					expect(descriptor.value).not.toContain(SENTINEL);
				}
			}
			proto = Object.getPrototypeOf(proto) as Record<string, unknown> | null;
		}
	});

	// ── Serialisation ────────────────────────────────────────────────────────

	it('JSON.stringify(player) does not contain the sentinel', () => {
		let serialized: string;
		try {
			serialized = JSON.stringify(player);
		}
		catch {
			// A circular-reference error means no complete serialisation occurred —
			// the sentinel was not written to the output string.
			return;
		}
		expect(serialized).not.toContain(SENTINEL);
	});

	it('JSON.stringify(player.auth()) does not contain the sentinel', () => {
		expect(JSON.stringify(player.auth())).not.toContain(SENTINEL);
	});

	// ── Public getter methods ────────────────────────────────────────────────

	it('auth() snapshot has no bearerToken field', () => {
		const snapshot = player.auth();
		expect(snapshot).toBeDefined();
		expect((snapshot as Record<string, unknown>)['bearerToken']).toBeUndefined();
	});

	it('auth() snapshot string-ified does not contain the sentinel', () => {
		expect(JSON.stringify(player.auth() ?? {})).not.toContain(SENTINEL);
	});

	it('hasAuth() returns true but does not expose the sentinel', () => {
		expect(player.hasAuth()).toBe(true);
		expect(String(player.hasAuth())).not.toContain(SENTINEL);
	});

	// ── String coercion ──────────────────────────────────────────────────────

	it('String(player) does not contain the sentinel', () => {
		expect(String(player)).not.toContain(SENTINEL);
	});

	it('player.toString() does not contain the sentinel', () => {
		expect(player.toString()).not.toContain(SENTINEL);
	});

	// ── Event payloads ───────────────────────────────────────────────────────

	it('auth:refreshed event payload does not contain the sentinel', () => {
		const payloads: unknown[] = [];
		player.on('auth:refreshed', data => payloads.push(data));

		player.auth({ bearerToken: SENTINEL, credentials: 'omit' });

		for (const payload of payloads) {
			expect(JSON.stringify(payload ?? {})).not.toContain(SENTINEL);
		}
	});

	// ── POSITIVE CONTROL ─────────────────────────────────────────────────────
	// The internal fetch path MUST send the bearer header. This proves:
	//   (a) the sentinel we set is actually the active token, and
	//   (b) encapsulation did not accidentally break the feature.

	it('POSITIVE: internal fetch sends Authorization: Bearer <sentinel>', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		const rawAuth = (player as unknown as { _rawAuth: () => unknown })._rawAuth();

		await authFetch({
			url: 'https://media.example.com/stream.m3u8',
			auth: rawAuth as Parameters<typeof authFetch>[0]['auth'],
			signal: new AbortController().signal,
		});

		const req = fetchSpy.mock.calls[0]![0] as Request;
		expect(req.headers.get('Authorization')).toBe(`Bearer ${SENTINEL}`);

		fetchSpy.mockRestore();
	});
});
