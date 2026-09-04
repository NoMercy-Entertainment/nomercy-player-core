// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Regression guard: a refused play() must not escape as an unhandled rejection.
 *
 * Two call sites fire play() detached, with nothing awaiting the result:
 *
 *   queue.ts   item()'s autoplay continuation, after load() resolves
 *   transport.ts  _loadAndPlay, behind next() and previous()
 *
 * A browser declining playback without a user gesture rejects there, which is
 * the ordinary outcome of item() on page load rather than an error. Left bare,
 * each one surfaced an uncaught NotAllowedError in every consumer's console —
 * six pages of the docs site logged one before this was fixed.
 *
 * The assertion is the unhandled-rejection count, because that is the symptom.
 * Measured, not assumed: a state-only twin of both tests was run against the
 * same mutation with both catches removed, and passed 2/2 while these two
 * failed 2/2. State alone would have shipped the bug.
 */

import type { BackendShape } from '../core/mixins/player-state';
import type { BaseEventMap, BasePlaylistItem } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';

const _instances = new Map<string, RefusalPlayer>();

class RefusalPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = document.createElement('div');

	get id(): string {
		return this.playerId;
	}

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare playState: () => string;
	declare queue: {
		(): ReadonlyArray<BasePlaylistItem>;
		(items: BasePlaylistItem[]): void;
	};

	declare item: {
		(): BasePlaylistItem | undefined;
		(target: string | number | BasePlaylistItem, opts?: { autoplay?: boolean }): void;
	};

	declare next: () => Promise<void>;
	declare load: (item: BasePlaylistItem, opts?: Record<string, unknown>) => Promise<void>;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'RefusalPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'RefusalPlayer');
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

composeMixins(RefusalPlayer.prototype, ...playerCoreMethods);

const items: Array<BasePlaylistItem & { url: string }> = [
	{ id: 'first', url: '/first.mp3' },
	{ id: 'second', url: '/second.mp3' },
];

/** The rejection a browser hands back when it declines playback. */
function refusal(): Error {
	const error = new Error('play() failed because the user didn\'t interact with the document first.');
	error.name = 'NotAllowedError';
	return error;
}

async function makeRefusingPlayer(divId: string): Promise<RefusalPlayer> {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	const player = new RefusalPlayer(divId);
	await player.setup({}).ready();

	const backend = {
		play: vi.fn().mockRejectedValue(refusal()),
		pause: vi.fn(),
		stop: vi.fn(),
		currentTime: vi.fn(),
	} as unknown as BackendShape;
	(player as unknown as { backend: () => BackendShape }).backend = () => backend;
	// load() resolving is what hands control to the autoplay continuation.
	(player as unknown as { load: () => Promise<void> }).load = () => Promise.resolve();

	player.queue(items);
	return player;
}

async function drainMicrotasks(): Promise<void> {
	for (let tick = 0; tick < 30; tick++) {
		await Promise.resolve();
	}
}

describe('a refused play() never escapes as an unhandled rejection', () => {
	let unhandled: unknown[];
	let record: (reason: unknown) => void;

	beforeEach(() => {
		RefusalPlayer._resetRegistry();
		unhandled = [];
		// Only this refusal counts. The listener is on the process, so a
		// rejection from another test file sharing the worker would otherwise
		// fail this one at random — and the mutation that matters still
		// produces exactly a NotAllowedError, so the teeth are unaffected.
		record = (reason: unknown) => {
			if (reason instanceof Error && reason.name === 'NotAllowedError') {
				unhandled.push(reason);
			}
		};
		process.on('unhandledRejection', record);
	});

	afterEach(() => {
		process.off('unhandledRejection', record);
		RefusalPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('item() autoplay continuation swallows the refusal', async () => {
		const player = await makeRefusingPlayer('refusal-item');

		player.item('second');
		await drainMicrotasks();
		// The rejection is reported a macrotask after the microtask queue drains.
		await new Promise(resolve => setTimeout(resolve, 20));

		expect(unhandled).toEqual([]);
		// The refusal still lands where a consumer can see it: not playing.
		expect(player.playState()).not.toBe('playing');
	});

	it('next() load-and-play swallows the refusal', async () => {
		const player = await makeRefusingPlayer('refusal-next');
		player.item('first', { autoplay: false });
		await drainMicrotasks();
		unhandled.length = 0;

		await player.next();
		await drainMicrotasks();
		await new Promise(resolve => setTimeout(resolve, 20));

		expect(unhandled).toEqual([]);
		// next() moved the cursor even though playback was refused — the
		// distinction that would collapse if only the count were asserted.
		expect(player.item()?.id).toBe('second');
	});
});
