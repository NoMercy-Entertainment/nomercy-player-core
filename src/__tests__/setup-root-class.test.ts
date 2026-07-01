// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * setup() self-applies `.nomercyplayer` — S00-R2
 *
 * The player must stamp its root class onto the container during setup()
 * so consumers never have to add it manually, and plugin CSS matches from
 * the moment the first plugin is registered.
 *
 * Tests:
 *  - bare container (no pre-applied class) gains `.nomercyplayer` after setup
 *  - classList.add is idempotent — container that already has the class stays at exactly one
 *  - class is present before any plugin's DOM is built (synchronous, not deferred)
 */

import type { Plugin } from '../index';
import type { BaseEventMap, PluginCtorWithId } from '../types';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';

const _instances = new Map<string, RootClassPlayer>();

class RootClassPlayer extends EventEmitter<BaseEventMap> {
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
	declare dispatching: () => ReadonlyArray<string>;
	declare baseUrl: { (): string | undefined; (url: string): void };
	declare audioContext: () => AudioContext | undefined;
	declare experimental: unknown;
	declare t: {
		(key: string, vars?: Record<string, string>): string;
		(PluginClass: PluginCtorWithId, key: string, vars?: Record<string, string>): string;
	};

	declare language: { (): string; (lang: string): Promise<void> };
	declare addTranslations: (bundle: unknown) => void;
	declare translation: (lang: string, key: string, value: string) => void;
	declare removeTranslations: (prefix: string, lang?: string) => void;
	declare registerCueParser: (parser: unknown, prepend?: boolean) => void;
	declare unregisterCueParser: (id: string) => void;
	declare play: (opts?: unknown) => Promise<void>;
	declare pause: (opts?: unknown) => Promise<void>;
	declare stop: (opts?: unknown) => Promise<void>;
	declare togglePlayback: (opts?: unknown) => Promise<void>;
	declare next: (opts?: unknown) => Promise<void>;
	declare previous: (opts?: unknown) => Promise<void>;
	declare rewind: (seconds?: number, opts?: unknown) => Promise<void>;
	declare forward: (seconds?: number, opts?: unknown) => Promise<void>;
	declare restart: (opts?: unknown) => Promise<void>;
	declare time: { (): number; (seconds: number, opts?: unknown): Promise<void> };
	declare duration: () => number;
	declare buffered: () => number;
	declare timeData: () => unknown;
	declare playbackRate: { (): number; (rate: number): void };
	declare playbackRates: () => number[];
	declare volume: { (): number; (level: number): void };
	declare mute: () => void;
	declare unmute: () => void;
	declare toggleMute: () => void;
	declare volumeUp: (step?: number) => void;
	declare volumeDown: (step?: number) => void;
	declare playState: () => string;
	declare volumeState: () => string;
	declare repeatState: { (): string; (state: unknown): void };
	declare shuffleState: { (): string; (state: unknown): void };
	declare queue: { (): ReadonlyArray<unknown>; (items: unknown[], opts?: unknown): void };
	declare queueAppend: (item: unknown, opts?: unknown) => void;
	declare queuePrepend: (item: unknown, opts?: unknown) => void;
	declare queueInsert: (item: unknown, index: number, opts?: unknown) => void;
	declare queueRemove: (id: unknown, opts?: unknown) => void;
	declare queueRemoveAt: (index: number, opts?: unknown) => void;
	declare queueMove: (from: number, to: number, opts?: unknown) => void;
	declare queueClear: (opts?: unknown) => void;
	declare queueShuffle: (opts?: unknown) => void;
	declare queueSort: (compare: unknown, opts?: unknown) => void;
	declare peekNext: () => unknown;
	declare peekPrevious: () => unknown;
	declare queueLength: () => number;
	declare queueIndexOf: (id: unknown) => number;
	declare item: { (): unknown; (target: unknown, opts?: unknown): void };
	declare index: () => number;
	declare backlog: { (): ReadonlyArray<unknown>; (items: unknown[]): void };
	declare backlogAppend: (item: unknown) => void;
	declare backlogRemove: (id: unknown) => void;
	declare backlogClear: () => void;
	declare addPlugin: <P extends Plugin>(PluginClass: new () => P, opts?: P['opts']) => this;
	declare getPlugin: (PluginClass: unknown) => unknown;
	declare getPluginById: (id: string) => unknown;
	declare removePlugin: (PluginClass: unknown) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<unknown>;
	declare enabledPlugins: () => ReadonlyArray<unknown>;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'RootClassPlayer' });

		const resolved = resolvePlayerConstructor(id, _instances, 'RootClassPlayer');
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

composeMixins(RootClassPlayer.prototype, ...playerCoreMethods);

describe('setup() self-applies .nomercyplayer (S00-R2)', () => {
	beforeEach(() => {
		RootClassPlayer._resetRegistry();
	});

	afterEach(() => {
		RootClassPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('bare container (no pre-applied class) gains .nomercyplayer after setup()', () => {
		const div = document.createElement('div');
		div.id = 'root-class-test';
		document.body.appendChild(div);
		expect(div.classList.contains('nomercyplayer')).toBe(false);

		new RootClassPlayer('root-class-test').setup({});

		expect(div.classList.contains('nomercyplayer')).toBe(true);
	});

	it('container that already carries .nomercyplayer has the class exactly once after setup()', () => {
		const div = document.createElement('div');
		div.id = 'root-class-pre';
		div.classList.add('nomercyplayer');
		document.body.appendChild(div);

		new RootClassPlayer('root-class-pre').setup({});

		const count = [...div.classList].filter(cls => cls === 'nomercyplayer').length;
		expect(count).toBe(1);
	});

	it('.nomercyplayer is present synchronously at the end of the setup() call (before async pipeline)', () => {
		const div = document.createElement('div');
		div.id = 'root-class-sync';
		document.body.appendChild(div);

		const player = new RootClassPlayer('root-class-sync').setup({});

		expect(player.container.classList.contains('nomercyplayer')).toBe(true);
	});
});
