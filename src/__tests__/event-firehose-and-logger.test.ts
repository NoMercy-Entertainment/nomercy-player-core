// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * `on('all')` firehose + core logger — why a codec error on a user's machine
 * produced a completely silent console:
 *
 *  1. `on('all', fn)` registered a listener for a literal event named "all"
 *     that never fired — v1 consumers (`player.on('all', console.log)`) got a
 *     silent no-op in v2.
 *  2. `logLevel` only fed plugin child-loggers; the core never logged events
 *     or errors at all.
 *
 * The firehose receives `(event, data)` for every emit; `_wireLogger` routes
 * `error` / `<stage>Error` events to `logger.error` at every level and the
 * full event stream to `logger.debug` at debug/trace.
 */

import type { BaseEventMap } from '../types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../adapters/event-bus/default';
import { Logger } from '../adapters/logger/default';
import {
	composeMixins,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';

describe('EventEmitter — on(\'all\') firehose', () => {
	it('receives every emit with (event, data)', () => {
		const bus = new EventEmitter();
		const seen: Array<[string, unknown]> = [];
		bus.on('all', (event, data) => seen.push([event, data]));

		bus.emit('play', { source: 'user' });
		bus.emit('pause');

		expect(seen).toEqual([
			['play', { source: 'user' }],
			['pause', undefined],
		]);
	});

	it('fires alongside specific listeners without disturbing them', () => {
		const bus = new EventEmitter();
		const specific = vi.fn();
		const fire = vi.fn();
		bus.on('play', specific);
		bus.on('all', fire);

		bus.emit('play', 1);

		expect(specific).toHaveBeenCalledWith(1);
		expect(fire).toHaveBeenCalledWith('play', 1);
	});

	it('off(\'all\', fn) removes only that firehose listener', () => {
		const bus = new EventEmitter();
		const handlerA = vi.fn();
		const handlerB = vi.fn();
		bus.on('all', handlerA);
		bus.on('all', handlerB);

		bus.off('all', handlerA);
		bus.emit('x');

		expect(handlerA).not.toHaveBeenCalled();
		expect(handlerB).toHaveBeenCalledWith('x', undefined);
	});

	it('off(\'all\') without fn still nukes everything, firehose included', () => {
		const bus = new EventEmitter();
		const specific = vi.fn();
		const fire = vi.fn();
		bus.on('play', specific);
		bus.on('all', fire);

		bus.off('all');
		bus.emit('play');

		expect(specific).not.toHaveBeenCalled();
		expect(fire).not.toHaveBeenCalled();
		expect(bus.listenerCount()).toBe(0);
	});

	it('once(\'all\', fn) fires for exactly one event', () => {
		const bus = new EventEmitter();
		const fire = vi.fn();
		bus.once('all', fire);

		bus.emit('a', 1);
		bus.emit('b', 2);

		expect(fire).toHaveBeenCalledTimes(1);
		expect(fire).toHaveBeenCalledWith('a', 1);
	});

	it('does not make hasListeners(event) true — capability gates stay specific', () => {
		const bus = new EventEmitter();
		bus.on('all', vi.fn());
		// e.g. desktop-ui shows the back button when a 'back' listener exists;
		// a debugging firehose must never flip such gates.
		expect(bus.hasListeners('back')).toBe(false);
	});
});

// ── Core logger wiring ───────────────────────────────────────────────────────

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

function makePlayer(divId: string, config: Record<string, unknown>): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId).setup(config);
}

describe('core logger (_wireLogger)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('error events reach logger.error at the default level', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const player = makePlayer('log-default', {});
		await player.ready();
		errorSpy.mockClear();

		player.emit('error', { error: new Error('codec boom') });

		expect(errorSpy).toHaveBeenCalled();
		const call = errorSpy.mock.calls.at(-1)!;
		expect(call.join(' ')).toContain('error');
	});

	it('logLevel debug logs ordinary events to the console', async () => {
		const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		const player = makePlayer('log-debug', { logLevel: 'debug' });
		await player.ready();
		debugSpy.mockClear();

		player.emit('play', { source: 'user' });

		expect(debugSpy.mock.calls.some(call => call.includes('play'))).toBe(true);
	});

	it('suppresses the time clock below trace', async () => {
		const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		const player = makePlayer('log-clock', { logLevel: 'debug' });
		await player.ready();
		debugSpy.mockClear();

		player.emit('time', { time: 1 });

		expect(debugSpy.mock.calls.some(call => call.includes('time'))).toBe(false);
	});

	it('a consumer-supplied logger instance wins over logLevel', async () => {
		const custom = new Logger({ level: 'debug', prefix: 'custom' });
		const sink = vi.fn();
		custom.addSink(sink);

		const player = makePlayer('log-custom', { logger: custom });
		await player.ready();
		sink.mockClear();

		player.emit('play', undefined);

		expect(sink.mock.calls.some(call => call[2]?.includes?.('play') || call[2]?.[0] === 'play')).toBe(true);
	});
});
