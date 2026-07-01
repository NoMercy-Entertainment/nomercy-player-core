// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Locks the `mutationGuards` config + `beforeMutation` event contract.
 *
 * Spec §C: every state-mutating method (e.g. `current`, `volume`) emits
 * `beforeMutation` with `{ method, args, phase, dispatchStack }`. Hot-path
 * mutations (`volume`, `time`, `playbackRate`, `bandwidth`,
 * `recordMetric`) skip the guard by default; opt in via `mutationGuards`.
 *
 * Mirrors the MockPlayer pattern in `tier1-features.test.ts`.
 */

import type { BaseEventMap, BeforeEvent } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';

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
	declare dispose: () => void;
	declare phase: () => string;
	declare play: (opts?: any) => Promise<void>;
	declare pause: (opts?: any) => Promise<void>;
	declare volume: { (): number; (v: number): void };
	declare queue: {
		(): ReadonlyArray<any>;
		(items: any[]): void;
	};

	declare item: { (): any; (target: any): void };
	declare index: () => number;
	declare playbackRate: { (): number; (rate: number): void };

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

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

function seedQueue(mockPlayer: MockPlayer): void {
	mockPlayer.queue([
		{ id: 'a' },
		{ id: 'b' },
		{ id: 'c' },
	]);
}

describe('mutationGuards config + beforeMutation event', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	// ── 1. Default config (undefined) — normal mutations fire, hot ones skip ──

	it('default config: current() fires beforeMutation, volume does not', async () => {
		const mockPlayer = makePlayer('mg-default').setup({});
		await mockPlayer.ready();
		seedQueue(mockPlayer);

		const seen: string[] = [];
		mockPlayer.on('beforeMutation', (beforeEvent: BeforeEvent<{ method: string; args: ReadonlyArray<unknown>; phase: string; dispatchStack: ReadonlyArray<string> }>) => {
			seen.push(beforeEvent.data.method);
		});

		mockPlayer.item('a');
		mockPlayer.volume(0.5);

		expect(seen).toContain('current');
		expect(seen).not.toContain('volume');
	});

	// ── 2. mutationGuards: false — nothing fires ──

	it('mutationGuards:false: neither current() nor volume fires beforeMutation', async () => {
		const mockPlayer = makePlayer('mg-false').setup({ mutationGuards: false });
		await mockPlayer.ready();
		seedQueue(mockPlayer);

		const seen: string[] = [];
		mockPlayer.on('beforeMutation', (beforeEvent: BeforeEvent<{ method: string; args: ReadonlyArray<unknown>; phase: string; dispatchStack: ReadonlyArray<string> }>) => {
			seen.push(beforeEvent.data.method);
		});

		mockPlayer.item('a');
		mockPlayer.volume(0.5);

		expect(seen).toEqual([]);
	});

	// ── 3. mutationGuards: 'all' — both fire ──

	it('mutationGuards:\'all\': both current() and volume fire beforeMutation', async () => {
		const mockPlayer = makePlayer('mg-all').setup({ mutationGuards: 'all' });
		await mockPlayer.ready();
		seedQueue(mockPlayer);

		const seen: string[] = [];
		mockPlayer.on('beforeMutation', (beforeEvent: BeforeEvent<{ method: string; args: ReadonlyArray<unknown>; phase: string; dispatchStack: ReadonlyArray<string> }>) => {
			seen.push(beforeEvent.data.method);
		});

		mockPlayer.item('a');
		mockPlayer.volume(0.5);

		expect(seen).toContain('current');
		expect(seen).toContain('volume');
	});

	// ── 4. mutationGuards: ['volume'] — normal still fires, named hot fires ──

	it('mutationGuards:[\'volume\']: current() fires (normal always fires), volume fires (named hot)', async () => {
		const mockPlayer = makePlayer('mg-array').setup({ mutationGuards: ['volume'] });
		await mockPlayer.ready();
		seedQueue(mockPlayer);

		const seen: string[] = [];
		mockPlayer.on('beforeMutation', (beforeEvent: BeforeEvent<{ method: string; args: ReadonlyArray<unknown>; phase: string; dispatchStack: ReadonlyArray<string> }>) => {
			seen.push(beforeEvent.data.method);
		});

		mockPlayer.item('a');
		mockPlayer.volume(0.5);

		expect(seen).toContain('current');
		expect(seen).toContain('volume');
	});

	it('mutationGuards:[\'volume\']: a non-named hot method (playbackRate) still skips', async () => {
		const mockPlayer = makePlayer('mg-array-skip').setup({ mutationGuards: ['volume'] });
		await mockPlayer.ready();

		const seen: string[] = [];
		mockPlayer.on('beforeMutation', (beforeEvent: BeforeEvent<{ method: string; args: ReadonlyArray<unknown>; phase: string; dispatchStack: ReadonlyArray<string> }>) => {
			seen.push(beforeEvent.data.method);
		});

		mockPlayer.playbackRate(1.5);

		expect(seen).not.toContain('playbackRate');
	});

	// ── 5. preventDefault cancels mutation, emits mutationPrevented ──

	it('preventDefault() cancels the mutation AND emits mutationPrevented', async () => {
		const mockPlayer = makePlayer('mg-prevent').setup({});
		await mockPlayer.ready();
		seedQueue(mockPlayer);
		mockPlayer.item('a');
		const before = mockPlayer.index();

		let preventedPayload: { method: string; reason: string } | undefined;
		mockPlayer.on('beforeMutation', (beforeEvent: BeforeEvent<{ method: string; args: ReadonlyArray<unknown>; phase: string; dispatchStack: ReadonlyArray<string> }>) => {
			if (beforeEvent.data.method === 'current')
				beforeEvent.preventDefault();
		});
		mockPlayer.on('mutationPrevented', (data: { method: string; reason: string }) => {
			preventedPayload = data;
		});

		mockPlayer.item('c');

		expect(preventedPayload).toEqual({ method: 'current', reason: 'listener-prevented' });
		expect(mockPlayer.index()).toBe(before);
	});

	it('preventDefault() on volume (mutationGuards:all) cancels the volume change', async () => {
		const mockPlayer = makePlayer('mg-prevent-volume').setup({ mutationGuards: 'all' });
		await mockPlayer.ready();
		const before = mockPlayer.volume();

		let preventedPayload: { method: string; reason: string } | undefined;
		mockPlayer.on('beforeMutation', (beforeEvent: BeforeEvent<{ method: string; args: ReadonlyArray<unknown>; phase: string; dispatchStack: ReadonlyArray<string> }>) => {
			if (beforeEvent.data.method === 'volume')
				beforeEvent.preventDefault();
		});
		mockPlayer.on('mutationPrevented', (data: { method: string; reason: string }) => {
			preventedPayload = data;
		});

		mockPlayer.volume(0.25);

		expect(preventedPayload).toEqual({ method: 'volume', reason: 'listener-prevented' });
		expect(mockPlayer.volume()).toBe(before);
	});

	// ── 6. Payload shape ──

	it('beforeMutation payload: { method, args, phase, dispatchStack }', async () => {
		const mockPlayer = makePlayer('mg-payload').setup({ mutationGuards: 'all' });
		await mockPlayer.ready();

		let captured: { method: string; args: ReadonlyArray<unknown>; phase: string; dispatchStack: ReadonlyArray<string> } | undefined;
		mockPlayer.on('beforeMutation', (beforeEvent: BeforeEvent<{ method: string; args: ReadonlyArray<unknown>; phase: string; dispatchStack: ReadonlyArray<string> }>) => {
			if (beforeEvent.data.method === 'volume')
				captured = beforeEvent.data;
		});

		mockPlayer.volume(0.42);

		expect(captured).toBeDefined();
		expect(captured!.method).toBe('volume');
		expect(Array.isArray(captured!.args)).toBe(true);
		expect(captured!.args).toEqual([0.42]);
		expect(typeof captured!.phase).toBe('string');
		expect(captured!.phase).toBe('ready');
		expect(Array.isArray(captured!.dispatchStack)).toBe(true);
	});

	it('beforeMutation.dispatchStack is populated when called inside another event handler', async () => {
		const mockPlayer = makePlayer('mg-stack').setup({ mutationGuards: 'all' });
		await mockPlayer.ready();

		let captured: ReadonlyArray<string> | undefined;
		mockPlayer.on('beforeMutation', (beforeEvent: BeforeEvent<{ method: string; args: ReadonlyArray<unknown>; phase: string; dispatchStack: ReadonlyArray<string> }>) => {
			if (beforeEvent.data.method === 'volume')
				captured = beforeEvent.data.dispatchStack;
		});
		mockPlayer.on('beforePlay', () => {
			mockPlayer.volume(0.3);
		});

		await mockPlayer.play();

		expect(captured).toBeDefined();
		expect(captured!.length).toBeGreaterThanOrEqual(1);
		expect(captured).toContain('beforePlay');
	});
});
