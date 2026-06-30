// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Unit tests for playItem() and playNow() — the race-free queue-play helpers.
 *
 * Root cause guarded: calling item(target) + play() synchronously after each
 * other races because item() fires a fire-and-forget load() and play() calls
 * backend.play() → element.play() before element.src is set. Both helpers
 * here route through item(target, { autoplay: true }) which only calls play()
 * inside the resolved .then() of load() — never before.
 *
 * Test groups:
 *   A – playItem: plays only after load resolves, not before
 *   B – playItem: source threads through to play()
 *   C – playNow: replaces queue and plays from the right start
 *   D – playNow: source threads through
 *   E – playNow: no-ops on empty items
 *   F – symmetric availability: both methods are present on a player that
 *       composes playerCoreMethods (the shape NMMusicPlayer and NMVideoPlayer both use)
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

// ── Minimal player that mirrors NMMusicPlayer / NMVideoPlayer construction ─

const _instances = new Map<string, PlayQueuePlayer>();

class PlayQueuePlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = document.createElement('div');

	get id(): string {
		return this.playerId;
	}

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare phase: () => string;

	declare play: (opts?: { source?: string; autoplay?: boolean }) => Promise<void>;
	declare pause: (opts?: { source?: string }) => Promise<void>;
	declare load: (item: BasePlaylistItem, opts?: Record<string, unknown>) => Promise<void>;

	declare queue: {
		(): ReadonlyArray<BasePlaylistItem>;
		(items: BasePlaylistItem[], opts?: Record<string, unknown>): void;
	};

	declare item: {
		(): BasePlaylistItem | undefined;
		(
			target: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean),
			opts?: { source?: string; autoplay?: boolean; startAt?: number },
		): void;
	};

	declare playItem: (
		target: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean),
		opts?: { source?: string; autoplay?: boolean; startAt?: number },
	) => void;

	declare playNow: (
		items: BasePlaylistItem[],
		start?: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean),
		opts?: { source?: string; autoplay?: boolean; startAt?: number },
	) => void;

	declare index: () => number;
	declare queueLength: () => number;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'PlayQueuePlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'PlayQueuePlayer');
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

composeMixins(PlayQueuePlayer.prototype, ...playerCoreMethods);

// ── Helpers ───────────────────────────────────────────────────────────────

function makePlayer(divId: string): PlayQueuePlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new PlayQueuePlayer(divId);
}

async function drainMicrotasks(): Promise<void> {
	for (let tick = 0; tick < 20; tick++) {
		await Promise.resolve();
	}
}

interface Deferred {
	promise: Promise<void>;
	resolve: () => void;
}

function deferred(): Deferred {
	let resolve!: () => void;
	const promise = new Promise<void>((res) => { resolve = res; });
	return { promise, resolve };
}

const fixtures: Array<BasePlaylistItem & { url: string }> = [
	{ id: 'a1', url: '/a1.m3u8' },
	{ id: 'a2', url: '/a2.m3u8' },
	{ id: 'a3', url: '/a3.m3u8' },
];

// ── A – playItem: plays only after load resolves ──────────────────────────

describe('A – playItem: play fires after load, not before', () => {
	beforeEach(() => {
		PlayQueuePlayer._resetRegistry();
	});

	afterEach(() => {
		PlayQueuePlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('play() is not called until load() resolves', async () => {
		const player = makePlayer('pq-a1');
		await player.setup({}).ready();
		player.queue(fixtures);

		const loadGate = deferred();
		vi.spyOn(player, 'load').mockImplementation(() => loadGate.promise);
		const playSpy = vi.spyOn(player, 'play').mockResolvedValue(undefined);

		(player as unknown as { _phase: string })._phase = 'playing';

		player.playItem('a1');

		// load has not resolved yet — play must not have been called
		await drainMicrotasks();
		expect(playSpy).not.toHaveBeenCalled();

		// now resolve the load
		loadGate.resolve();
		await drainMicrotasks();
		expect(playSpy).toHaveBeenCalledTimes(1);
	});

	it('play() is called exactly once when load resolves', async () => {
		const player = makePlayer('pq-a2');
		await player.setup({}).ready();
		player.queue(fixtures);

		const loadGate = deferred();
		vi.spyOn(player, 'load').mockImplementation(() => loadGate.promise);
		const playSpy = vi.spyOn(player, 'play').mockResolvedValue(undefined);

		(player as unknown as { _phase: string })._phase = 'playing';

		player.playItem('a2');
		loadGate.resolve();
		await drainMicrotasks();

		expect(playSpy).toHaveBeenCalledTimes(1);
	});
});

// ── B – playItem: source threads through ─────────────────────────────────

describe('B – playItem: source attribute threads through', () => {
	beforeEach(() => {
		PlayQueuePlayer._resetRegistry();
	});

	afterEach(() => {
		PlayQueuePlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('source:"remote" reaches play() call', async () => {
		const player = makePlayer('pq-b1');
		await player.setup({}).ready();
		player.queue(fixtures);

		const loadGate = deferred();
		vi.spyOn(player, 'load').mockImplementation(() => loadGate.promise);
		const playSpy = vi.spyOn(player, 'play').mockResolvedValue(undefined);

		(player as unknown as { _phase: string })._phase = 'playing';

		player.playItem('a1', { source: 'remote' });
		loadGate.resolve();
		await drainMicrotasks();

		expect(playSpy).toHaveBeenCalledWith(
			expect.objectContaining({ source: 'remote' }),
		);
	});

	it('source:"plugin" reaches play() call', async () => {
		const player = makePlayer('pq-b2');
		await player.setup({}).ready();
		player.queue(fixtures);

		const loadGate = deferred();
		vi.spyOn(player, 'load').mockImplementation(() => loadGate.promise);
		const playSpy = vi.spyOn(player, 'play').mockResolvedValue(undefined);

		(player as unknown as { _phase: string })._phase = 'playing';

		player.playItem('a2', { source: 'plugin' });
		loadGate.resolve();
		await drainMicrotasks();

		expect(playSpy).toHaveBeenCalledWith(
			expect.objectContaining({ source: 'plugin' }),
		);
	});
});

// ── C – playNow: replaces queue and plays from the right start ────────────

describe('C – playNow: queue replacement and start target', () => {
	beforeEach(() => {
		PlayQueuePlayer._resetRegistry();
	});

	afterEach(() => {
		PlayQueuePlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('replaces the queue with the supplied items', async () => {
		const player = makePlayer('pq-c1');
		await player.setup({}).ready();

		const initial: Array<BasePlaylistItem & { url: string }> = [
			{ id: 'old1', url: '/old1.m3u8' },
		];
		player.queue(initial);
		expect(player.queueLength()).toBe(1);

		vi.spyOn(player, 'load').mockResolvedValue(undefined);
		vi.spyOn(player, 'play').mockResolvedValue(undefined);

		player.playNow(fixtures);

		expect(player.queueLength()).toBe(fixtures.length);
	});

	it('plays from the first item when no start is given', async () => {
		const player = makePlayer('pq-c2');
		await player.setup({}).ready();

		const loadGate = deferred();
		vi.spyOn(player, 'load').mockImplementation(() => loadGate.promise);
		const playSpy = vi.spyOn(player, 'play').mockResolvedValue(undefined);

		(player as unknown as { _phase: string })._phase = 'playing';

		player.playNow(fixtures);

		// cursor must be at the first item before load resolves
		expect(player.item()?.id).toBe('a1');

		loadGate.resolve();
		await drainMicrotasks();

		expect(playSpy).toHaveBeenCalledTimes(1);
	});

	it('plays from the specified start item (by id)', async () => {
		const player = makePlayer('pq-c3');
		await player.setup({}).ready();

		const loadGate = deferred();
		vi.spyOn(player, 'load').mockImplementation(() => loadGate.promise);
		const playSpy = vi.spyOn(player, 'play').mockResolvedValue(undefined);

		(player as unknown as { _phase: string })._phase = 'playing';

		player.playNow(fixtures, 'a2');

		expect(player.item()?.id).toBe('a2');

		loadGate.resolve();
		await drainMicrotasks();

		expect(playSpy).toHaveBeenCalledTimes(1);
	});

	it('plays from the specified start item (by item reference)', async () => {
		const player = makePlayer('pq-c4');
		await player.setup({}).ready();

		const loadGate = deferred();
		vi.spyOn(player, 'load').mockImplementation(() => loadGate.promise);
		vi.spyOn(player, 'play').mockResolvedValue(undefined);

		(player as unknown as { _phase: string })._phase = 'playing';

		player.playNow(fixtures, fixtures[2]);

		expect(player.item()?.id).toBe('a3');

		loadGate.resolve();
		await drainMicrotasks();
	});

	it('plays from the specified start item (by index)', async () => {
		const player = makePlayer('pq-c5');
		await player.setup({}).ready();

		const loadGate = deferred();
		vi.spyOn(player, 'load').mockImplementation(() => loadGate.promise);
		vi.spyOn(player, 'play').mockResolvedValue(undefined);

		(player as unknown as { _phase: string })._phase = 'playing';

		// index 1 = second item (a2)
		player.playNow(fixtures, 1);

		expect(player.item()?.id).toBe('a2');

		loadGate.resolve();
		await drainMicrotasks();
	});
});

// ── D – playNow: source threads through ──────────────────────────────────

describe('D – playNow: source attribute threads through', () => {
	beforeEach(() => {
		PlayQueuePlayer._resetRegistry();
	});

	afterEach(() => {
		PlayQueuePlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('source:"remote" reaches play() call', async () => {
		const player = makePlayer('pq-d1');
		await player.setup({}).ready();

		const loadGate = deferred();
		vi.spyOn(player, 'load').mockImplementation(() => loadGate.promise);
		const playSpy = vi.spyOn(player, 'play').mockResolvedValue(undefined);

		(player as unknown as { _phase: string })._phase = 'playing';

		player.playNow(fixtures, undefined, { source: 'remote' });
		loadGate.resolve();
		await drainMicrotasks();

		expect(playSpy).toHaveBeenCalledWith(
			expect.objectContaining({ source: 'remote' }),
		);
	});
});

// ── E – playNow: no-ops on empty items ───────────────────────────────────

describe('E – playNow: no-op on empty array', () => {
	beforeEach(() => {
		PlayQueuePlayer._resetRegistry();
	});

	afterEach(() => {
		PlayQueuePlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('does not replace the queue or call play when items is empty', async () => {
		const player = makePlayer('pq-e1');
		await player.setup({}).ready();
		player.queue(fixtures);

		const playSpy = vi.spyOn(player, 'play').mockResolvedValue(undefined);

		player.playNow([]);

		await drainMicrotasks();

		// queue unchanged
		expect(player.queueLength()).toBe(fixtures.length);
		expect(playSpy).not.toHaveBeenCalled();
	});
});

// ── F – symmetric availability ────────────────────────────────────────────

describe('F – symmetric availability on playerCoreMethods composition', () => {
	beforeEach(() => {
		PlayQueuePlayer._resetRegistry();
	});

	afterEach(() => {
		PlayQueuePlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('playItem is present on a player that uses playerCoreMethods', () => {
		const player = makePlayer('pq-f1');
		expect(typeof player.playItem).toBe('function');
	});

	it('playNow is present on a player that uses playerCoreMethods', () => {
		const player = makePlayer('pq-f2');
		expect(typeof player.playNow).toBe('function');
	});
});
