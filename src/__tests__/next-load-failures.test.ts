/**
 * next() treats a failed load like any player does: a missing item is skipped,
 * an expired token is refreshed once, and a server error is fatal.
 */

import type { BaseEventMap, BasePlaylistItem } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	PlayerError,
	RepeatState,
	resolvePlayerConstructor,
} from '../index';

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = {} as HTMLElement;
	get id(): string { return this.playerId; }

	declare setup: (config: Record<string, unknown>) => this;
	declare next: (opts?: unknown) => Promise<void>;
	declare repeatState: { (): string; (state: unknown): void };
	declare queue: { (): ReadonlyArray<unknown>; (items: unknown[], opts?: unknown): void };
	declare item: { (): unknown; (target: unknown, opts?: unknown): void };
	declare auth: (config: Record<string, unknown>) => void;
	declare playState: () => string;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing')
			return resolved.instance as unknown as this;
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void { _instances.clear(); }
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

const ITEMS: BasePlaylistItem[] = [
	{ id: 'a', title: 'A', url: '/a.m3u8' },
	{ id: 'b', title: 'B', url: '/b.m3u8' },
	{ id: 'c', title: 'C', url: '/c.m3u8' },
];

function httpFailure(status: number): PlayerError {
	return new PlayerError({
		code: 'core:stream/test-failure',
		severity: 'error',
		scope: { kind: 'core' },
		message: `HTTP ${status}`,
		context: { httpStatus: status },
	});
}

function setup(items: BasePlaylistItem[] = ITEMS): MockPlayer {
	const div = document.createElement('div');
	div.id = 'nlf-mock';
	document.body.appendChild(div);
	const player = new MockPlayer('nlf-mock').setup({});
	player.queue(items);
	player.item(items[0]!);
	return player;
}

function stubLoad(player: MockPlayer, fn: (item: BasePlaylistItem) => Promise<void>): ReturnType<typeof vi.fn> {
	const spy = vi.fn(fn);
	(player as unknown as { load: typeof fn }).load = spy;
	return spy;
}

function loadedIds(spy: ReturnType<typeof vi.fn>): string[] {
	return spy.mock.calls.map(call => (call[0] as BasePlaylistItem).id as string);
}

describe('next() when the incoming item fails to load', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('skips an item the server answers 404 for and loads the one after it', async () => {
		const player = setup();
		const skipped: unknown[] = [];
		player.on('itemSkipped' as never, (data: unknown) => skipped.push(data));
		const load = stubLoad(player, async (item) => {
			if (item.id === 'b')
				throw httpFailure(404);
		});

		await player.next();

		expect(loadedIds(load)).toEqual(['b', 'c']);
		expect(player.item()).toMatchObject({ id: 'c' });
		expect(skipped).toEqual([{ item: expect.objectContaining({ id: 'b' }), status: 404 }]);
	});

	it('stops at the end of the queue when the last item is missing', async () => {
		const player = setup();
		player.item(ITEMS[1]!);
		const exhausted: unknown[] = [];
		player.on('queue:exhausted' as never, (data: unknown) => exhausted.push(data));
		const skipped: unknown[] = [];
		player.on('itemSkipped' as never, (data: unknown) => skipped.push(data));
		const load = stubLoad(player, async () => { throw httpFailure(404); });

		await player.next();

		expect(loadedIds(load)).toEqual(['c']);
		expect(skipped).toHaveLength(1);
		expect(exhausted).toHaveLength(1);
	});

	it('does not loop back to the first item under repeat all when the last is missing', async () => {
		const player = setup();
		player.repeatState(RepeatState.ALL);
		player.item(ITEMS[1]!);
		const load = stubLoad(player, async () => { throw httpFailure(404); });

		await player.next();

		expect(loadedIds(load)).toEqual(['c']);
	});

	it('refreshes the token once on 401 and loads the same item again', async () => {
		const player = setup();
		const refresh = vi.fn().mockResolvedValue(undefined);
		player.auth({ refreshOnUnauthenticated: refresh });
		let attempts = 0;
		const load = stubLoad(player, async () => {
			attempts += 1;
			if (attempts === 1)
				throw httpFailure(401);
		});

		await player.next();

		expect(refresh).toHaveBeenCalledTimes(1);
		expect(loadedIds(load)).toEqual(['b', 'b']);
		expect(player.item()).toMatchObject({ id: 'b' });
	});

	it('gives up after one refresh when the server still answers 401', async () => {
		const player = setup();
		const refresh = vi.fn().mockResolvedValue(undefined);
		player.auth({ refreshOnUnauthenticated: refresh });
		const load = stubLoad(player, async () => { throw httpFailure(401); });

		await expect(player.next()).rejects.toMatchObject({ context: { httpStatus: 401 } });

		expect(refresh).toHaveBeenCalledTimes(1);
		expect(loadedIds(load)).toEqual(['b', 'b']);
	});

	it('raises a fatal error on 500 and does not skip', async () => {
		const player = setup();
		const fatal: Array<{ error: PlayerError; severity: string }> = [];
		player.on('fatal' as never, (data: { error: PlayerError; severity: string }) => fatal.push(data));
		const skipped: unknown[] = [];
		player.on('itemSkipped' as never, (data: unknown) => skipped.push(data));
		const load = stubLoad(player, async () => { throw httpFailure(500); });

		await expect(player.next()).rejects.toMatchObject({ context: { httpStatus: 500 } });

		expect(loadedIds(load)).toEqual(['b']);
		expect(skipped).toHaveLength(0);
		expect(fatal).toHaveLength(1);
		expect(fatal[0]!.severity).toBe('fatal');
		expect(fatal[0]!.error.context).toMatchObject({ httpStatus: 500 });
		expect(player.playState()).toBe('error');
	});
});
