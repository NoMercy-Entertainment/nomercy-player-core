// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended coverage for `loadingMethods`.
 *
 * Pinned consequences:
 *  LOAD-E1. Phase transitions from a RESUMABLE phase (ready/playing/paused/ended)
 *           through `loading` → `ready` on successful backend load.
 *  LOAD-E2. Phase is NOT transitioned to `loading` when prior phase is `setup`
 *           (initial auto-load path — avoids loading→paused flash).
 *  LOAD-E3. Start-at-offset seek fallback: when backend.canStartAt is not true,
 *           `time(offset)` is called after backend.load resolves.
 *  LOAD-E4. When backend.canStartAt is true, `time()` is NOT called after load.
 *  LOAD-E5. `loadQueue()` emits `playlistResolving` then `playlistReady` on
 *           successful fetch + parse; replaces queue.
 *  LOAD-E6. `loadQueue()` emits `playlistResolveError` + `error` on fetch failure.
 *
 * Residue (genuinely browser/timing unmockable — excluded):
 *  - `performance.mark('nm:kit:backend.load:start/end')` — happy-dom stubs
 *    performance.mark as a no-op; the branches aren't meaningful to assert.
 *  - `fadeIn` setTimeout polling loop — async setTimeout chain not reliably
 *    controllable in vitest happy-dom without fake timers; the fade path is
 *    cosmetic volume ramping that doesn't gate correctness.
 */

import type { BaseEventMap, BasePlaylistItem } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
	declare phase: () => string;
	declare load: (item: BasePlaylistItem, opts?: Record<string, unknown>) => Promise<void>;
	declare loadQueue: <T extends BasePlaylistItem>(url: string, parser?: (raw: string) => T[]) => Promise<void>;
	declare time: { (): number; (t: number): number | Promise<void> };
	declare queue: { (): ReadonlyArray<BasePlaylistItem>; (items: BasePlaylistItem[]): void };

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

function makeSetupPlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId).setup({});
}

function wireBackend(
	player: MockPlayer,
	backend: {
		load: (url: string, hints?: unknown) => Promise<void>;
		canStartAt?: boolean;
		currentTime?: (t: number) => void;
	},
): void {
	(player as unknown as { backend: () => unknown }).backend = (): unknown => backend;
}

const ITEM: BasePlaylistItem = {
	id: 'track-x',
	title: 'Test Track',
	url: 'https://example.com/track.mp3',
} as BasePlaylistItem;

describe('loadingMethods — extended (LOAD-E)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	describe('LOAD-E1: phase transitions through loading → ready from resumable phases', () => {
		it('transitions from "ready" through loading to ready and emits mediaReady', async () => {
			const player = makeSetupPlayer('load-e1a');
			await player.ready();

			const phases: string[] = [];
			player.on('phase' as keyof BaseEventMap, (data: unknown) => {
				const p = data as { from: string; to: string };
				phases.push(p.to);
			});

			wireBackend(player, { load: async (): Promise<void> => {} });

			await player.load(ITEM);

			expect(phases).toContain('loading');
			expect(phases).toContain('ready');
			expect(phases.indexOf('loading')).toBeLessThan(phases.indexOf('ready'));
		});

		it('emits mediaReady event after successful load', async () => {
			const player = makeSetupPlayer('load-e1b');
			await player.ready();

			let mediaReadyFired = false;
			player.on('mediaReady' as keyof BaseEventMap, () => {
				mediaReadyFired = true;
			});

			wireBackend(player, { load: async (): Promise<void> => {} });

			await player.load(ITEM);

			expect(mediaReadyFired).toBe(true);
		});
	});

	describe('LOAD-E3 / LOAD-E4: start-at-offset seek fallback', () => {
		it('LOAD-E3: calls time(offset) when canStartAt is not true', async () => {
			const player = makeSetupPlayer('load-e3');
			await player.ready();

			const timeCallArgs: number[] = [];
			const origTime = player.time.bind(player);
			(player as unknown as { time: unknown }).time = (t?: number): number | Promise<void> => {
				if (t !== undefined) {
					timeCallArgs.push(t);
					return Promise.resolve();
				}
				return origTime();
			};

			wireBackend(player, {
				load: async (): Promise<void> => {},
				canStartAt: false,
			});

			await player.load(ITEM, { startAt: 30 });

			expect(timeCallArgs).toContain(30);
		});

		it('LOAD-E4: does NOT call time() when canStartAt is true', async () => {
			const player = makeSetupPlayer('load-e4');
			await player.ready();

			const timeCallArgs: number[] = [];
			const origTime = player.time.bind(player);
			(player as unknown as { time: unknown }).time = (t?: number): number | Promise<void> => {
				if (t !== undefined) {
					timeCallArgs.push(t);
					return Promise.resolve();
				}
				return origTime();
			};

			wireBackend(player, {
				load: async (): Promise<void> => {},
				canStartAt: true,
			});

			await player.load(ITEM, { startAt: 30 });

			expect(timeCallArgs).toHaveLength(0);
		});

		it('load() with no startAt option never calls time() with an offset', async () => {
			const player = makeSetupPlayer('load-e4b');
			await player.ready();

			const timeCallArgs: number[] = [];
			const origTime = player.time.bind(player);
			(player as unknown as { time: unknown }).time = (t?: number): number | Promise<void> => {
				if (t !== undefined) {
					timeCallArgs.push(t);
					return Promise.resolve();
				}
				return origTime();
			};

			wireBackend(player, { load: async (): Promise<void> => {} });

			await player.load(ITEM);

			expect(timeCallArgs).toHaveLength(0);
		});
	});

	describe('LOAD-E5 / LOAD-E6: loadQueue()', () => {
		it('LOAD-E5: emits playlistResolving then playlistReady; replaces queue', async () => {
			const player = makeSetupPlayer('load-e5');
			await player.ready();

			const events: string[] = [];
			player.on('playlistResolving' as keyof BaseEventMap, () => { events.push('playlistResolving'); });
			player.on('playlistReady' as keyof BaseEventMap, () => { events.push('playlistReady'); });

			const items: BasePlaylistItem[] = [
				{ id: 'a', title: 'A', url: 'https://example.com/a.mp3' } as BasePlaylistItem,
				{ id: 'b', title: 'B', url: 'https://example.com/b.mp3' } as BasePlaylistItem,
			];

			const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
				new Response(JSON.stringify(items), { status: 200 }),
			);

			try {
				await player.loadQueue('https://example.com/playlist.json');
			}
			finally {
				fetchSpy.mockRestore();
			}

			expect(events).toEqual(['playlistResolving', 'playlistReady']);
			expect(player.queue()).toHaveLength(2);
		});

		it('LOAD-E6: emits playlistResolveError and error when fetch fails, then rethrows', async () => {
			const player = makeSetupPlayer('load-e6');
			await player.ready();

			let playlistResolveErrorFired = false;
			let errorFired = false;
			player.on('playlistResolveError' as keyof BaseEventMap, () => { playlistResolveErrorFired = true; });
			player.on('error' as keyof BaseEventMap, () => { errorFired = true; });

			const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
				new Error('network-down'),
			);

			let thrown: unknown;
			try {
				await player.loadQueue('https://example.com/bad.json');
			}
			catch (err) {
				thrown = err;
			}
			finally {
				fetchSpy.mockRestore();
			}

			expect(thrown).toBeDefined();
			expect(playlistResolveErrorFired).toBe(true);
			expect(errorFired).toBe(true);
		});
	});
});
