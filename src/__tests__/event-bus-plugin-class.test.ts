import type { BaseEventMap, IPlayer } from '../types';
// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------
import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../adapters/event-bus/default';
import { Plugin } from '../core/plugin';

interface FooEvents {
	resize: { width: number; height: number };
}

class FooPlugin extends Plugin<IPlayer<BaseEventMap>, Record<string, never>, FooEvents> {
	static override readonly id = 'foo';
	static override readonly description = 'class-form listener fixture';
}

describe('EventEmitter class-form listeners', () => {
	it('on(PluginClass, event, fn) receives the plugin-namespaced event', () => {
		const bus = new EventEmitter();
		const fn = vi.fn();
		bus.on(FooPlugin, 'resize', fn);
		bus.emit('plugin:foo:resize', { width: 1, height: 2 });
		expect(fn).toHaveBeenCalledWith({ width: 1, height: 2 });
	});

	it('once(PluginClass, event, fn) fires one time', () => {
		const bus = new EventEmitter();
		const fn = vi.fn();
		bus.once(FooPlugin, 'resize', fn);
		bus.emit('plugin:foo:resize', { width: 1, height: 2 });
		bus.emit('plugin:foo:resize', { width: 3, height: 4 });
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('off(PluginClass, event, fn) removes the listener', () => {
		const bus = new EventEmitter();
		const fn = vi.fn();
		bus.on(FooPlugin, 'resize', fn);
		bus.off(FooPlugin, 'resize', fn);
		bus.emit('plugin:foo:resize', { width: 1, height: 2 });
		expect(fn).not.toHaveBeenCalled();
	});

	it('the string form keeps working', () => {
		const bus = new EventEmitter();
		const fn = vi.fn();
		bus.on('plugin:foo:resize', fn);
		bus.emit('plugin:foo:resize', 5);
		expect(fn).toHaveBeenCalledWith(5);
	});
});
