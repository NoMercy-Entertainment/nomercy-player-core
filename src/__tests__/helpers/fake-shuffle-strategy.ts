// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { BasePlaylistItem } from '../../types';
import type { IShuffleStrategy } from '../../adapters/shuffle-strategy/IShuffleStrategy';

export interface FakeShuffleStrategy extends IShuffleStrategy {
	shuffleCalled: boolean;
}

/**
 * Recording shuffle strategy for DI tests. Records when `order()` is called
 * and returns the items in reversed order so tests can assert both that the
 * strategy was called AND that its result was used.
 */
export function makeFakeShuffleStrategy(): FakeShuffleStrategy {
	let shuffleCalled = false;

	const strategy: FakeShuffleStrategy = {
		get shuffleCalled(): boolean { return shuffleCalled; },

		order<T extends BasePlaylistItem>(items: ReadonlyArray<T>, _currentIndex: number): T[] {
			shuffleCalled = true;
			return [...items].reverse();
		},
	};

	return strategy;
}
