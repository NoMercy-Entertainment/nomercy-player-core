// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { BasePlaylistItem } from '../../types';

/**
 * Pluggable shuffle strategy. Controls the permutation applied when the player
 * shuffles its queue.
 *
 * The contract is intentionally minimal — implement `order()` and you are done.
 * `currentIndex` lets a strategy pin the currently-playing item at position 0
 * and shuffle only the upcoming tracks, or implement any other cursor-aware
 * ordering.
 *
 * The cursor-follow logic (finding the playing item's new index after the
 * permutation and updating the queue pointer) is owned by `MediaList` so it
 * works correctly for any implementation. Strategy authors write only the
 * permutation.
 *
 * Inject via `setup({ shuffleStrategy: new MyStrategy() })`. Omit to use the
 * default `FisherYatesShuffle`.
 */
export interface IShuffleStrategy {
	/**
	 * Return a permutation of `items` — same items, no drops, no duplicates.
	 *
	 * @param items        The current queue contents, read-only.
	 * @param currentIndex Zero-based index of the playing item, or `-1` when
	 *                     no item is active (empty queue or before first load).
	 */
	order<T extends BasePlaylistItem>(items: ReadonlyArray<T>, currentIndex: number): T[];
}
