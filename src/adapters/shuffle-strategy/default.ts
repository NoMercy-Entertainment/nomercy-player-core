import type { BasePlaylistItem } from '../../types';
import type { IShuffleStrategy } from './IShuffleStrategy';

/**
 * Default shuffle strategy — uniform Fisher-Yates shuffle. Every permutation
 * has equal probability. `currentIndex` is accepted but not used; the playing
 * item participates in the shuffle along with all other tracks.
 *
 * This is the verbatim algorithm that lived inside `MediaList.shuffle()` before
 * shuffle became pluggable.
 */
export class FisherYatesShuffle implements IShuffleStrategy {
	order<T extends BasePlaylistItem>(items: ReadonlyArray<T>, _currentIndex: number): T[] {
		const result = [...items];

		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[result[i], result[j]] = [result[j]!, result[i]!];
		}

		return result;
	}
}

/** Singleton default instance used when no custom strategy is supplied. */
export const fisherYatesShuffle = new FisherYatesShuffle();
