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
 *  5. When `bearerToken` is a function, `JSON.stringify(player.auth())` does NOT
 *     serialize a raw token string — functions are stripped by JSON.stringify.
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
		it('auth() returns a frozen object — direct mutation has no effect', () => {
			const player = setupPlayer();
			player.auth({ bearerToken: 'original' });
			const snapshot = player.auth();
			expect(Object.isFrozen(snapshot)).toBe(true);

			// Attempting to mutate — strict mode throws, non-strict silently ignores.
			try {
				(snapshot as any).bearerToken = 'mutated';
			}
			catch {
				// expected in strict mode
			}

			// Internal state must be unchanged.
			expect(player.auth()?.['bearerToken']).toBe('original');
		});

		it('auth() returns undefined when no auth is configured', () => {
			const player = setupPlayer();
			expect(player.auth()).toBeUndefined();
		});
	});

	describe('reactive getter pattern', () => {
		it('bearerToken as a function: first authFetch call uses initial ref value', async () => {
			const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('ok', { status: 200 }));

			const tokenValue = 'initial-token';
			const player = setupPlayer();
			player.auth({ bearerToken: () => tokenValue });

			await authFetch({
				url: 'https://x/y',
				auth: player.auth() as any,
				signal: new AbortController().signal,
			});

			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.headers.get('Authorization')).toBe('Bearer initial-token');

			fetchSpy.mockRestore();
		});

		it('bearerToken as a function: subsequent calls see the mutated ref value', async () => {
			const fetchSpy = vi.spyOn(globalThis, 'fetch')
				.mockImplementation(async () => new Response('ok', { status: 200 })) as ReturnType<typeof vi.spyOn>;

			let tokenValue = 'first-token';
			const player = setupPlayer();
			player.auth({ bearerToken: () => tokenValue });

			const authConfig = player.auth() as any;

			await authFetch({ url: 'https://x/y', auth: authConfig, signal: new AbortController().signal });
			expect((fetchSpy.mock.calls[0]![0] as Request).headers.get('Authorization')).toBe('Bearer first-token');

			tokenValue = 'second-token';
			await authFetch({ url: 'https://x/y', auth: authConfig, signal: new AbortController().signal });
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
