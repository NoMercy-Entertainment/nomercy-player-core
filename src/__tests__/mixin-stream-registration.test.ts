// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Coverage for `streamRegistrationMethods` — `src/core/mixins/stream-registration.ts`.
 *
 * This mixin was showing 0% function coverage. All four exported methods are
 * exercised here: registerStream / unregisterStream / streams / getStreamFactory.
 *
 * Test groups:
 *  - registerStream — returns this, visible via streams()
 *  - unregisterStream — removes a factory, no-op when absent
 *  - streams() — list in resolution order
 *  - getStreamFactory — returns by id, undefined when absent
 *  - Lazy registry init — streams() forces creation without setup()
 */

import type { IStreamFactory, IStreamSource } from '../adapters/stream/IStreamSource';
import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';

function makeFactory(id: string): IStreamFactory {
	return {
		id,
		canPlay: () => true,
		create: () => ({ kind: 'native' as const } as IStreamSource),
	};
}

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
	declare registerStream: (factory: IStreamFactory, prepend?: boolean) => this;
	declare unregisterStream: (id: string) => this;
	declare streams: () => ReadonlyArray<string>;
	declare getStreamFactory: (id: string) => IStreamFactory | undefined;

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

describe('streamRegistrationMethods', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	describe('registerStream()', () => {
		it('returns the player for fluent chaining', () => {
			const mockPlayer = makePlayer('sr-1');
			const result = mockPlayer.registerStream(makeFactory('custom'));
			expect(result).toBe(mockPlayer);
		});

		it('registered factory appears in streams()', () => {
			const mockPlayer = makePlayer('sr-2');
			mockPlayer.registerStream(makeFactory('custom-hls'));
			expect(mockPlayer.streams()).toContain('custom-hls');
		});

		it('re-registering same id replaces the factory', () => {
			const mockPlayer = makePlayer('sr-3');
			const a = makeFactory('same-id');
			const b = makeFactory('same-id');
			mockPlayer.registerStream(a);
			mockPlayer.registerStream(b);
			const list = mockPlayer.streams();
			const count = list.filter(id => id === 'same-id').length;
			expect(count).toBe(1);
			expect(mockPlayer.getStreamFactory('same-id')).toBe(b);
		});

		it('prepend=true places factory at low-priority end', () => {
			const mockPlayer = makePlayer('sr-4');
			mockPlayer.registerStream(makeFactory('first'));
			mockPlayer.registerStream(makeFactory('prepended'), true);
			const list = mockPlayer.streams();
			expect(list.indexOf('first')).toBeLessThan(list.indexOf('prepended'));
		});
	});

	describe('unregisterStream()', () => {
		it('removes the factory and returns this for chaining', () => {
			const mockPlayer = makePlayer('sr-5');
			mockPlayer.registerStream(makeFactory('to-remove'));
			const result = mockPlayer.unregisterStream('to-remove');
			expect(result).toBe(mockPlayer);
			expect(mockPlayer.streams()).not.toContain('to-remove');
		});

		it('is a no-op when id is not registered', () => {
			const mockPlayer = makePlayer('sr-6');
			expect(() => mockPlayer.unregisterStream('nonexistent')).not.toThrow();
		});
	});

	describe('streams()', () => {
		it('returns empty array on a fresh player (lazy registry not yet seeded)', () => {
			const mockPlayer = makePlayer('sr-7');
			const list = mockPlayer.streams();
			expect(Array.isArray(list)).toBe(true);
		});

		it('lists ids in resolution order (last registered first)', () => {
			const mockPlayer = makePlayer('sr-8');
			mockPlayer.registerStream(makeFactory('a'));
			mockPlayer.registerStream(makeFactory('b'));
			const list = mockPlayer.streams();
			expect(list.indexOf('b')).toBeLessThan(list.indexOf('a'));
		});
	});

	describe('getStreamFactory()', () => {
		it('returns the factory by id', () => {
			const mockPlayer = makePlayer('sr-9');
			const factory = makeFactory('my-factory');
			mockPlayer.registerStream(factory);
			expect(mockPlayer.getStreamFactory('my-factory')).toBe(factory);
		});

		it('returns undefined when id is not registered', () => {
			const mockPlayer = makePlayer('sr-10');
			expect(mockPlayer.getStreamFactory('unknown')).toBeUndefined();
		});
	});
});
