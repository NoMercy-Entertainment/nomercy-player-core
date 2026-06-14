// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * `LoadOptions.startAt` must reach the backend as a load hint
 * (`BackendLoadHints.startTime`) so engines that support native offset
 * starts (hls.js `startPosition`) never download the start of the stream.
 * Backends declaring `canStartAt: true` consume the hint; for all others
 * the kit falls back to its post-load seek.
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

interface BackendSpy {
	loadCalls: Array<{ url: string; hints?: { startTime?: number } }>;
	seekCalls: number[];
}

function stubBackend(player: MockPlayer, opts?: { canStartAt?: boolean }): BackendSpy {
	const spy: BackendSpy = { loadCalls: [], seekCalls: [] };
	(player as unknown as { _resolveBackend: () => unknown })._resolveBackend = () => ({
		canStartAt: opts?.canStartAt,
		load: async (url: string, hints?: { startTime?: number }) => {
			spy.loadCalls.push({ url, hints });
		},
		play: async () => {},
		pause: () => {},
		currentTime: (t: number) => {
			spy.seekCalls.push(t);
		},
	});
	return spy;
}

describe('startAt → backend startTime hint', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('forwards startAt to backend.load as { startTime }', async () => {
		const player = makePlayer('start-at-fwd').setup({});
		await player.ready();
		player.queue([{ id: 1, url: 'http://example.test/e1.mp4' }]);
		const spy = stubBackend(player, { canStartAt: true });

		await player.load(player.queue()[0]!, { startAt: 300 });

		expect(spy.loadCalls).toHaveLength(1);
		expect(spy.loadCalls[0]!.hints).toEqual({ startTime: 300 });
	});

	it('passes no hints when startAt is absent or zero', async () => {
		const player = makePlayer('start-at-none').setup({});
		await player.ready();
		player.queue([{ id: 1, url: 'http://example.test/e1.mp4' }]);
		const spy = stubBackend(player, { canStartAt: true });

		await player.load(player.queue()[0]!);
		await player.load(player.queue()[0]!, { startAt: 0 });

		expect(spy.loadCalls[0]!.hints).toBeUndefined();
		expect(spy.loadCalls[1]!.hints).toBeUndefined();
	});

	it('skips the post-load seek when the backend declares canStartAt', async () => {
		const player = makePlayer('start-at-native').setup({});
		await player.ready();
		player.queue([{ id: 1, url: 'http://example.test/e1.mp4' }]);
		const spy = stubBackend(player, { canStartAt: true });

		await player.load(player.queue()[0]!, { startAt: 120 });

		expect(spy.seekCalls).toHaveLength(0);
	});

	it('falls back to a post-load seek when the backend lacks canStartAt', async () => {
		const player = makePlayer('start-at-fallback').setup({});
		await player.ready();
		player.queue([{ id: 1, url: 'http://example.test/e1.mp4' }]);
		const spy = stubBackend(player);

		await player.load(player.queue()[0]!, { startAt: 120 });

		expect(spy.seekCalls).toContain(120);
	});

	it('item(target, { startAt }) reaches the backend hint', async () => {
		const player = makePlayer('start-at-item').setup({});
		await player.ready();
		player.queue([
			{ id: 1, url: 'http://example.test/e1.mp4' },
			{ id: 2, url: 'http://example.test/e2.mp4' },
		]);
		const spy = stubBackend(player, { canStartAt: true });

		player.item(player.queue()[1]!, { startAt: 45 });
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(spy.loadCalls.at(-1)!.url).toContain('e2.mp4');
		expect(spy.loadCalls.at(-1)!.hints).toEqual({ startTime: 45 });
	});

	it('next({ startAt }) starts the incoming item at the offset', async () => {
		const player = makePlayer('start-at-next').setup({});
		await player.ready();
		player.queue([
			{ id: 1, url: 'http://example.test/e1.mp4' },
			{ id: 2, url: 'http://example.test/e2.mp4' },
		]);
		const spy = stubBackend(player, { canStartAt: true });

		await player.load(player.queue()[0]!);
		await player.next({ startAt: 90 });

		expect(spy.loadCalls.at(-1)!.url).toContain('e2.mp4');
		expect(spy.loadCalls.at(-1)!.hints).toEqual({ startTime: 90 });
	});
});
