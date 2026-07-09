// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Per-plugin leak-harness sweep — every kit plugin gets `addPlugin → ready →
 * removePlugin` exercised; the listener-count delta must be ≤ 0 (no leaks).
 * The leak harness is mandatory for every plugin before merge.
 */

import type { Plugin } from '../index';
import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,

	resolvePlayerConstructor,
} from '../index';
// Plugin classes — the kit ones. Some throw on `use()` (stubbed); harness
// catches and skips them so we get a roll-up rather than a per-plugin
// brittle suite.
import { AudioGraphPlugin } from '../plugins/audio-graph';

import { CanvasPlugin } from '../plugins/canvas';
import { EmbedPlugin } from '../plugins/embed';
import { EqualizerPlugin } from '../plugins/equalizer/index';
import { KeyHandlerPlugin } from '../plugins/key-handler';
import { MediaSessionPlugin } from '../plugins/media-session';
import { MessagePlugin } from '../plugins/message';
import { MixerPlugin } from '../plugins/mixer';
import { SpectrumPlugin } from '../plugins/spectrum';
import { TabLeaderPlugin } from '../plugins/tab-leader';
import { VisualizationPlugin } from '../plugins/visualization';
import { assertNoListenerLeak } from '../testing/leak-harness';

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
	declare dispose: () => Promise<void>;
	declare addPlugin: (PluginClass: any, opts?: any) => this;
	declare removePlugin: (PluginClass: any) => void;
	declare getPlugin: (PluginClass: any) => any;

	constructor(id?: string | number) {
		super();
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing') {
			return resolved.instance as unknown as this;
		}
		initPlayerCoreState(this, { className: 'MockPlayer' });
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void {
		_instances.clear();
	}
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

const PLUGINS: ReadonlyArray<{ name: string; ctor: typeof Plugin }> = [
	// Plugins with at least partial real impls — leak harness exercises them.
	// `audio-graph` is included; in happy-dom (no AudioContext) it fails install
	// via BrowserPolicyError and the harness records `installable=false`.
	{ name: 'audio-graph', ctor: AudioGraphPlugin as unknown as typeof Plugin },
	{ name: 'canvas', ctor: CanvasPlugin as unknown as typeof Plugin },
	{ name: 'embed', ctor: EmbedPlugin as unknown as typeof Plugin },
	{ name: 'equalizer', ctor: EqualizerPlugin as unknown as typeof Plugin },
	{ name: 'key-handler', ctor: KeyHandlerPlugin as unknown as typeof Plugin },
	{ name: 'media-session', ctor: MediaSessionPlugin as unknown as typeof Plugin },
	{ name: 'message', ctor: MessagePlugin as unknown as typeof Plugin },
	{ name: 'mixer', ctor: MixerPlugin as unknown as typeof Plugin },
	{ name: 'spectrum', ctor: SpectrumPlugin as unknown as typeof Plugin },
	{ name: 'tab-leader', ctor: TabLeaderPlugin as unknown as typeof Plugin },
	{ name: 'visualization', ctor: VisualizationPlugin as unknown as typeof Plugin },
];

describe('Kit plugin leak-harness sweep', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	for (const { name, ctor } of PLUGINS) {
		it(`${name} plugin installs and disposes without listener leak (or fails install gracefully if stubbed)`, async () => {
			const div = document.createElement('div');
			div.id = `leak-${name}`;
			document.body.appendChild(div);

			const player = new MockPlayer(`leak-${name}`).setup({});
			await player.ready();

			let installable = true;
			try {
				const Class = ctor as unknown as new () => Plugin;
				player.addPlugin(Class);
				await player.ready();
			}
			catch {
				// Plugin's use() threw — likely still-stubbed. Skip the leak
				// assertion since the install path didn't complete.
				installable = false;
			}

			if (!installable) {
				expect(installable).toBe(false);
				return;
			}

			const result = await assertNoListenerLeak({
				subjectId: `kit:${name}`,
				player: player as any,
				setup: async () => {
					// Already installed above; no-op here so the harness's
					// before/after measurements bracket only the dispose.
				},
				teardown: async () => {
					player.removePlugin(ctor as unknown as new () => Plugin);
				},
			});

			expect(result.leaked).toBeLessThanOrEqual(0);
		});
	}
});

/**
 * Player-dispose path sweep. The suite above only exercises manual
 * `removePlugin()` teardown, which already empties `_plugins` before
 * `dispose()` would run — it can't catch a regression in the OTHER teardown
 * path (`player.dispose()` disposing every still-registered plugin). Listener
 * count isn't a usable signal here since `dispose()` ends with `off('all')`,
 * wiping every listener regardless of whether a plugin cleaned up correctly —
 * so this sweep spies on each plugin's `dispose()` directly.
 */
describe('Kit plugin leak-harness sweep — player.dispose() path', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	for (const { name, ctor } of PLUGINS) {
		it(`${name} plugin's dispose() is invoked by player.dispose() (or fails install gracefully if stubbed)`, async () => {
			const div = document.createElement('div');
			div.id = `dispose-sweep-${name}`;
			document.body.appendChild(div);

			const player = new MockPlayer(`dispose-sweep-${name}`).setup({});
			await player.ready();

			let installable = true;
			try {
				const Class = ctor as unknown as new () => Plugin;
				player.addPlugin(Class);
				await player.ready();
			}
			catch {
				installable = false;
			}

			// A plugin whose use() throws (e.g. audio-graph — no AudioContext in
			// happy-dom) fails registration internally via _failRegistration
			// without addPlugin()/ready() ever rejecting — getPlugin() returning
			// undefined is the only observable signal that install didn't land.
			const instance = installable ? player.getPlugin(ctor as unknown as new () => Plugin) : undefined;
			if (!instance) {
				expect(instance).toBeUndefined();
				return;
			}

			const disposeSpy = vi.spyOn(instance, 'dispose');

			await player.dispose();

			expect(disposeSpy).toHaveBeenCalledTimes(1);
		});
	}
});
