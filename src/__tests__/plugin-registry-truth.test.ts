// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Plugin.enabled() registry truth tests.
 *
 * Guards the fix from 2026-05-11:
 *   - A plugin whose use() throws must NOT appear in plugins() with enabled:false.
 *     Before the fix, the failed instance was pushed onto _plugins with
 *     _enabled:false (from disable('use-failed')), causing plugins() to return it
 *     and enabled() to lie — the DOM partially mounted by use() stayed visible
 *     while enabled() reported false.
 *   - After the fix: failed plugins are disposed+lifecycle-cleaned, NOT pushed
 *     onto _plugins. plugins() never returns them.
 *   - Explicitly calling plugin.disable() after successful use() is still valid
 *     and enabled() correctly returns false for that path.
 */

import type { BaseEventMap, BasePlaylistItem } from '../types';
import { afterEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	Plugin,
	resolvePlayerConstructor,
} from '../index';

const _instances = new Map<string, RegistryTruthPlayer>();

class RegistryTruthPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = document.createElement('div');

	get id(): string { return this.playerId; }

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare phase: () => string;
	declare dispatching: () => ReadonlyArray<string>;
	declare baseUrl: { (): string | undefined; (url: string): void };
	declare audioContext: () => AudioContext | undefined;
	declare experimental: unknown;
	declare t: (key: string, vars?: Record<string, string>) => string;
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
	declare bufferedRanges: () => TimeRanges;
	declare seekable: () => TimeRanges;
	declare timeData: () => unknown;
	declare seekByPercentage: (pct: number, opts?: unknown) => void;
	declare playbackRate: { (): number; (rate: number): void };
	declare playbackRates: () => number[];
	declare volume: { (): number; (level: number): void };
	declare mute: () => void;
	declare unmute: () => void;
	declare toggleMute: () => void;
	declare volumeUp: (step?: number) => void;
	declare volumeDown: (step?: number) => void;
	declare queue: { (): ReadonlyArray<BasePlaylistItem>; (items: BasePlaylistItem[], opts?: unknown): void };
	declare queueAppend: (item: BasePlaylistItem | BasePlaylistItem[], opts?: unknown) => void;
	declare queuePrepend: (item: BasePlaylistItem | BasePlaylistItem[], opts?: unknown) => void;
	declare queueInsert: (item: BasePlaylistItem | BasePlaylistItem[], index: number, opts?: unknown) => void;
	declare queueRemove: (id: string | number, opts?: unknown) => void;
	declare queueRemoveAt: (index: number, opts?: unknown) => void;
	declare queueMove: (from: number, to: number, opts?: unknown) => void;
	declare queueClear: (opts?: unknown) => void;
	declare queueShuffle: (opts?: unknown) => void;
	declare queueSort: (compare: (itemA: BasePlaylistItem, itemB: BasePlaylistItem) => number, opts?: unknown) => void;
	declare peekNext: () => BasePlaylistItem | undefined;
	declare peekPrevious: () => BasePlaylistItem | undefined;
	declare queueLength: () => number;
	declare queueIndexOf: (id: string | number) => number;
	declare item: { (): BasePlaylistItem | undefined; (target: BasePlaylistItem | string | number, opts?: unknown): void };
	declare index: () => number;
	declare seekToIndex: (position: number, opts?: unknown) => void;
	declare backlog: { (): ReadonlyArray<BasePlaylistItem>; (items: BasePlaylistItem[]): void };
	declare backlogAppend: (item: BasePlaylistItem | BasePlaylistItem[]) => void;
	declare backlogRemove: (id: string | number) => void;
	declare backlogClear: () => void;
	declare addPlugin: <P extends Plugin>(PluginClass: new () => P, opts?: P['opts']) => this;
	declare getPlugin: (PluginClass: unknown) => unknown;
	declare getPluginById: (id: string) => unknown;
	declare removePlugin: (PluginClass: unknown) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<Plugin>;
	declare enabledPlugins: () => ReadonlyArray<Plugin>;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'RegistryTruthPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'RegistryTruthPlayer');
		if (resolved.kind === 'existing')
			return resolved.instance as unknown as this;
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void { _instances.clear(); }
}

composeMixins(RegistryTruthPlayer.prototype, ...playerCoreMethods);

let playerDiv: HTMLDivElement;

function setupPlayer(): RegistryTruthPlayer {
	RegistryTruthPlayer._resetRegistry();
	playerDiv = document.createElement('div');
	playerDiv.id = 'rt-mock';
	document.body.appendChild(playerDiv);
	return new RegistryTruthPlayer('rt-mock').setup({});
}

afterEach(() => {
	RegistryTruthPlayer._resetRegistry();
	playerDiv?.remove();
});

describe('Plugin.enabled() registry truth', () => {
	describe('successful use() path', () => {
		class GoodPlugin extends Plugin {
			static override readonly id = 'good';
			static override readonly description = 'Good plugin';
			used = false;

			override use(): void { this.used = true; }
		}

		it('plugins() returns the instance after successful addPlugin', async () => {
			const player = setupPlayer();
			player.addPlugin(GoodPlugin);
			await player.ready();

			const list = player.plugins();
			expect(list).toHaveLength(1);
			expect((list[0]!.constructor as typeof Plugin).id).toBe('good');
		});

		it('enabled() returns true for a successfully loaded plugin', async () => {
			const player = setupPlayer();
			player.addPlugin(GoodPlugin);
			await player.ready();

			const instance = player.getPlugin(GoodPlugin) as GoodPlugin;
			expect(instance).toBeDefined();
			expect(instance.enabled()).toBe(true);
		});

		it('enabled() returns false after explicit disable() — legitimate path', async () => {
			const player = setupPlayer();
			player.addPlugin(GoodPlugin);
			await player.ready();

			const instance = player.getPlugin(GoodPlugin) as GoodPlugin;
			instance.disable();

			expect(instance.enabled()).toBe(false);
			expect(player.plugins()).toHaveLength(1);
		});

		it('enabledPlugins() excludes explicitly disabled plugins', async () => {
			const player = setupPlayer();
			player.addPlugin(GoodPlugin);
			await player.ready();

			const instance = player.getPlugin(GoodPlugin) as GoodPlugin;
			instance.disable();

			expect(player.enabledPlugins()).toHaveLength(0);
		});
	});

	describe('failed use() path — registry truth fix', () => {
		class BrokenPlugin extends Plugin {
			static override readonly id = 'broken';
			static override readonly description = 'Plugin whose use() throws';

			override use(): void {
				throw new Error('use() intentional failure');
			}
		}

		it('failed plugin is NOT returned by plugins() — no ghost instance', async () => {
			const player = setupPlayer();
			player.addPlugin(BrokenPlugin);
			await player.ready();

			const list = player.plugins();
			const brokenEntry = list.find(plugin => (plugin.constructor as typeof Plugin).id === 'broken');
			expect(brokenEntry).toBeUndefined();
		});

		it('plugin:failed event fires with the plugin id', async () => {
			const player = setupPlayer();
			const failures: string[] = [];
			player.on('plugin:failed' as any, (data: { id: string }) => { failures.push(data.id); });

			player.addPlugin(BrokenPlugin);
			await player.ready();

			expect(failures).toContain('broken');
		});

		it('getPlugin() returns undefined for a failed plugin', async () => {
			const player = setupPlayer();
			player.addPlugin(BrokenPlugin);
			await player.ready();

			const instance = player.getPlugin(BrokenPlugin);
			expect(instance).toBeUndefined();
		});

		it('plugins().length is 0 when the only plugin fails', async () => {
			const player = setupPlayer();
			player.addPlugin(BrokenPlugin);
			await player.ready();

			expect(player.plugins()).toHaveLength(0);
		});
	});

	describe('mixed — good and failed plugins', () => {
		class GoodPlugin2 extends Plugin {
			static override readonly id = 'good2';
			static override readonly description = 'Good plugin 2';
		}

		class BrokenPlugin2 extends Plugin {
			static override readonly id = 'broken2';
			static override readonly description = 'Broken plugin 2';
			override use(): void { throw new Error('broken2 fails'); }
		}

		it('good plugin appears in plugins(), failed plugin does not', async () => {
			const player = setupPlayer();
			player.addPlugin(GoodPlugin2);
			player.addPlugin(BrokenPlugin2);
			await player.ready();

			const ids = player.plugins().map(plugin => (plugin.constructor as typeof Plugin).id);
			expect(ids).toContain('good2');
			expect(ids).not.toContain('broken2');
		});

		it('enabled() is true for the good plugin and undefined-safe for failed', async () => {
			const player = setupPlayer();
			player.addPlugin(GoodPlugin2);
			player.addPlugin(BrokenPlugin2);
			await player.ready();

			const goodInstance = player.getPlugin(GoodPlugin2) as Plugin;
			expect(goodInstance.enabled()).toBe(true);

			const brokenInstance = player.getPlugin(BrokenPlugin2);
			expect(brokenInstance).toBeUndefined();
		});
	});
});
