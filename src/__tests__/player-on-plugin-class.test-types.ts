// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------
/**
 * Type-level proof that `player.on(PluginClass, event, fn)` types the payload
 * from the plugin's event map for external consumers. Checked by `tsc --noEmit`.
 */

import type { BaseEventMap, IPlayer } from '../types';
import { Plugin } from '../core/plugin';

interface BarEvents {
	resize: { width: number; height: number };
}

class BarPlugin extends Plugin<IPlayer<BaseEventMap>, Record<string, never>, BarEvents> {
	static override readonly id = 'bar';
	static override readonly description = 'type-test bar plugin';
}

declare const player: IPlayer<BaseEventMap>;

player.on(BarPlugin, 'resize', (data) => {
	const width: number = data.width;
	void width;
	// @ts-expect-error 'ABSENT' is not in the event payload
	void data.ABSENT;
});

// @ts-expect-error 'nope' is not an event of BarPlugin
player.on(BarPlugin, 'nope', () => {});

player.once(BarPlugin, 'resize', (data) => {
	void data.height;
});

function handler(data: BarEvents['resize']): void {
	void data;
}
player.on(BarPlugin, 'resize', handler);
player.off(BarPlugin, 'resize', handler);

// The string form still compiles.
player.on('plugin:bar:resize', (data: BarEvents['resize']) => {
	void data.width;
});
