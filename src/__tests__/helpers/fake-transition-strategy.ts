// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { BasePlaylistItem } from '../../types';
import type {
	ITransitionBackend,
	ITransitionStrategy,
	PreloadContext,
	TransitionContext,
} from '../../adapters/preload/default';

export interface FakeTransitionStrategy extends ITransitionStrategy {
	shouldTransitionCalls: number;
}

/**
 * Recording transition strategy for DI tests. Records every call to
 * `shouldTransition` and always returns `false` so no transition animation
 * fires (keeps tests synchronous and free of RAF side-effects).
 */
export function makeFakeTransitionStrategy(): FakeTransitionStrategy {
	let shouldTransitionCalls = 0;

	const strategy: FakeTransitionStrategy = {
		get shouldTransitionCalls(): number { return shouldTransitionCalls; },

		shouldTransition(_context: PreloadContext): boolean {
			shouldTransitionCalls += 1;
			return false;
		},

		tick(_context: TransitionContext, _backend: ITransitionBackend | null): void {},

		start(
			_outgoing: BasePlaylistItem,
			_incoming: BasePlaylistItem,
			_backend: ITransitionBackend | null,
		): void {},

		complete(_from: BasePlaylistItem, _to: BasePlaylistItem): void {},

		cancel(_reason: string): void {},
	};

	return strategy;
}
