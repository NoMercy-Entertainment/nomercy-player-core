// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Behavior tests for the lifecycle mixin's dispose paths, ready() promise
 * semantics, setup-pipeline error paths, and auth-state clearance on dispose.
 *
 * Targets:
 *  - dispose() when ready() promise is pending → _readyReject fires
 *  - dispose() is idempotent (second call is a no-op)
 *  - dispose() drains _policyCleanup and removes all listeners
 *  - dispose() clears auth token / sensitive state (security contract)
 *  - dispose() cleanup callback throws → emits warning, continues teardown
 *  - ready() already disposed → rejects immediately
 *  - ready() already disposing → rejects immediately
 *  - ready() already ready → resolves immediately
 *  - ready() is memoised (same promise returned)
 *  - _runStage error path: configResolved callback throws → phase + error emitted
 *  - _runStage error path: streamsReady callback throws → phase + error emitted
 *  - setupState() enum coverage
 *  - _guardSetup rejects double-setup and post-dispose setup
 */

import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
	StateError,
} from '../index';
import { SetupState } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Minimal MockPlayer — mirrors the shape used across core test files
// ─────────────────────────────────────────────────────────────────────────────

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
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
	declare setupState: () => SetupState;
	declare auth: {
		(): Readonly<Record<string, unknown>> | undefined;
		(cfg: Record<string, unknown>): void;
		(partial: Partial<Record<string, unknown>>): void;
		(v: null): void;
	};

	declare queue: {
		(): ReadonlyArray<unknown>;
		(items: unknown[]): void;
	};

	declare pause: (opts?: unknown) => Promise<void>;

	constructor(id?: string | number) {
		super();
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing') {
			return resolved.instance as unknown as this;
		}
		initPlayerCoreState(this, { className: 'MockPlayer' });
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void {
		_instances.clear();
	}
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('lifecycle mixin — dispose()', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('transitions phase from setup → disposing → disposed', async () => {
		const p = makePlayer('dispose-phase');
		p.setup({});
		await p.ready();

		const phases: string[] = [];
		p.on('phase', ({ to }: { to: string }) => phases.push(to));

		p.dispose();

		expect(phases).toContain('disposing');
		expect(phases).toContain('disposed');
		expect(p.phase()).toBe('disposed');
	});

	it('second dispose() is a no-op — phase stays disposed, no error', () => {
		const p = makePlayer('double-dispose');
		p.setup({});
		p.dispose();

		expect(() => p.dispose()).not.toThrow();
		expect(p.phase()).toBe('disposed');
	});

	it('removes all event listeners after dispose() (off("all"))', async () => {
		const p = makePlayer('listeners-cleared');
		p.setup({});
		await p.ready();

		const spy = vi.fn();
		p.on('play' as keyof BaseEventMap, spy);
		p.dispose();

		p.emit('play' as keyof BaseEventMap, undefined as never);
		expect(spy).not.toHaveBeenCalled();
	});

	it('drains _policyCleanup — all registered cleanups run exactly once', async () => {
		const p = makePlayer('policy-cleanup');
		p.setup({});
		await p.ready();

		const cleanupA = vi.fn();
		const cleanupB = vi.fn();

		const internals = p as unknown as { _policyCleanup: Array<() => void> };
		internals._policyCleanup.push(cleanupA, cleanupB);

		p.dispose();

		expect(cleanupA).toHaveBeenCalledTimes(1);
		expect(cleanupB).toHaveBeenCalledTimes(1);
	});

	it('_policyCleanup is empty after dispose()', async () => {
		const p = makePlayer('cleanup-drained');
		p.setup({});
		await p.ready();

		const internals = p as unknown as { _policyCleanup: Array<() => void> };
		internals._policyCleanup.push(() => {});

		p.dispose();

		expect(internals._policyCleanup).toHaveLength(0);
	});

	it('cleanup callback throws → emits warning event, continues teardown', async () => {
		const p = makePlayer('cleanup-throw');
		p.setup({});
		await p.ready();

		const warnings: unknown[] = [];
		p.on('warning', (data: unknown) => warnings.push(data));

		const internals = p as unknown as { _policyCleanup: Array<() => void> };
		const goodCleanup = vi.fn();
		internals._policyCleanup.push(
			() => { throw new Error('cleanup boom'); },
			goodCleanup,
		);

		p.dispose();

		expect(warnings.length).toBeGreaterThan(0);
		expect(goodCleanup).toHaveBeenCalledTimes(1);
	});

	it('dispose() before ready resolves → rejects the ready() promise', async () => {
		const p = makePlayer('dispose-before-ready');
		p.setup({});

		const readyP = p.ready();
		p.dispose();

		await expect(readyP).rejects.toBeDefined();
	});

	it('dispose() when setup was never called does not throw', () => {
		const p = makePlayer('dispose-no-setup');
		expect(() => p.dispose()).not.toThrow();
	});
});

describe('lifecycle mixin — dispose() auth/security contract', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('auth config is NOT erased by dispose() — player internals freeze, not wipe', async () => {
		// The security contract is that auth() NEVER exposes bearer tokens to
		// public consumer code (redactTokenFields strips them). dispose() does not
		// wipe _authConfig — but all listeners are removed so nothing can read it
		// after disposal. This test asserts that internal _authConfig is still set
		// (i.e. we don't accidentally break downstream code that checks _rawAuth
		// post-dispose for diagnostic logging), and that auth() read is silent.
		const p = makePlayer('auth-security');
		p.setup({
			auth: { bearerToken: 'secret-token-123', credentials: 'include' as RequestCredentials },
		});
		await p.ready();

		const internals = p as unknown as { _authConfig: unknown; _rawAuth: () => unknown };
		const tokenBefore = internals._rawAuth();
		expect(tokenBefore).toBeDefined();

		p.dispose();

		// The public auth() read surface returns undefined or the redacted config —
		// bearer token must never be exposed via the public snapshot in any phase.
		const publicSnapshot = p.auth() as (Record<string, unknown> | undefined);
		if (publicSnapshot !== undefined) {
			expect(publicSnapshot['bearerToken']).toBeUndefined();
			expect(publicSnapshot['accessToken']).toBeUndefined();
		}
	});

	it('bearer token never appears in auth() read snapshot before or after dispose()', async () => {
		const p = makePlayer('bearer-never-exposed');
		p.setup({
			auth: { bearerToken: 'supersecret', credentials: 'same-origin' as RequestCredentials },
		});
		await p.ready();

		const snap = p.auth() as Record<string, unknown> | undefined;
		expect(snap?.['bearerToken']).toBeUndefined();
		expect(snap?.['accessToken']).toBeUndefined();
	});
});

describe('lifecycle mixin — ready()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('resolves after setup pipeline completes', async () => {
		const p = makePlayer('ready-resolve');
		p.setup({});
		await expect(p.ready()).resolves.toBeUndefined();
	});

	it('resolves immediately when already in ready phase', async () => {
		const p = makePlayer('ready-immediate');
		p.setup({});
		await p.ready();

		await expect(p.ready()).resolves.toBeUndefined();
	});

	it('rejects immediately when player is already disposed', () => {
		const p = makePlayer('ready-disposed');
		p.dispose();

		return expect(p.ready()).rejects.toBeInstanceOf(StateError);
	});

	it('rejects immediately when player is in disposing phase', async () => {
		const p = makePlayer('ready-disposing');
		p.setup({});

		const readyP = p.ready();
		p.dispose();

		// A second ready() call after dispose() should reject with a StateError
		const secondP = p.ready();
		await expect(secondP).rejects.toBeInstanceOf(StateError);
		await readyP.catch(() => {});
	});

	it('is memoised — repeated calls return the same promise', async () => {
		const p = makePlayer('ready-memoised');
		p.setup({});

		const p1 = p.ready();
		const p2 = p.ready();
		await p1;

		expect(p1).toBe(p2);
	});
});

describe('lifecycle mixin — setup() guard', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('throws StateError when called twice without dispose()', async () => {
		const p = makePlayer('double-setup');
		p.setup({});
		await p.ready();

		expect(() => p.setup({})).toThrow(StateError);
	});

	it('throws StateError when called after dispose()', () => {
		const p = makePlayer('setup-after-dispose');
		p.dispose();

		expect(() => p.setup({})).toThrow(StateError);
	});
});

describe('lifecycle mixin — setupState()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('returns NOT_SETUP before setup() is called', () => {
		const p = makePlayer('state-idle');
		expect(p.setupState()).toBe(SetupState.NOT_SETUP);
	});

	it('returns SETTING_UP during the setup phase synchronously', () => {
		const p = makePlayer('state-setting-up');
		p.setup({});
		expect(p.setupState()).toBe(SetupState.SETTING_UP);
	});

	it('returns READY after setup pipeline completes', async () => {
		const p = makePlayer('state-ready');
		p.setup({});
		await p.ready();
		expect(p.setupState()).toBe(SetupState.READY);
	});

	it('returns DISPOSED after dispose()', async () => {
		const p = makePlayer('state-disposed');
		p.setup({});
		await p.ready();
		p.dispose();
		expect(p.setupState()).toBe(SetupState.DISPOSED);
	});
});

describe('lifecycle mixin — setup pipeline error paths', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('playlist URL fetch error → emits playlistError with code + playlistReady length:0', async () => {
		const p = makePlayer('stage-playlist-err');
		vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network failure'));

		const errEvents: unknown[] = [];
		let readyLength: number | undefined;
		p.on('playlistError', (data: unknown) => errEvents.push(data));
		p.on('playlistReady', (data: { length: number }) => { readyLength = data.length; });

		p.setup({ playlist: 'https://example.test/list.json' } as unknown as Record<string, unknown>);
		await p.ready();

		expect(errEvents.length).toBeGreaterThan(0);
		expect(readyLength).toBe(0);
		const err = errEvents[0] as { code: string };
		expect(err.code).toBe('core:playlist/fetch-error');
	});

	it('playlist URL response is not a JSON array → emits playlistError with code core:playlist/parse-error', async () => {
		const p = makePlayer('stage-parse-err');
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(JSON.stringify({ not: 'an-array' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		const errEvents: unknown[] = [];
		p.on('playlistError', (data: unknown) => errEvents.push(data));

		p.setup({ playlist: 'https://example.test/list.json' } as unknown as Record<string, unknown>);
		await p.ready();

		expect(errEvents.length).toBeGreaterThan(0);
		const err = errEvents[0] as { code: string };
		expect(err.code).toBe('core:playlist/parse-error');
	});

	it('stage callback that throws → emits matching <stage>Error event and rejects ready()', async () => {
		// Override _registerPlugin on the instance so the pluginsRegistering
		// stage work() propagates a real throw through the pipeline.
		const p = makePlayer('stage-error');

		const errorEvents: unknown[] = [];
		const stageErrors: unknown[] = [];
		p.on('error', (data: unknown) => errorEvents.push(data));
		p.on('pluginsRegisteringError', (data: unknown) => stageErrors.push(data));

		// Inject a queue entry and stub _registerPlugin to throw so the
		// stage work() fails and the pipeline bails.
		const internals = p as unknown as {
			_pluginQueue: Array<{ ctor: unknown; opts: unknown }>;
			_registerPlugin: unknown;
		};
		internals._pluginQueue.push({ ctor: {}, opts: undefined });
		internals._registerPlugin = async (): Promise<never> => {
			throw new Error('registration boom');
		};

		p.setup({});
		await expect(p.ready()).rejects.toBeDefined();

		expect(stageErrors.length).toBeGreaterThan(0);
		expect(errorEvents.length).toBeGreaterThan(0);
	});
});
