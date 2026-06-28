// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slice 03 — consequence-pinning tests for `deviceMethods`.
 *
 * Pinned consequences:
 *  4. `device()` returns an object with `{ isTv, isMobile, isDesktop, os }` fields;
 *     in jsdom `isDesktop` is `true` (no TV/mobile UA hints).
 *  5. `isTv()`, `isMobile()`, `isDesktop()` are booleans and are mutually exclusive
 *     (exactly one is `true` at any time).
 */

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
	container: HTMLElement = <HTMLElement>{};

	get id(): string {
		return this.playerId;
	}

	declare options: any;
	declare setup: (config: any) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare isTv: () => boolean;
	declare isMobile: () => boolean;
	declare isDesktop: () => boolean;
	declare device: () => { isTv: boolean; isMobile: boolean; isDesktop: boolean; preferred: string; fullscreenSupported: boolean; pipSupported: boolean; webLocksSupported: boolean; autoplayAllowed: boolean | 'unknown' };

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

describe('deviceMethods (slice 03)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('device() returns an object with isTv, isMobile, isDesktop, preferred, pipSupported fields; in jsdom isDesktop is true', () => {
		const player = makePlayer('device-1');

		const caps = player.device();

		expect(typeof caps.isTv).toBe('boolean');
		expect(typeof caps.isMobile).toBe('boolean');
		expect(typeof caps.isDesktop).toBe('boolean');
		expect(typeof caps.preferred).toBe('string');
		expect(typeof caps.pipSupported).toBe('boolean');

		expect(caps.isDesktop).toBe(true);
		expect(caps.isTv).toBe(false);
		expect(caps.isMobile).toBe(false);
	});

	it('isTv(), isMobile(), isDesktop() return booleans and exactly one is true in jsdom', () => {
		const player = makePlayer('device-2');

		const tv = player.isTv();
		const mobile = player.isMobile();
		const desktop = player.isDesktop();

		expect(typeof tv).toBe('boolean');
		expect(typeof mobile).toBe('boolean');
		expect(typeof desktop).toBe('boolean');

		const trueCount = [tv, mobile, desktop].filter(Boolean).length;
		expect(trueCount).toBe(1);

		expect(desktop).toBe(true);
		expect(tv).toBe(false);
		expect(mobile).toBe(false);
	});
});
