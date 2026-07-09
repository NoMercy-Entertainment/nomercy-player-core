// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * `EventEmitter.listenersOf` — the internal snapshot API that
 * `runDispatchBefore` iterates so `stopImmediatePropagation()` can break the
 * chain (the standard `emit()` path cannot honour that semantic).
 *
 * Test groups:
 *  - empty / unknown events
 *  - insertion order + registration dedupe
 *  - live registry reflection (off / once)
 *  - snapshot semantics — mutating the returned array is inert
 */

import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../adapters/event-bus/default';

interface TestEventMap {
	tick: { count: number };
	other: void;
}

describe('EventEmitter.listenersOf()', () => {
	it('returns an empty array for an event nobody listens to', () => {
		const emitter = new EventEmitter<TestEventMap>();
		expect(emitter.listenersOf('tick')).toEqual([]);
	});

	it('returns the registered listeners in insertion order', () => {
		const emitter = new EventEmitter<TestEventMap>();
		const first = vi.fn();
		const second = vi.fn();
		const third = vi.fn();
		emitter.on('tick', first);
		emitter.on('tick', second);
		emitter.on('tick', third);

		expect(emitter.listenersOf('tick')).toEqual([
			first,
			second,
			third,
		]);
	});

	it('scopes listeners per event name', () => {
		const emitter = new EventEmitter<TestEventMap>();
		const tickListener = vi.fn();
		const otherListener = vi.fn();
		emitter.on('tick', tickListener);
		emitter.on('other', otherListener);

		expect(emitter.listenersOf('tick')).toEqual([tickListener]);
		expect(emitter.listenersOf('other')).toEqual([otherListener]);
	});

	it('deduplicates a function registered twice for the same event', () => {
		const emitter = new EventEmitter<TestEventMap>();
		const listener = vi.fn();
		emitter.on('tick', listener);
		emitter.on('tick', listener);

		expect(emitter.listenersOf('tick')).toHaveLength(1);
	});

	it('reflects off() — a removed listener no longer appears', () => {
		const emitter = new EventEmitter<TestEventMap>();
		const keep = vi.fn();
		const drop = vi.fn();
		emitter.on('tick', keep);
		emitter.on('tick', drop);

		emitter.off('tick', drop);

		expect(emitter.listenersOf('tick')).toEqual([keep]);
	});

	it('returns an empty array after off(event) removes all listeners', () => {
		const emitter = new EventEmitter<TestEventMap>();
		emitter.on('tick', vi.fn());
		emitter.on('tick', vi.fn());

		emitter.off('tick');

		expect(emitter.listenersOf('tick')).toEqual([]);
	});

	it('a once() registration appears until it fires, then disappears', () => {
		const emitter = new EventEmitter<TestEventMap>();
		emitter.once('tick', vi.fn());
		expect(emitter.listenersOf('tick')).toHaveLength(1);

		emitter.emit('tick', { count: 1 });
		expect(emitter.listenersOf('tick')).toEqual([]);
	});

	it('returns a snapshot — mutating the returned array does not unregister anything', () => {
		const emitter = new EventEmitter<TestEventMap>();
		const listener = vi.fn();
		emitter.on('tick', listener);

		const snapshot = emitter.listenersOf('tick') as Array<(data: TestEventMap['tick']) => void>;
		snapshot.length = 0;

		expect(emitter.listenersOf('tick')).toEqual([listener]);
		emitter.emit('tick', { count: 1 });
		expect(listener).toHaveBeenCalledTimes(1);
	});
});
