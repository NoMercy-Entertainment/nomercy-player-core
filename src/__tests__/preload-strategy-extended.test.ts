// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended coverage for `src/adapters/preload/default.ts`:
 *  - DefaultPreloadStrategy.shouldPreload — all branches
 *  - DefaultPreloadStrategy.assetsToPreload
 *  - DefaultPreloadStrategy.cancel
 *  - CrossfadeTransitionStrategy.shouldTransition
 *  - CrossfadeTransitionStrategy.tick — with backend, without, unsupported
 *  - CrossfadeTransitionStrategy.start / complete / cancel
 *  - CrossfadeTransitionStrategy._applyGainCurve both curves
 *  - GaplessTransitionStrategy all methods
 */

import type { BasePlaylistItem } from '../types';
import { describe, expect, it, vi } from 'vitest';
import {
	CrossfadeTransitionStrategy,
	DefaultPreloadStrategy,
	GaplessTransitionStrategy,
} from '../adapters/preload/default';

function item(id: string): BasePlaylistItem {
	return { id, url: `https://cdn.example.com/${id}.mp3` } as BasePlaylistItem;
}

// ── DefaultPreloadStrategy ────────────────────────────────────────────────────

describe('DefaultPreloadStrategy', () => {
	describe('shouldPreload()', () => {
		it('returns false when nextItem is null', () => {
			const defaultPreloadStrategy = new DefaultPreloadStrategy(10);
			expect(defaultPreloadStrategy.shouldPreload({ currentTime: 100, duration: 120, nextItem: null })).toBe(false);
		});

		it('returns false when duration is 0', () => {
			const defaultPreloadStrategy = new DefaultPreloadStrategy(10);
			expect(defaultPreloadStrategy.shouldPreload({ currentTime: 5, duration: 0, nextItem: item('a') })).toBe(false);
		});

		it('returns false when not within lead window', () => {
			const defaultPreloadStrategy = new DefaultPreloadStrategy(10);
			expect(defaultPreloadStrategy.shouldPreload({ currentTime: 50, duration: 120, nextItem: item('a') })).toBe(false);
		});

		it('returns true when within lead window', () => {
			const defaultPreloadStrategy = new DefaultPreloadStrategy(10);
			expect(defaultPreloadStrategy.shouldPreload({ currentTime: 111, duration: 120, nextItem: item('a') })).toBe(true);
		});

		it('returns true exactly at the lead boundary', () => {
			const defaultPreloadStrategy = new DefaultPreloadStrategy(10);
			expect(defaultPreloadStrategy.shouldPreload({ currentTime: 110, duration: 120, nextItem: item('a') })).toBe(true);
		});

		it('uses default leadSeconds of 10 when none given', () => {
			const defaultPreloadStrategy = new DefaultPreloadStrategy();
			expect(defaultPreloadStrategy.shouldPreload({ currentTime: 111, duration: 120, nextItem: item('a') })).toBe(true);
		});
	});

	describe('assetsToPreload()', () => {
		it('returns empty array by default', () => {
			const defaultPreloadStrategy = new DefaultPreloadStrategy(10);
			expect(defaultPreloadStrategy.assetsToPreload(item('a'))).toEqual([]);
		});
	});

	describe('cancel()', () => {
		it('does not throw when called before any preload', () => {
			const defaultPreloadStrategy = new DefaultPreloadStrategy(10);
			expect(() => defaultPreloadStrategy.cancel()).not.toThrow();
		});

		it('can be called multiple times without throwing', () => {
			const defaultPreloadStrategy = new DefaultPreloadStrategy(10);
			defaultPreloadStrategy.cancel();
			defaultPreloadStrategy.cancel();
		});
	});
});

// ── CrossfadeTransitionStrategy ───────────────────────────────────────────────

describe('CrossfadeTransitionStrategy', () => {
	describe('shouldTransition()', () => {
		it('returns false when nextItem is null', () => {
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy({ leadSeconds: 3 });
			expect(crossfadeTransitionStrategy.shouldTransition({ currentTime: 100, duration: 120, nextItem: null })).toBe(false);
		});

		it('returns false when duration is 0', () => {
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy({ leadSeconds: 3 });
			expect(crossfadeTransitionStrategy.shouldTransition({ currentTime: 5, duration: 0, nextItem: item('a') })).toBe(false);
		});

		it('returns false before lead window', () => {
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy({ leadSeconds: 3 });
			expect(crossfadeTransitionStrategy.shouldTransition({ currentTime: 100, duration: 120, nextItem: item('a') })).toBe(false);
		});

		it('returns true within lead window', () => {
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy({ leadSeconds: 3 });
			expect(crossfadeTransitionStrategy.shouldTransition({ currentTime: 118, duration: 120, nextItem: item('a') })).toBe(true);
		});
	});

	describe('tick()', () => {
		it('does nothing when backend is null', () => {
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy();
			expect(() =>
				crossfadeTransitionStrategy.tick(
					{ currentTime: 10, duration: 120, fraction: 0.5, outgoingItem: item('a'), incomingItem: item('b') },
					null,
				)).not.toThrow();
		});

		it('does nothing when backend does not support crossfade', () => {
			const backend = { supportsCrossfade: () => false, secondaryGain: vi.fn() } as any;
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy();
			crossfadeTransitionStrategy.tick(
				{ currentTime: 10, duration: 120, fraction: 0.5, outgoingItem: item('a'), incomingItem: item('b') },
				backend,
			);
			expect(backend.secondaryGain).not.toHaveBeenCalled();
		});

		it('calls backend.secondaryGain when backend supports crossfade (equal-power curve)', () => {
			const secondaryGain = vi.fn();
			const backend = { supportsCrossfade: () => true, secondaryGain } as any;
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy({ curve: 'equal-power' });
			crossfadeTransitionStrategy.tick(
				{ currentTime: 10, duration: 120, fraction: 0.5, outgoingItem: item('a'), incomingItem: item('b') },
				backend,
			);
			expect(secondaryGain).toHaveBeenCalledOnce();
			const gainArg = secondaryGain.mock.calls[0]![0] as number;
			expect(gainArg).toBeGreaterThan(0);
			expect(gainArg).toBeLessThanOrEqual(1);
		});

		it('calls backend.secondaryGain with linear curve', () => {
			const secondaryGain = vi.fn();
			const backend = { supportsCrossfade: () => true, secondaryGain } as any;
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy({ curve: 'linear' });
			crossfadeTransitionStrategy.tick(
				{ currentTime: 10, duration: 120, fraction: 0.5, outgoingItem: item('a'), incomingItem: item('b') },
				backend,
			);
			expect(secondaryGain).toHaveBeenCalledWith(0.5);
		});

		it('clamps fraction < 0 to 0 (linear)', () => {
			const secondaryGain = vi.fn();
			const backend = { supportsCrossfade: () => true, secondaryGain } as any;
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy({ curve: 'linear' });
			crossfadeTransitionStrategy.tick(
				{ currentTime: 0, duration: 120, fraction: -0.5, outgoingItem: item('a'), incomingItem: item('b') },
				backend,
			);
			expect(secondaryGain).toHaveBeenCalledWith(0);
		});

		it('clamps fraction > 1 to 1 (linear)', () => {
			const secondaryGain = vi.fn();
			const backend = { supportsCrossfade: () => true, secondaryGain } as any;
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy({ curve: 'linear' });
			crossfadeTransitionStrategy.tick(
				{ currentTime: 120, duration: 120, fraction: 1.5, outgoingItem: item('a'), incomingItem: item('b') },
				backend,
			);
			expect(secondaryGain).toHaveBeenCalledWith(1);
		});
	});

	describe('start() / complete() / cancel()', () => {
		it('start() does not throw', () => {
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy();
			expect(() => crossfadeTransitionStrategy.start(item('a'), item('b'), null)).not.toThrow();
		});

		it('complete() does not throw', () => {
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy();
			expect(() => crossfadeTransitionStrategy.complete(item('a'), item('b'))).not.toThrow();
		});

		it('cancel() does not throw', () => {
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy();
			expect(() => crossfadeTransitionStrategy.cancel('cursor-changed')).not.toThrow();
		});
	});

	describe('constructor defaults', () => {
		it('uses equal-power curve by default', () => {
			const secondaryGain = vi.fn();
			const backend = { supportsCrossfade: () => true, secondaryGain } as any;
			const crossfadeTransitionStrategy = new CrossfadeTransitionStrategy();
			crossfadeTransitionStrategy.tick(
				{ currentTime: 10, duration: 120, fraction: 1, outgoingItem: item('a'), incomingItem: item('b') },
				backend,
			);
			expect(secondaryGain).toHaveBeenCalledWith(1);
		});
	});
});

// ── GaplessTransitionStrategy ─────────────────────────────────────────────────

describe('GaplessTransitionStrategy', () => {
	it('shouldTransition() always returns false', () => {
		const gaplessTransitionStrategy = new GaplessTransitionStrategy();
		expect(gaplessTransitionStrategy.shouldTransition({ currentTime: 100, duration: 120, nextItem: item('a') })).toBe(false);
	});

	it('tick() does not throw', () => {
		const gaplessTransitionStrategy = new GaplessTransitionStrategy();
		expect(() =>
			gaplessTransitionStrategy.tick(
				{ currentTime: 100, duration: 120, fraction: 0.5, outgoingItem: item('a'), incomingItem: item('b') },
				null,
			)).not.toThrow();
	});

	it('start() does not throw', () => {
		const gaplessTransitionStrategy = new GaplessTransitionStrategy();
		expect(() => gaplessTransitionStrategy.start(item('a'), item('b'), null)).not.toThrow();
	});

	it('complete() does not throw', () => {
		const gaplessTransitionStrategy = new GaplessTransitionStrategy();
		expect(() => gaplessTransitionStrategy.complete(item('a'), item('b'))).not.toThrow();
	});

	it('cancel() does not throw', () => {
		const gaplessTransitionStrategy = new GaplessTransitionStrategy();
		expect(() => gaplessTransitionStrategy.cancel('reason')).not.toThrow();
	});
});
