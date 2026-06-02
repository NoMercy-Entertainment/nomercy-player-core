/**
 * Auto-advance + load cursor reliability tests.
 *
 * The kit core does NOT handle auto-advance. Auto-advance is entirely owned
 * by the AutoAdvancePlugin (in nomercy-music-player-v2 / nomercy-video-player-v2).
 * These tests confirm:
 *  - The kit core never calls next() on ended — not under any config.
 *  - `next()` calls play() exactly once when load() succeeds.
 *  - `current(item)` + `load(item)` together emit exactly ONE `current` event.
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
	container: HTMLElement = <HTMLElement>{};

	get id(): string {
		return this.playerId;
	}

	declare options: any;
	declare setup: (config: any) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare phase: () => string;
	declare play: (opts?: any) => Promise<void>;
	declare pause: (opts?: any) => Promise<void>;
	declare next: (opts?: any) => Promise<void>;
	declare previous: (opts?: any) => Promise<void>;
	declare queue: { (): ReadonlyArray<any>; (items: any[], opts?: any): void };
	declare item: { (): any; (target: any, opts?: any): void };
	declare repeatState: { (): string; (state: any): void };
	declare load: (item: any, opts?: any) => Promise<void>;

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

const track = (id: string): BasePlaylistItem & { url: string } => ({ id, url: `http://example.test/${id}.mp3` });

describe('kit core — no auto-advance on ended', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('ended → kit core does NOT call next() — plugin owns auto-advance', async () => {
		const player = makePlayer('aa-kit-no-next').setup({});
		await player.ready();

		player.queue([track('a'), track('b')]);

		const nextSpy = vi.spyOn(player, 'next');

		player.emit('ended' as any, undefined);

		await new Promise(resolve => setTimeout(resolve, 20));

		expect(nextSpy).not.toHaveBeenCalled();
	});

	it('ended → kit core does NOT call next() regardless of repeatState', async () => {
		const player = makePlayer('aa-kit-repeat').setup({});
		await player.ready();
		player.repeatState('off');
		player.queue([track('a'), track('b')]);

		const nextSpy = vi.spyOn(player, 'next');

		player.emit('ended' as any, undefined);

		await new Promise(resolve => setTimeout(resolve, 20));

		expect(nextSpy).not.toHaveBeenCalled();
	});

	it('next() calls play() exactly once when load() succeeds', async () => {
		const player = makePlayer('aa-next-once').setup({});
		await player.ready();

		player.queue([track('a'), track('b')]);

		const loadSpy = vi.spyOn(player, 'load').mockResolvedValue(undefined);
		const playSpy = vi.spyOn(player, 'play');

		await player.next({ source: 'test' });

		expect(loadSpy).toHaveBeenCalledTimes(1);
		expect(playSpy).toHaveBeenCalledTimes(1);
		expect(playSpy).toHaveBeenCalledWith({ source: 'test' });
	});
});

describe('load cursor dedup', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('current(item) + subsequent load(item) emits current exactly once', async () => {
		const player = makePlayer('cursor-dedup').setup({});
		await player.ready();

		const items = [track('a'), track('b'), track('c')];
		player.queue(items);

		const loadSpy = vi.spyOn(player, 'load').mockResolvedValue(undefined);

		const currentEvents: unknown[] = [];
		player.on('current' as any, (data: unknown) => {
			currentEvents.push(data);
		});

		player.item('b', { autoplay: false });

		await loadSpy.mock.results[0]?.value;
		await new Promise(resolve => setTimeout(resolve, 10));

		expect(currentEvents).toHaveLength(1);
		expect((currentEvents[0] as any).index).toBe(1);
	});
});
