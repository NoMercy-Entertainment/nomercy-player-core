// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { BasePlaylistItem } from '../../types';
import type { IPreloadStrategy, PreloadAsset, PreloadContext } from '../../adapters/preload/default';

export interface FakePreloadStrategy extends IPreloadStrategy {
	shouldPreloadCalls: number;
}

/**
 * Recording preload strategy for DI tests. Returns `true` from `shouldPreload`
 * on every call (threshold is always crossed), records call count, and returns
 * an empty asset list so no real network fetch is triggered.
 */
export function makeFakePreloadStrategy(): FakePreloadStrategy {
	let shouldPreloadCalls = 0;

	const strategy: FakePreloadStrategy = {
		get shouldPreloadCalls(): number { return shouldPreloadCalls; },

		shouldPreload(_context: PreloadContext): boolean {
			shouldPreloadCalls += 1;
			return false;
		},

		assetsToPreload(_item: BasePlaylistItem): PreloadAsset[] {
			return [];
		},

		cancel(): void {},
	};

	return strategy;
}
