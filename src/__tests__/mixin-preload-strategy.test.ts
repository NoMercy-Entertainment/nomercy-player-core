// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slice 03 — consequence-pinning tests for `preloadStrategyMethods`.
 *
 * Pinned consequences:
 *  15. `setPreloadStrategy(fake)` causes `preloadStrategy()` to return the same
 *      object reference.
 *  16. `setTransitionStrategy(fake)` causes `transitionStrategy()` to return the
 *      same object reference.
 */

import type { BaseEventMap } from '../types';
import type { IPreloadStrategy, ITransitionStrategy, PreloadContext, TransitionContext, ITransitionBackend } from '../adapters/preload/default';
import type { BasePlaylistItem } from '../types';
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
	declare setPreloadStrategy: (strategy: IPreloadStrategy) => void;
	declare preloadStrategy: () => IPreloadStrategy;
	declare setTransitionStrategy: (strategy: ITransitionStrategy) => void;
	declare transitionStrategy: () => ITransitionStrategy;

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

function makeFakePreloadStrategy(): IPreloadStrategy {
	return {
		shouldPreload(_context: PreloadContext): boolean {
			return false;
		},
		assetsToPreload(_item: BasePlaylistItem) {
			return [];
		},
		cancel(): void {},
	};
}

function makeFakeTransitionStrategy(): ITransitionStrategy {
	return {
		shouldTransition(_context: PreloadContext): boolean {
			return false;
		},
		tick(_context: TransitionContext, _backend: ITransitionBackend | null): void {},
		start(_outgoing: BasePlaylistItem, _incoming: BasePlaylistItem, _backend: ITransitionBackend | null): void {},
		complete(_outgoing: BasePlaylistItem, _incoming: BasePlaylistItem): void {},
		cancel(_reason?: string): void {},
	};
}

describe('preloadStrategyMethods (slice 03)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('setPreloadStrategy(fake) causes preloadStrategy() to return the same object reference', () => {
		const player = makePlayer('preload-1');
		const fakeStrategy = makeFakePreloadStrategy();

		player.setPreloadStrategy(fakeStrategy);

		expect(player.preloadStrategy()).toBe(fakeStrategy);
	});

	it('setTransitionStrategy(fake) causes transitionStrategy() to return the same object reference', () => {
		const player = makePlayer('preload-2');
		const fakeStrategy = makeFakeTransitionStrategy();

		player.setTransitionStrategy(fakeStrategy);

		expect(player.transitionStrategy()).toBe(fakeStrategy);
	});
});
