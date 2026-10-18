// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------
import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../adapters/event-bus/default';

describe('EventEmitter.once with a shared handler', () => {
	it('fires once when once() is called twice with the same handler and event', () => {
		const bus = new EventEmitter();
		const fn = vi.fn();
		bus.once('a', fn);
		bus.once('a', fn);
		bus.emit('a', 1);
		bus.emit('a', 2);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(bus.listenerCount()).toBe(0);
	});

	it('fires once per event when one handler is used for two events', () => {
		const bus = new EventEmitter();
		const fn = vi.fn();
		bus.once('a', fn);
		bus.once('b', fn);
		bus.emit('a');
		bus.emit('a');
		bus.emit('b');
		bus.emit('b');
		expect(fn).toHaveBeenCalledTimes(2);
		expect(bus.listenerCount()).toBe(0);
	});

	it('off(event, fn) cancels the pending once for that event only', () => {
		const bus = new EventEmitter();
		const fn = vi.fn();
		bus.once('a', fn);
		bus.once('b', fn);
		bus.off('a', fn);
		bus.emit('a');
		bus.emit('b');
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('keeps an on() handler running when the same fn also used once()', () => {
		const bus = new EventEmitter();
		const fn = vi.fn();
		bus.on('a', fn);
		bus.once('a', fn);
		bus.emit('a');
		bus.emit('a');
		expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2);
	});
});
