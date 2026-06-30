// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slice 03 — consequence-pinning tests for `loadingMethods`.
 *
 * Pinned consequences:
 *  8. `load(item)` with no URL rejects with a `MediaFormatError` whose code is
 *     `'core:media/missing-url'`.
 *  9. `load(item)` emits `beforeLoad` before calling the backend; calling
 *     `preventDefault()` on that event emits `loadPrevented` and suppresses
 *     the backend call entirely.
 */

import type { BaseEventMap, BasePlaylistItem } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	MediaFormatError,
	playerCoreMethods,
	PlayerError,
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
	declare load: (item: BasePlaylistItem, opts?: any) => Promise<void>;

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

describe('loadingMethods (slice 03)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('load(item) with no URL rejects with MediaFormatError code "core:media/missing-url"', async () => {
		const player = makeSetupPlayer('load-1');
		const item: BasePlaylistItem = { id: 'track-1', title: 'Missing URL track' } as BasePlaylistItem;

		let thrown: unknown;
		try {
			await player.load(item);
		}
		catch (err) {
			thrown = err;
		}

		expect(thrown).toBeInstanceOf(PlayerError);
		expect(thrown).toBeInstanceOf(MediaFormatError);
		expect((thrown as PlayerError).code).toBe('core:media/missing-url');
	});

	it('load(item) emits "beforeLoad" before calling backend; preventDefault suppresses backend and emits "loadPrevented"', async () => {
		const player = makeSetupPlayer('load-2');

		let backendLoadCalled = false;
		(player as unknown as { _resolveBackend: () => unknown })._resolveBackend = (): unknown => ({
			load: async (): Promise<void> => {
				backendLoadCalled = true;
			},
		});

		let beforeLoadFired = false;
		let loadPreventedFired = false;

		player.on('beforeLoad' as any, (event: { preventDefault: () => void }) => {
			beforeLoadFired = true;
			event.preventDefault();
		});

		player.on('loadPrevented' as any, () => {
			loadPreventedFired = true;
		});

		const item: BasePlaylistItem = { id: 'track-2', title: 'Prevented track', url: 'https://example.com/track.mp3' } as BasePlaylistItem;

		await player.load(item);

		expect(beforeLoadFired).toBe(true);
		expect(loadPreventedFired).toBe(true);
		expect(backendLoadCalled).toBe(false);
	});
});
