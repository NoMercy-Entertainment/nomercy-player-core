// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * `EventEmitter`'s `RENAMED_EVENTS` runtime warn (R1 fallback) — the
 * documented substitute for narrowing `on()`'s bare-`string` escape hatch,
 * which would break `Plugin.on()`'s internal implementation (see
 * `adapters/event-bus/default.ts` and `IPlayer.on()`'s escape-hatch overload
 * docs for the full reasoning).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../adapters/event-bus/default';

interface TestEventMap {
	item: { item: unknown; index: number };
	play: void;
}

describe('EventEmitter — RENAMED_EVENTS runtime warn', () => {
	let warnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		warnSpy.mockRestore();
	});

	it('warns once with the replacement name when subscribing to the renamed \'current\' event', () => {
		const emitter = new EventEmitter<TestEventMap>();
		emitter.on('current' as unknown as 'item', () => {});

		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0]?.[0]).toContain('current');
		expect(warnSpy.mock.calls[0]?.[0]).toContain('item');
	});

	it('does not warn for the current, correct event name', () => {
		const emitter = new EventEmitter<TestEventMap>();
		emitter.on('item', () => {});

		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('does not warn for a plugin-namespaced dynamic event name', () => {
		const emitter = new EventEmitter<TestEventMap>();
		emitter.on('plugin:lyrics:lineEnter', () => {});

		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('does not warn for an unrelated, never-renamed event name', () => {
		const emitter = new EventEmitter<TestEventMap>();
		emitter.on('play', () => {});

		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('a listener on the renamed event still never fires — the warn is diagnostic only, not a redirect', () => {
		const emitter = new EventEmitter<TestEventMap>();
		const staleHandler = vi.fn();
		emitter.on('current' as unknown as 'item', staleHandler);

		emitter.emit('item', { item: undefined, index: 0 });

		expect(staleHandler).not.toHaveBeenCalled();
	});

	it('also warns when the renamed event is subscribed via once()', () => {
		const emitter = new EventEmitter<TestEventMap>();
		emitter.once('current' as unknown as 'item', () => {});

		expect(warnSpy).toHaveBeenCalledTimes(1);
	});
});
