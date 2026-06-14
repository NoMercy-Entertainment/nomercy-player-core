// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Smoke tests for the shared `CastSenderPlugin` in the kit.
 *
 * Library-specific behavior (music's `MusicTrackMediaMetadata`, video's
 * `TvShowMediaMetadata`) is exercised by the per-library extras tests; this
 * file just locks in the contract that the kit base ships:
 *   - Registers cleanly without a Cast SDK present.
 *   - `connect()` rejects with `BrowserPolicyError(core:policy/castUnavailable)`.
 *   - `disconnect()` is idempotent / no-op when the SDK is absent.
 *   - `isConnected()` defaults to `false`.
 *   - The plugin id and version statics are publishable.
 *   - Default subclass behavior — `GenericMediaMetadata` builder + the
 *     fallback content type — kicks in when no override is supplied.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { castSenderPlugin, CastSenderPlugin } from '../../plugins/cast-sender';
import { StubPlayer } from '../../testing/stub-player';

describe('CastSenderPlugin (kit base)', () => {
	let player: StubPlayer;

	beforeEach(() => {
		player = new StubPlayer();
		// JSDOM doesn't ship cast.framework — make sure no other test polluted it.
		(globalThis as any).cast = undefined;
		(globalThis as any).chrome = undefined;
	});

	afterEach(() => {
		(globalThis as any).cast = undefined;
		(globalThis as any).chrome = undefined;
	});

	const wire = (): CastSenderPlugin => {
		const plugin = new CastSenderPlugin();
		const lifecycle = { addCleanup: vi.fn(), listen: vi.fn(), timeout: vi.fn(), interval: vi.fn(), frame: vi.fn(), abortable: vi.fn() } as any;
		plugin.initialize(player as any, {} as any, lifecycle);
		plugin.use();
		return plugin;
	};

	it('exposes stable plugin metadata', () => {
		expect(CastSenderPlugin.id).toBe('cast-sender');
		expect(CastSenderPlugin.version).toBe('2.0.0');
		expect(typeof CastSenderPlugin.description).toBe('string');
		expect(castSenderPlugin).toBe(CastSenderPlugin);
	});

	it('isConnected() defaults to false', () => {
		const plugin = wire();
		expect(plugin.isConnected()).toBe(false);
	});

	it('connect() rejects with BrowserPolicyError when cast.framework is absent', async () => {
		const plugin = wire();
		let err: unknown;
		try {
			await plugin.connect();
		}
		catch (e) {
			err = e;
		}
		expect(err).toBeDefined();
		expect((err as { code?: string }).code).toBe('core:policy/castUnavailable');
		expect(((err as { name?: string }).name)).toBe('BrowserPolicyError');
		expect(plugin.isConnected()).toBe(false);
	});

	it('disconnect() is a safe no-op when the SDK is absent', () => {
		const plugin = wire();
		expect(() => plugin.disconnect()).not.toThrow();
		expect(plugin.isConnected()).toBe(false);
	});

	it('exposes overridable hooks for subclasses', () => {
		// The hooks are protected — subclasses access them. Use a subclass
		// here to verify both can be overridden without changing the base
		// contract.
		class MySender extends CastSenderPlugin {
			static override readonly id: string = 'test-sender';

			protected override defaultContentType(): string {
				return 'audio/x-test';
			}

			// expose for assertion only
			callContentType(): string {
				return this.defaultContentType();
			}
		}
		const sub = new MySender();
		expect(sub.callContentType()).toBe('audio/x-test');
		// Default base sticks to a generic fallback.
		const base = new CastSenderPlugin();
		expect((base as unknown as { defaultContentType: () => string }).defaultContentType())
			.toBe('application/octet-stream');
	});
});
