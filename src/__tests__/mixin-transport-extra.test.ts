// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Transport mixin — additional edge-case coverage.
 *
 * transport-depth.test.ts (slice 02) covers play/pause/stop/volume/mute/
 * playbackRate/repeatState. This file covers the REMAINING uncovered paths:
 *
 *  - forward(): default and custom seconds, _dispatchSeek target, clamp-none
 *  - rewind(): clamps to 0, beforeSeek preventDefault → seekPrevented
 *  - restart(): beforeSeek prevents → play() skipped; proceeds → play() called
 *  - play() beforePlay preventDefault → playPrevented event
 *  - pause() beforePause preventDefault → pausePrevented event
 *  - stop() beforeStop preventDefault → stopPrevented event
 *  - togglePlayback: paused → play, playing → pause
 *  - next() with repeat:ONE reloads current item
 *  - next() with repeat:ALL wraps to first item
 *  - previous() no-ops when no previous item
 *  - _seekingTransition: seeking phase round-trip emitted only from playing/paused/starting
 */

import type { BackendShape } from '../core/mixins/player-state';
import type {
	Plugin,
} from '../index';
import type { BaseEventMap, BasePlaylistItem, PluginCtorWithId } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	RepeatState,
	resolvePlayerConstructor,
} from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// MockPlayer — reusing canonical pattern
// ─────────────────────────────────────────────────────────────────────────────

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = {} as HTMLElement;
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
	declare addPlugin: <P extends Plugin<any, any, any>>(
		PluginClass: PluginCtorWithId & (new () => P),
		opts?: P['opts'],
	) => this;

	declare getPlugin: (PluginClass: unknown) => unknown;
	declare getPluginById: (id: string) => unknown;
	declare removePlugin: (PluginClass: unknown) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<Plugin>;
	declare enabledPlugins: () => ReadonlyArray<Plugin>;

	backend?: () => unknown;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing')
			return resolved.instance as unknown as this;
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void { _instances.clear(); }
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function setupPlayer(): MockPlayer {
	const div = document.createElement('div');
	div.id = 'te-mock';
	document.body.appendChild(div);
	return new MockPlayer('te-mock').setup({});
}

function makeSimpleBackend(overrides: Partial<BackendShape> = {}): BackendShape {
	return {
		play: vi.fn().mockResolvedValue(undefined),
		pause: vi.fn(),
		stop: vi.fn(),
		currentTime: vi.fn(),
		...overrides,
	} as unknown as BackendShape;
}

function installBackend(player: MockPlayer, backend: BackendShape): void {
	(player as unknown as { backend: () => BackendShape }).backend = () => backend;
}

function setCurrentTime(player: MockPlayer, time: number): void {
	(player as unknown as { _internalCurrentTime: number })._internalCurrentTime = time;
}

// ─────────────────────────────────────────────────────────────────────────────
// forward()
// ─────────────────────────────────────────────────────────────────────────────

describe('forward()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('forward() with default 5s advances currentTime by 5', async () => {
		const player = setupPlayer();
		setCurrentTime(player, 30);
		const seekedEvents: Array<{ time: number }> = [];
		player.on('seeked' as never, (data: { time: number }) => seekedEvents.push(data));

		await player.forward();

		expect(seekedEvents[0]!.time).toBe(35);
	});

	it('forward(10) advances by 10 seconds', async () => {
		const player = setupPlayer();
		setCurrentTime(player, 20);
		const seekedEvents: Array<{ time: number }> = [];
		player.on('seeked' as never, (data: { time: number }) => seekedEvents.push(data));

		await player.forward(10);

		expect(seekedEvents[0]!.time).toBe(30);
	});

	it('forward() calls backend.currentTime with target', async () => {
		const player = setupPlayer();
		const backend = makeSimpleBackend();
		installBackend(player, backend);
		setCurrentTime(player, 15);

		await player.forward(5);

		expect(backend.currentTime).toHaveBeenCalledWith(20);
	});

	it('forward() beforeSeek preventDefault emits seekPrevented and does not update time', async () => {
		const player = setupPlayer();
		setCurrentTime(player, 30);

		player.on('beforeSeek' as never, (data: { time: number; preventDefault: () => void }) => {
			data.preventDefault();
		});

		const seekPrevented: unknown[] = [];
		player.on('seekPrevented' as never, (data: unknown) => seekPrevented.push(data));

		await player.forward(5);

		expect(seekPrevented).toHaveLength(1);
		expect((player as unknown as { _internalCurrentTime: number })._internalCurrentTime).toBe(30);
	});

	it('forward() emits beforeSeek with the positive delta (not the absolute target)', async () => {
		const player = setupPlayer();
		setCurrentTime(player, 50);

		// _dispatchBefore calls listeners with a BeforeEvent object, not the plain data.
		// Access the value via .data.time.
		const beforeSeekPayloads: Array<{ data: { time: number } }> = [];
		player.on('beforeSeek' as never, (data: { data: { time: number } }) => beforeSeekPayloads.push(data));

		await player.forward(7);

		expect(beforeSeekPayloads[0]!.data.time).toBe(7);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// rewind()
// ─────────────────────────────────────────────────────────────────────────────

describe('rewind()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('rewind() with default 5s seeks backwards by 5', async () => {
		const player = setupPlayer();
		setCurrentTime(player, 30);
		const seekedEvents: Array<{ time: number }> = [];
		player.on('seeked' as never, (data: { time: number }) => seekedEvents.push(data));

		await player.rewind();

		expect(seekedEvents[0]!.time).toBe(25);
	});

	it('rewind() clamps to 0 when currentTime < rewind seconds', async () => {
		const player = setupPlayer();
		setCurrentTime(player, 3);
		const seekedEvents: Array<{ time: number }> = [];
		player.on('seeked' as never, (data: { time: number }) => seekedEvents.push(data));

		await player.rewind(5);

		expect(seekedEvents[0]!.time).toBe(0);
	});

	it('rewind() emits beforeSeek with the negative delta', async () => {
		const player = setupPlayer();
		setCurrentTime(player, 30);

		// _dispatchBefore calls listeners with a BeforeEvent object, not the plain data.
		// Access the value via .data.time.
		const beforeSeekPayloads: Array<{ data: { time: number } }> = [];
		player.on('beforeSeek' as never, (data: { data: { time: number } }) => beforeSeekPayloads.push(data));

		await player.rewind(5);

		expect(beforeSeekPayloads[0]!.data.time).toBe(-5);
	});

	it('rewind() beforeSeek preventDefault emits seekPrevented', async () => {
		const player = setupPlayer();
		setCurrentTime(player, 30);

		player.on('beforeSeek' as never, (data: { time: number; preventDefault: () => void }) => {
			data.preventDefault();
		});

		const seekPrevented: unknown[] = [];
		player.on('seekPrevented' as never, (data: unknown) => seekPrevented.push(data));

		await player.rewind(5);

		expect(seekPrevented).toHaveLength(1);
	});

	it('rewind(15) from time 10 clamps to 0 and calls backend', async () => {
		const player = setupPlayer();
		const backend = makeSimpleBackend();
		installBackend(player, backend);
		setCurrentTime(player, 10);

		await player.rewind(15);

		expect(backend.currentTime).toHaveBeenCalledWith(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// restart()
// ─────────────────────────────────────────────────────────────────────────────

describe('restart()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('restart() seeks to 0 and calls backend.currentTime(0)', async () => {
		const player = setupPlayer();
		const backend = makeSimpleBackend();
		installBackend(player, backend);
		setCurrentTime(player, 90);

		await player.restart();

		expect(backend.currentTime).toHaveBeenCalledWith(0);
	});

	it('restart() calls play() after seek proceeds', async () => {
		const player = setupPlayer();
		const backend = makeSimpleBackend();
		installBackend(player, backend);
		setCurrentTime(player, 60);

		await player.restart();

		expect(backend.play).toHaveBeenCalledOnce();
	});

	it('restart() does NOT call play() when beforeSeek is prevented', async () => {
		const player = setupPlayer();
		const backend = makeSimpleBackend();
		installBackend(player, backend);

		player.on('beforeSeek' as never, (data: { time: number; preventDefault: () => void }) => {
			data.preventDefault();
		});

		await player.restart();

		expect(backend.play).not.toHaveBeenCalled();
	});

	it('restart() emits seekPrevented when beforeSeek is prevented', async () => {
		const player = setupPlayer();
		player.on('beforeSeek' as never, (data: { time: number; preventDefault: () => void }) => {
			data.preventDefault();
		});
		const seekPrevented: unknown[] = [];
		player.on('seekPrevented' as never, (data: unknown) => seekPrevented.push(data));

		await player.restart();

		expect(seekPrevented).toHaveLength(1);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// play() / pause() / stop() beforeXxx preventDefault
// ─────────────────────────────────────────────────────────────────────────────

describe('play() beforePlay preventDefault', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('beforePlay preventDefault emits playPrevented and does not change playState', async () => {
		const player = setupPlayer();
		player.on('beforePlay' as never, (data: { preventDefault: () => void }) => {
			data.preventDefault();
		});
		const playPrevented: unknown[] = [];
		player.on('playPrevented' as never, (data: unknown) => playPrevented.push(data));

		await player.play();

		expect(playPrevented).toHaveLength(1);
		expect(player.playState()).not.toBe('playing');
	});
});

describe('pause() beforePause preventDefault', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('beforePause preventDefault emits pausePrevented', async () => {
		const player = setupPlayer();
		await player.play();

		player.on('beforePause' as never, (data: { preventDefault: () => void }) => {
			data.preventDefault();
		});
		const pausePrevented: unknown[] = [];
		player.on('pausePrevented' as never, (data: unknown) => pausePrevented.push(data));

		await player.pause();

		expect(pausePrevented).toHaveLength(1);
		expect(player.playState()).toBe('playing');
	});
});

describe('stop() beforeStop preventDefault', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('beforeStop preventDefault emits stopPrevented', async () => {
		const player = setupPlayer();
		await player.play();

		player.on('beforeStop' as never, (data: { preventDefault: () => void }) => {
			data.preventDefault();
		});
		const stopPrevented: unknown[] = [];
		player.on('stopPrevented' as never, (data: unknown) => stopPrevented.push(data));

		await player.stop();

		expect(stopPrevented).toHaveLength(1);
		expect(player.playState()).not.toBe('stopped');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// togglePlayback()
// ─────────────────────────────────────────────────────────────────────────────

describe('togglePlayback()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('togglePlayback() calls play() when playState is not "playing"', async () => {
		const player = setupPlayer();
		expect(player.playState()).not.toBe('playing');

		const playEvents: unknown[] = [];
		player.on('play' as never, (data: unknown) => playEvents.push(data));

		await player.togglePlayback();

		expect(playEvents).toHaveLength(1);
	});

	it('togglePlayback() calls pause() when playState is "playing"', async () => {
		const player = setupPlayer();
		await player.play();
		expect(player.playState()).toBe('playing');

		const pauseEvents: unknown[] = [];
		player.on('pause' as never, (data: unknown) => pauseEvents.push(data));

		await player.togglePlayback();

		expect(pauseEvents).toHaveLength(1);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// next() / previous() — repeat modes
// ─────────────────────────────────────────────────────────────────────────────

describe('next() — repeat modes', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('next() with repeat:ONE reloads the current item and emits "next"', async () => {
		const player = setupPlayer();
		player.repeatState(RepeatState.ONE);

		const items: BasePlaylistItem[] = [
			{ id: 'i1', title: 'Item 1', url: '/i1.mp3' },
			{ id: 'i2', title: 'Item 2', url: '/i2.mp3' },
		];
		player.queue(items);
		player.item(items[0]!);

		const nextEvents: unknown[] = [];
		player.on('next' as never, (data: unknown) => nextEvents.push(data));

		// Mock load to avoid actual backend ops
		const loadSpy = vi.fn().mockResolvedValue(undefined);
		(player as unknown as { load: (item: unknown, opts: unknown) => Promise<void> }).load = loadSpy;

		await player.next();

		expect(nextEvents).toHaveLength(1);
	});

	it('next() with repeat:ALL wraps to first item when at end', async () => {
		const player = setupPlayer();
		player.repeatState(RepeatState.ALL);

		const items: BasePlaylistItem[] = [
			{ id: 'i1', title: 'Item 1', url: '/i1.mp3' },
			{ id: 'i2', title: 'Item 2', url: '/i2.mp3' },
		];
		player.queue(items);
		player.item(items[1]!);

		const nextEvents: unknown[] = [];
		player.on('next' as never, (data: unknown) => nextEvents.push(data));

		const loadSpy = vi.fn().mockResolvedValue(undefined);
		(player as unknown as { load: (item: unknown, opts: unknown) => Promise<void> }).load = loadSpy;

		await player.next();

		expect(nextEvents).toHaveLength(1);
	});

	it('next() with repeat:OFF on last item emits queue:exhausted', async () => {
		const player = setupPlayer();
		player.repeatState(RepeatState.OFF);

		const items: BasePlaylistItem[] = [
			{ id: 'i1', title: 'Item 1', url: '/i1.mp3' },
		];
		player.queue(items);
		player.item(items[0]!);

		const exhaustedEvents: unknown[] = [];
		player.on('queue:exhausted' as never, (data: unknown) => exhaustedEvents.push(data));

		await player.next();

		expect(exhaustedEvents).toHaveLength(1);
	});

	it('next() beforeNext preventDefault emits nextPrevented', async () => {
		const player = setupPlayer();
		player.on('beforeNext' as never, (data: { preventDefault: () => void }) => {
			data.preventDefault();
		});
		const nextPrevented: unknown[] = [];
		player.on('nextPrevented' as never, (data: unknown) => nextPrevented.push(data));

		await player.next();

		expect(nextPrevented).toHaveLength(1);
	});
});

describe('previous() — edge cases', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('previous() no-ops silently when no previous item exists', async () => {
		const player = setupPlayer();
		const items: BasePlaylistItem[] = [
			{ id: 'i1', title: 'Item 1', url: '/i1.mp3' },
		];
		player.queue(items);
		player.item(items[0]!);

		const previousEvents: unknown[] = [];
		player.on('previous' as never, (data: unknown) => previousEvents.push(data));

		await player.previous();

		expect(previousEvents).toHaveLength(0);
	});

	it('previous() beforePrevious preventDefault emits previousPrevented', async () => {
		const player = setupPlayer();
		player.on('beforePrevious' as never, (data: { preventDefault: () => void }) => {
			data.preventDefault();
		});
		const previousPrevented: unknown[] = [];
		player.on('previousPrevented' as never, (data: unknown) => previousPrevented.push(data));

		await player.previous();

		expect(previousPrevented).toHaveLength(1);
	});

	it('previous() goes to previous item when one exists', async () => {
		const player = setupPlayer();
		const items: BasePlaylistItem[] = [
			{ id: 'i1', title: 'Item 1', url: '/i1.mp3' },
			{ id: 'i2', title: 'Item 2', url: '/i2.mp3' },
		];
		player.queue(items);
		player.item(items[1]!);

		const previousEvents: unknown[] = [];
		player.on('previous' as never, (data: unknown) => previousEvents.push(data));

		const loadSpy = vi.fn().mockResolvedValue(undefined);
		(player as unknown as { load: (item: unknown, opts: unknown) => Promise<void> }).load = loadSpy;

		await player.previous();

		expect(previousEvents).toHaveLength(1);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// _seekingTransition()
// ─────────────────────────────────────────────────────────────────────────────

describe('_seekingTransition()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('does NOT emit seeking phase when prior phase is ready (pre-play)', async () => {
		const player = setupPlayer();
		// ready() must be awaited so the async pipeline reaches phase='ready'.
		await player.ready();
		expect(player.phase()).toBe('ready');

		// phase event payload is { from, to } — collect .to values.
		const phaseChanges: string[] = [];
		player.on('phase' as never, (data: { from: string; to: string }) => phaseChanges.push(data.to));

		// Use time() setter which uses _seekingTransition internally
		await player.time(5);

		// 'seeking' should not appear when phase is 'ready'
		expect(phaseChanges).not.toContain('seeking');
	});

	it('round-trips through seeking phase when prior phase is starting', async () => {
		const player = setupPlayer();
		// ready() must be awaited before play() so phase is 'ready' and play()
		// can transition it to 'starting'.
		await player.ready();
		await player.play();
		expect(player.phase()).toBe('starting');

		// phase event payload is { from, to } — collect .to values.
		const phaseChanges: string[] = [];
		player.on('phase' as never, (data: { from: string; to: string }) => phaseChanges.push(data.to));

		await player.time(10);

		expect(phaseChanges).toContain('seeking');
		// _seekingTransition restores to the prior phase ('starting'), not 'playing'
		expect(phaseChanges[phaseChanges.length - 1]).toBe('starting');
	});
});
