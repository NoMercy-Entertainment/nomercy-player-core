/**
 * Regression: load() must move the queue cursor for NUMERIC item ids.
 *
 * MediaList.setCurrent treats an integer as an INDEX; passing a numeric id
 * (every NoMercy API id) resolved out of range and silently left the cursor
 * on the previous item — next()/auto-advance loaded the right media but the
 * player state never advanced.
 */

import type { BaseEventMap, BasePlaylistItem } from '../types';
import { beforeEach, describe, expect, it } from 'vitest';
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
	container: HTMLElement = <HTMLElement>{};

	get id(): string {
		return this.playerId;
	}

	declare options: any;
	declare setup: (config: any) => this;
	declare ready: () => Promise<void>;
	declare load: (item: BasePlaylistItem, opts?: any) => Promise<void>;
	declare next: (opts?: any) => Promise<void>;
	declare index: () => number;
	declare item: { (): BasePlaylistItem | undefined; (target: unknown, opts?: any): void };
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

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

function stubBackend(player: MockPlayer): void {
	(player as unknown as { _resolveBackend: () => unknown })._resolveBackend = () => ({
		load: async () => {},
		play: async () => {},
		pause: () => {},
	});
}

describe('load() cursor move with numeric ids', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('moves the cursor to the loaded item when ids are numbers', async () => {
		const player = makePlayer('cursor-num').setup({});
		await player.ready();

		player.queue([
			{ id: 4237712, url: 'http://example.test/e1.mp4' },
			{ id: 4680388, url: 'http://example.test/e2.mp4' },
		]);
		stubBackend(player);

		await player.load(player.queue()[1]!);

		expect(player.index()).toBe(1);
		expect(player.item()?.id).toBe(4680388);
	});

	it('next() advances state end-to-end with numeric ids', async () => {
		const player = makePlayer('cursor-next').setup({});
		await player.ready();

		player.queue([
			{ id: 101, url: 'http://example.test/a.mp4' },
			{ id: 202, url: 'http://example.test/b.mp4' },
		]);
		stubBackend(player);

		await player.load(player.queue()[0]!);
		expect(player.index()).toBe(0);

		await player.next();

		expect(player.index()).toBe(1);
		expect(player.item()?.id).toBe(202);
	});
});
