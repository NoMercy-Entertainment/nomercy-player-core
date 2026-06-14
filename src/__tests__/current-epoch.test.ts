/**
 * Regression guard for the _currentEpoch race fix in current().
 *
 * Root cause: rapid current(B, { autoplay }) then current(C, { autoplay })
 * produced two concurrent load() calls. When load(B) resolved silently
 * (isLatest() false), its .then() continuation still fired play() because
 * the autoplay guard only compared _loadEpoch — which load() itself
 * re-bumps internally. _currentEpoch is bumped only by current() write
 * calls, making it a stable sentinel for the autoplay continuation.
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

// ── Minimal player with a controllable fake backend ───────────────────────────

const _instances = new Map<string, EpochPlayer>();

class EpochPlayer extends EventEmitter<BaseEventMap> {
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
	declare play: (opts?: { source?: string }) => Promise<void>;
	declare pause: (opts?: { source?: string }) => Promise<void>;
	declare queue: {
		(): ReadonlyArray<BasePlaylistItem>;
		(items: BasePlaylistItem[]): void;
	};

	declare item: {
		(): BasePlaylistItem | undefined;
		(target: string | number | BasePlaylistItem, opts?: { source?: string; autoplay?: boolean }): void;
	};

	declare index: () => number;
	declare load: (item: BasePlaylistItem, opts?: Record<string, unknown>) => Promise<void>;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'EpochPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'EpochPlayer');
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

composeMixins(EpochPlayer.prototype, ...playerCoreMethods);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePlayer(divId: string): EpochPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new EpochPlayer(divId);
}

/** Flush every pending microtask in the queue. */
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

const items: Array<BasePlaylistItem & { url: string }> = [
	{ id: 'ep1', url: '/ep1.m3u8' },
	{ id: 'ep2', url: '/ep2.m3u8' },
	{ id: 'ep3', url: '/ep3.m3u8' },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('current() — _currentEpoch autoplay race guard', () => {
	beforeEach(() => {
		EpochPlayer._resetRegistry();
	});

	afterEach(() => {
		EpochPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('rapid current(B) then current(C) — only C fires play()', async () => {
		const player = makePlayer('epoch-test');
		await player.setup({}).ready();
		player.queue(items);

		// Deferred loads let us control resolution order.
		const loadEp2 = deferred();
		const loadEp3 = deferred();

		// load() is called via queue.ts current(). Intercept it here so we can
		// return a deferred promise per URL without needing a real backend.
		vi.spyOn(player, 'load').mockImplementation((item) => {
			if (item.id === 'ep2')
				return loadEp2.promise;
			if (item.id === 'ep3')
				return loadEp3.promise;
			return Promise.resolve();
		});

		// play() is called from the autoplay continuation. Spy on it.
		const playSpy = vi.spyOn(player, 'play').mockResolvedValue(undefined);

		// Advance phase so current() considers the player ready to load.
		(player as unknown as { _phase: string })._phase = 'playing';

		// Rapid navigation — ep2 then ep3 before either load resolves.
		player.item('ep2', { autoplay: true });
		player.item('ep3', { autoplay: true });

		// Resolve ep2 first (stale navigation) then ep3 (winner).
		loadEp2.resolve();
		await drainMicrotasks();

		loadEp3.resolve();
		await drainMicrotasks();

		// Only ep3's autoplay continuation should have fired play().
		expect(playSpy).toHaveBeenCalledTimes(1);
	});

	it('single current() with autoplay fires play() exactly once', async () => {
		const player = makePlayer('epoch-single');
		await player.setup({}).ready();
		player.queue(items);

		const loadDone = deferred();

		vi.spyOn(player, 'load').mockImplementation(() => loadDone.promise);
		const playSpy = vi.spyOn(player, 'play').mockResolvedValue(undefined);

		(player as unknown as { _phase: string })._phase = 'playing';

		player.item('ep1', { autoplay: true });

		loadDone.resolve();
		await drainMicrotasks();

		expect(playSpy).toHaveBeenCalledTimes(1);
	});

	it('current() without autoplay never fires play()', async () => {
		const player = makePlayer('epoch-noplay');
		await player.setup({}).ready();
		player.queue(items);

		const loadDone = deferred();

		vi.spyOn(player, 'load').mockImplementation(() => loadDone.promise);
		const playSpy = vi.spyOn(player, 'play').mockResolvedValue(undefined);

		(player as unknown as { _phase: string })._phase = 'playing';

		player.item('ep1');

		loadDone.resolve();
		await drainMicrotasks();

		expect(playSpy).not.toHaveBeenCalled();
	});

	it('_currentEpoch is bumped on each current() write and not on read', () => {
		const player = makePlayer('epoch-counter');
		player.setup({});

		const epoch0 = (player as unknown as { _currentEpoch?: number })._currentEpoch;
		expect(epoch0).toBeUndefined();

		// Read call — must not bump epoch.
		player.queue(items);
		player.item();
		const afterRead = (player as unknown as { _currentEpoch?: number })._currentEpoch;
		expect(afterRead).toBeUndefined();

		// Write call — must bump epoch.
		player.item('ep1');
		const afterFirst = (player as unknown as { _currentEpoch?: number })._currentEpoch;
		expect(afterFirst).toBe(1);

		player.item('ep2');
		const afterSecond = (player as unknown as { _currentEpoch?: number })._currentEpoch;
		expect(afterSecond).toBe(2);
	});
});
