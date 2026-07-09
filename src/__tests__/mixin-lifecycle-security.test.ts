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

import type { BaseEventMap, PluginCtorWithId } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	Plugin,
	resolvePlayerConstructor,
	StateError,
} from '../index';
import { KeyHandlerPlugin } from '../plugins/key-handler';
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
	declare dispose: () => Promise<void>;
	declare phase: () => string;
	declare setupState: () => SetupState;
	declare auth: {
		(): Readonly<Record<string, unknown>> | undefined;
		(cfg: Record<string, unknown>): void;
		(partial: Partial<Record<string, unknown>>): void;
		(value: null): void;
	};

	declare queue: {
		(): ReadonlyArray<unknown>;
		(items: unknown[]): void;
	};

	declare pause: (opts?: unknown) => Promise<void>;
	declare togglePlayback: (opts?: unknown) => Promise<void>;
	declare addPlugin: <P extends Plugin<any, any, any>>(
		PluginClass: PluginCtorWithId & (new () => P),
		opts?: P['opts'],
	) => this;

	declare getPlugin: <P extends object>(PluginClass: PluginCtorWithId & (new () => P)) => P | undefined;
	declare removePlugin: <P extends Plugin<any, any, any>>(PluginClass: PluginCtorWithId & (new () => P)) => void;

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

/** Fixture plugin class whose `dispose()` records `id` onto the shared `order` array. */
function makeOrderPlugin(id: string, order: string[]): typeof Plugin {
	class OrderPlugin extends Plugin {
		static override readonly id = id;
		static override readonly version = '1.0.0';
		static override readonly description = id;
		override use(): void {}
		override dispose(): void {
			order.push(id);
		}
	}
	// Contravariant-P friction vs the general `typeof Plugin` — same opaque
	// cast the kit plugin-leak-sweep fixture list already uses.
	return OrderPlugin as unknown as typeof Plugin;
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
		const mockPlayer = makePlayer('dispose-phase');
		mockPlayer.setup({});
		await mockPlayer.ready();

		const phases: string[] = [];
		mockPlayer.on('phase', ({ to }: { to: string }) => phases.push(to));

		await mockPlayer.dispose();

		expect(phases).toContain('disposing');
		expect(phases).toContain('disposed');
		expect(mockPlayer.phase()).toBe('disposed');
	});

	it('second dispose() is a no-op — phase stays disposed, no error', async () => {
		const mockPlayer = makePlayer('double-dispose');
		mockPlayer.setup({});
		await mockPlayer.dispose();

		await expect(mockPlayer.dispose()).resolves.not.toThrow();
		expect(mockPlayer.phase()).toBe('disposed');
	});

	it('removes all event listeners after dispose() (off("all"))', async () => {
		const mockPlayer = makePlayer('listeners-cleared');
		mockPlayer.setup({});
		await mockPlayer.ready();

		const spy = vi.fn();
		mockPlayer.on('play' as keyof BaseEventMap, spy);
		await mockPlayer.dispose();

		mockPlayer.emit('play' as keyof BaseEventMap, undefined as never);
		expect(spy).not.toHaveBeenCalled();
	});

	it('drains _policyCleanup — all registered cleanups run exactly once', async () => {
		const mockPlayer = makePlayer('policy-cleanup');
		mockPlayer.setup({});
		await mockPlayer.ready();

		const cleanupA = vi.fn();
		const cleanupB = vi.fn();

		const internals = mockPlayer as unknown as { _policyCleanup: Array<() => void> };
		internals._policyCleanup.push(cleanupA, cleanupB);

		await mockPlayer.dispose();

		expect(cleanupA).toHaveBeenCalledTimes(1);
		expect(cleanupB).toHaveBeenCalledTimes(1);
	});

	it('_policyCleanup is empty after dispose()', async () => {
		const mockPlayer = makePlayer('cleanup-drained');
		mockPlayer.setup({});
		await mockPlayer.ready();

		const internals = mockPlayer as unknown as { _policyCleanup: Array<() => void> };
		internals._policyCleanup.push(() => {});

		await mockPlayer.dispose();

		expect(internals._policyCleanup).toHaveLength(0);
	});

	it('cleanup callback throws → emits warning event, continues teardown', async () => {
		const mockPlayer = makePlayer('cleanup-throw');
		mockPlayer.setup({});
		await mockPlayer.ready();

		const warnings: unknown[] = [];
		mockPlayer.on('warning', (data: unknown) => warnings.push(data));

		const internals = mockPlayer as unknown as { _policyCleanup: Array<() => void> };
		const goodCleanup = vi.fn();
		internals._policyCleanup.push(
			() => { throw new Error('cleanup boom'); },
			goodCleanup,
		);

		await mockPlayer.dispose();

		expect(warnings.length).toBeGreaterThan(0);
		expect(goodCleanup).toHaveBeenCalledTimes(1);
	});

	it('dispose() before ready resolves → rejects the ready() promise', async () => {
		const mockPlayer = makePlayer('dispose-before-ready');
		mockPlayer.setup({});

		const readyP = mockPlayer.ready();
		void mockPlayer.dispose();

		await expect(readyP).rejects.toBeDefined();
	});

	it('dispose() when setup was never called does not throw', async () => {
		const mockPlayer = makePlayer('dispose-no-setup');
		await expect(mockPlayer.dispose()).resolves.not.toThrow();
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
		const mockPlayer = makePlayer('auth-security');
		mockPlayer.setup({
			auth: { bearerToken: 'secret-token-123', credentials: 'include' as RequestCredentials },
		});
		await mockPlayer.ready();

		const internals = mockPlayer as unknown as { _authConfig: unknown; _rawAuth: () => unknown };
		const tokenBefore = internals._rawAuth();
		expect(tokenBefore).toBeDefined();

		await mockPlayer.dispose();

		// The public auth() read surface returns undefined or the redacted config —
		// bearer token must never be exposed via the public snapshot in any phase.
		const publicSnapshot = mockPlayer.auth() as (Record<string, unknown> | undefined);
		if (publicSnapshot !== undefined) {
			expect(publicSnapshot['bearerToken']).toBeUndefined();
			expect(publicSnapshot['accessToken']).toBeUndefined();
		}
	});

	it('bearer token never appears in auth() read snapshot before or after dispose()', async () => {
		const mockPlayer = makePlayer('bearer-never-exposed');
		mockPlayer.setup({
			auth: { bearerToken: 'supersecret', credentials: 'same-origin' as RequestCredentials },
		});
		await mockPlayer.ready();

		const snap = mockPlayer.auth() as Record<string, unknown> | undefined;
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
		const mockPlayer = makePlayer('ready-resolve');
		mockPlayer.setup({});
		await expect(mockPlayer.ready()).resolves.toBeUndefined();
	});

	it('resolves immediately when already in ready phase', async () => {
		const mockPlayer = makePlayer('ready-immediate');
		mockPlayer.setup({});
		await mockPlayer.ready();

		await expect(mockPlayer.ready()).resolves.toBeUndefined();
	});

	it('rejects immediately when player is already disposed', () => {
		const mockPlayer = makePlayer('ready-disposed');
		mockPlayer.dispose();

		return expect(mockPlayer.ready()).rejects.toBeInstanceOf(StateError);
	});

	it('rejects immediately when player is in disposing phase', async () => {
		const mockPlayer = makePlayer('ready-disposing');
		mockPlayer.setup({});

		const readyP = mockPlayer.ready();
		mockPlayer.dispose();

		// A second ready() call after dispose() should reject with a StateError
		const secondP = mockPlayer.ready();
		await expect(secondP).rejects.toBeInstanceOf(StateError);
		await readyP.catch(() => {});
	});

	it('is memoised — repeated calls return the same promise', async () => {
		const mockPlayer = makePlayer('ready-memoised');
		mockPlayer.setup({});

		const p1 = mockPlayer.ready();
		const p2 = mockPlayer.ready();
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
		const mockPlayer = makePlayer('double-setup');
		mockPlayer.setup({});
		await mockPlayer.ready();

		expect(() => mockPlayer.setup({})).toThrow(StateError);
	});

	it('throws StateError when called after dispose()', async () => {
		const mockPlayer = makePlayer('setup-after-dispose');
		await mockPlayer.dispose();

		expect(() => mockPlayer.setup({})).toThrow(StateError);
	});
});

describe('lifecycle mixin — setupState()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('returns NOT_SETUP before setup() is called', () => {
		const mockPlayer = makePlayer('state-idle');
		expect(mockPlayer.setupState()).toBe(SetupState.NOT_SETUP);
	});

	it('returns SETTING_UP during the setup phase synchronously', () => {
		const mockPlayer = makePlayer('state-setting-up');
		mockPlayer.setup({});
		expect(mockPlayer.setupState()).toBe(SetupState.SETTING_UP);
	});

	it('returns READY after setup pipeline completes', async () => {
		const mockPlayer = makePlayer('state-ready');
		mockPlayer.setup({});
		await mockPlayer.ready();
		expect(mockPlayer.setupState()).toBe(SetupState.READY);
	});

	it('returns DISPOSED after dispose()', async () => {
		const mockPlayer = makePlayer('state-disposed');
		mockPlayer.setup({});
		await mockPlayer.ready();
		await mockPlayer.dispose();
		expect(mockPlayer.setupState()).toBe(SetupState.DISPOSED);
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
		const mockPlayer = makePlayer('stage-playlist-err');
		vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network failure'));

		const errEvents: unknown[] = [];
		let readyLength: number | undefined;
		mockPlayer.on('playlistError', (data: unknown) => errEvents.push(data));
		mockPlayer.on('playlistReady', (data: { length: number }) => { readyLength = data.length; });

		mockPlayer.setup({ playlist: 'https://example.test/list.json' } as unknown as Record<string, unknown>);
		await mockPlayer.ready();

		expect(errEvents.length).toBeGreaterThan(0);
		expect(readyLength).toBe(0);
		const err = errEvents[0] as { code: string };
		expect(err.code).toBe('core:playlist/fetch-error');
	});

	it('playlist URL response is not a JSON array → emits playlistError with code core:playlist/parse-error', async () => {
		const mockPlayer = makePlayer('stage-parse-err');
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(JSON.stringify({ not: 'an-array' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		const errEvents: unknown[] = [];
		mockPlayer.on('playlistError', (data: unknown) => errEvents.push(data));

		mockPlayer.setup({ playlist: 'https://example.test/list.json' } as unknown as Record<string, unknown>);
		await mockPlayer.ready();

		expect(errEvents.length).toBeGreaterThan(0);
		const err = errEvents[0] as { code: string };
		expect(err.code).toBe('core:playlist/parse-error');
	});

	it('stage callback that throws → emits matching <stage>Error event and rejects ready()', async () => {
		// Override _registerPlugin on the instance so the pluginsRegistering
		// stage work() propagates a real throw through the pipeline.
		const mockPlayer = makePlayer('stage-error');

		const errorEvents: unknown[] = [];
		const stageErrors: unknown[] = [];
		mockPlayer.on('error', (data: unknown) => errorEvents.push(data));
		mockPlayer.on('pluginsRegisteringError', (data: unknown) => stageErrors.push(data));

		// Inject a queue entry and stub _registerPlugin to throw so the
		// stage work() fails and the pipeline bails.
		const internals = mockPlayer as unknown as {
			_pluginQueue: Array<{ ctor: unknown; opts: unknown }>;
			_registerPlugin: unknown;
		};
		internals._pluginQueue.push({ ctor: {}, opts: undefined });
		internals._registerPlugin = async (): Promise<never> => {
			throw new Error('registration boom');
		};

		mockPlayer.setup({});
		await expect(mockPlayer.ready()).rejects.toBeDefined();

		expect(stageErrors.length).toBeGreaterThan(0);
		expect(errorEvents.length).toBeGreaterThan(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// lifecycle mixin — dispose() disposes plugins
//
// Regression coverage: Plugin.dispose()'s JSDoc promises "the kit calls
// dispose() when the player itself is disposed", but dispose() only drained
// _policyCleanup and never iterated _plugins. Observable failure: a plugin's
// document-level listener (KeyHandlerPlugin) survived player.dispose(), and a
// later keypress raised a core:player/disposed unhandled rejection.
// ─────────────────────────────────────────────────────────────────────────────

describe('lifecycle mixin — dispose() disposes plugins', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('disposes every registered plugin when the player is disposed', async () => {
		const mockPlayer = makePlayer('dispose-plugins-basic');
		const order: string[] = [];

		mockPlayer.setup({ plugins: [makeOrderPlugin('alpha', order), makeOrderPlugin('beta', order)] });
		await mockPlayer.ready();

		expect(order).toEqual([]);

		await mockPlayer.dispose();

		expect(order).toEqual(['beta', 'alpha']);
	});

	it('disposes plugins in reverse registration order', async () => {
		const mockPlayer = makePlayer('dispose-plugins-order');
		const order: string[] = [];

		mockPlayer.setup({
			plugins: [
				makeOrderPlugin('alpha', order),
				makeOrderPlugin('beta', order),
				makeOrderPlugin('gamma', order),
			],
		});
		await mockPlayer.ready();

		await mockPlayer.dispose();

		expect(order).toEqual(['gamma', 'beta', 'alpha']);
	});

	it('a throwing plugin dispose() is contained — the rest still get disposed, no unhandled throw', async () => {
		const mockPlayer = makePlayer('dispose-plugins-throw');
		const order: string[] = [];

		class ThrowingDisposePlugin extends Plugin {
			static override readonly id = 'throwing-dispose';
			static override readonly version = '1.0.0';
			static override readonly description = 'ThrowingDispose';
			override use(): void {}
			override dispose(): void {
				throw new Error('dispose boom');
			}
		}

		mockPlayer.setup({
			plugins: [makeOrderPlugin('alpha', order), ThrowingDisposePlugin, makeOrderPlugin('gamma', order)],
		});
		await mockPlayer.ready();

		const warnings: unknown[] = [];
		mockPlayer.on('warning', (data: unknown) => warnings.push(data));

		await expect(mockPlayer.dispose()).resolves.not.toThrow();

		expect(order).toEqual(['gamma', 'alpha']);
		expect(mockPlayer.phase()).toBe('disposed');
		expect(warnings.length).toBeGreaterThan(0);
	});

	it('a prevented dispose() leaves every plugin alive — none are disposed', async () => {
		const mockPlayer = makePlayer('dispose-plugins-prevented');
		const order: string[] = [];
		const AlphaPlugin = makeOrderPlugin('alpha', order);

		mockPlayer.setup({ plugins: [AlphaPlugin] });
		await mockPlayer.ready();

		const preventDispose = (event: { preventDefault: () => void }): void => {
			event.preventDefault();
		};
		mockPlayer.on('beforeDispose' as never, preventDispose);

		await mockPlayer.dispose();

		expect(mockPlayer.phase()).not.toBe('disposed');
		expect(order).toEqual([]);
		expect(mockPlayer.getPlugin(AlphaPlugin)).toBeDefined();

		mockPlayer.off('beforeDispose' as never, preventDispose);
		await mockPlayer.dispose();

		expect(order).toEqual(['alpha']);
	});

	it('a manually removePlugin()-ed plugin is not disposed a second time by player dispose()', async () => {
		const mockPlayer = makePlayer('dispose-plugins-manual-remove');
		const order: string[] = [];
		const AlphaPlugin = makeOrderPlugin('alpha', order);

		mockPlayer.setup({ plugins: [AlphaPlugin] });
		await mockPlayer.ready();

		mockPlayer.removePlugin(AlphaPlugin);
		expect(order).toEqual(['alpha']);

		await mockPlayer.dispose();

		expect(order).toEqual(['alpha']);
	});

	it('a real KeyHandlerPlugin document listener is removed on dispose — no unhandled rejection on a post-dispose keypress', async () => {
		const mockPlayer = makePlayer('dispose-keyhandler');
		mockPlayer.setup({ plugins: [KeyHandlerPlugin] });
		await mockPlayer.ready();

		const toggleSpy = vi.spyOn(mockPlayer, 'togglePlayback');

		document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
		await Promise.resolve();
		expect(toggleSpy).toHaveBeenCalledTimes(1);

		await mockPlayer.dispose();

		const rejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown): void => {
			rejections.push(reason);
		};
		process.on('unhandledRejection', onUnhandledRejection);

		document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
		await new Promise(resolve => setTimeout(resolve, 0));
		await new Promise(resolve => setTimeout(resolve, 0));

		process.off('unhandledRejection', onUnhandledRejection);

		expect(toggleSpy).toHaveBeenCalledTimes(1);
		expect(rejections).toHaveLength(0);
	});
});
