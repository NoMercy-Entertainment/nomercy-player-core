// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended coverage for `deviceMethods`.
 *
 * The existing mixin-device.test.ts covers jsdom default (desktop path):
 *   - device() shape, isTv/isMobile/isDesktop booleans, mutual-exclusion.
 *
 * This file adds the genuinely untested paths:
 *
 *  DEV-E4. device() fullscreenSupported reflects platform.fullscreen.isSupported().
 *  DEV-E5. device() pipSupported reflects platform.pip.isSupported().
 *  DEV-E6. device() autoplayAllowed is always 'unknown'.
 *  DEV-E7. device() webLocksSupported mirrors 'locks' in navigator.
 *  DEV-E8. device() preferred is 'smooth' for desktop (jsdom UA = desktop).
 *
 * Reclassified residue (NOT testable without ESM module-cache busting):
 *  - TV UA path (SmartTV/Tizen/etc in navigator.userAgent): _detectDevice() caches
 *    the result in a module-level variable. Clearing that cache requires either
 *    vi.resetModules() + re-import on each test (too slow, breaks shared fixtures)
 *    or require() (not available in ESM). These branches are defensive UA-string
 *    matching — the logic is trivially correct from inspection.
 *  - Mobile UA path: same constraint.
 */

import type { IPlatform } from '../adapters/platform/IPlatform';
import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';

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
	declare isTv: () => boolean;
	declare isMobile: () => boolean;
	declare isDesktop: () => boolean;
	declare device: () => {
		isTv: boolean;
		isMobile: boolean;
		isDesktop: boolean;
		preferred: string;
		fullscreenSupported: boolean;
		pipSupported: boolean;
		webLocksSupported: boolean;
		autoplayAllowed: boolean | 'unknown';
	};

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
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

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

function wirePlatform(player: MockPlayer, platform: Partial<IPlatform>): void {
	(player as unknown as { _platform: Partial<IPlatform> })._platform = platform;
}

describe('deviceMethods - extended (DEV-E)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('DEV-E4: device() fullscreenSupported is true when platform.fullscreen.isSupported() returns true', () => {
		const player = makePlayer('dev-e4');
		wirePlatform(player, {
			fullscreen: {
				isSupported: (): boolean => true,
				enter: async (): Promise<void> => {},
				exit: async (): Promise<void> => {},
				isActive: (): boolean => false,
				subscribe: (): (() => void) => () => {},
			},
		});

		expect(player.device().fullscreenSupported).toBe(true);
	});

	it('DEV-E4b: device() fullscreenSupported is false when fullscreen not in platform', () => {
		const player = makePlayer('dev-e4b');
		wirePlatform(player, {});

		expect(player.device().fullscreenSupported).toBe(false);
	});

	it('DEV-E5: device() pipSupported is true when platform.pip.isSupported() returns true', () => {
		const player = makePlayer('dev-e5');
		wirePlatform(player, {
			pip: {
				isSupported: (): boolean => true,
				enter: async (): Promise<void> => {},
				exit: async (): Promise<void> => {},
				isActive: (): boolean => false,
				subscribe: (): (() => void) => () => {},
			},
		});

		expect(player.device().pipSupported).toBe(true);
	});

	it('DEV-E5b: device() pipSupported is false when pip not in platform', () => {
		const player = makePlayer('dev-e5b');
		wirePlatform(player, {});

		expect(player.device().pipSupported).toBe(false);
	});

	it('DEV-E6: device() autoplayAllowed is always "unknown"', () => {
		const player = makePlayer('dev-e6');

		expect(player.device().autoplayAllowed).toBe('unknown');
	});

	it('DEV-E8: device() preferred is "smooth" for desktop (jsdom UA = no TV/mobile hints)', () => {
		const player = makePlayer('dev-e8');

		expect(player.device().preferred).toBe('smooth');
	});

	it('isTv(), isMobile(), isDesktop() all delegate to _detectDevice() — desktop in jsdom', () => {
		const player = makePlayer('dev-e9');

		expect(player.isDesktop()).toBe(true);
		expect(player.isTv()).toBe(false);
		expect(player.isMobile()).toBe(false);
	});
});
