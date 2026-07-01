// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Locks `static advisories` lookup + auto-fire on `beforeMutation`.
 *
 * Spec §C: declarative advisories — pure data — fire as info/warning/error
 * with code `plugin:<plugin-id>/<reason>` when their `method` + `duringPhase`
 * + `duringEvent` constraints all match.
 */

import type { PlayerTestInternals } from '../testing/player-test-internals';
import type { BaseEventMap, PluginAdvisory } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	Plugin,
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
	declare addPlugin: (PluginClass: any) => this;
	declare queue: {
		(): ReadonlyArray<any>;
		(items: any[]): void;
	};

	declare current: (target: any) => void;
	declare item: {
		(): any;
		(target: any, opts?: any): void;
	};

	declare getPluginById: (id: string) => { disable(): void; enable(): void } | undefined;

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

describe('static advisories — declarative phase-aware advisories', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('fires matching advisory on `current` when method matches and no constraints set', async () => {
		class AdvisorPlugin extends Plugin {
			static override readonly id = 'advisor';
			static override readonly description = 'test';
			static override readonly advisories: ReadonlyArray<PluginAdvisory> = [
				{ method: 'current', severity: 'warning', reason: 'cursor-mutation', message: 'Be careful' },
			];
		}

		const mockPlayer = makePlayer('a1');
		mockPlayer.addPlugin(AdvisorPlugin);
		mockPlayer.setup({});
		await mockPlayer.ready();

		mockPlayer.queue([{ id: 'x' }, { id: 'y' }]);
		const warnings: unknown[] = [];
		mockPlayer.on('warning', (data: unknown) => warnings.push(data));

		mockPlayer.item(0);

		interface Advisory { error: { code: string; message: string; severity: string } }
		expect(warnings.length).toBe(1);
		expect((warnings[0] as Advisory).error.code).toBe('plugin:advisor/cursor-mutation');
		expect((warnings[0] as Advisory).error.message).toBe('plugin:advisor/cursor-mutation: Be careful');
		expect((warnings[0] as Advisory).error.severity).toBe('warning');
	});

	it('skips advisory when `duringPhase` does not include current phase', async () => {
		class PlayingOnlyAdvisor extends Plugin {
			static override readonly id = 'playing-only';
			static override readonly description = 'test';
			static override readonly advisories: ReadonlyArray<PluginAdvisory> = [
				{ method: 'current', duringPhase: 'playing', severity: 'warning', reason: 'risky', message: 'risky' },
			];
		}

		const mockPlayer = makePlayer('a2');
		mockPlayer.addPlugin(PlayingOnlyAdvisor);
		mockPlayer.setup({});
		await mockPlayer.ready();

		mockPlayer.queue([{ id: 'x' }]);
		const warnings: unknown[] = [];
		mockPlayer.on('warning', (data: unknown) => warnings.push(data));

		// Phase is 'ready', not 'playing' — advisory should NOT fire.
		mockPlayer.item(0);
		expect(warnings.length).toBe(0);

		// Force phase to 'playing' to prove the constraint.
		(mockPlayer as unknown as PlayerTestInternals)._phase = 'playing';
		mockPlayer.item(0);
		expect(warnings.length).toBe(1);
	});

	it('routes advisory severity to matching channel (info / warning / error)', async () => {
		class MultiSevAdvisor extends Plugin {
			static override readonly id = 'multi-sev';
			static override readonly description = 'test';
			static override readonly advisories: ReadonlyArray<PluginAdvisory> = [
				{ method: 'current', severity: 'info', reason: 'info-reason', message: 'just fyi' },
				{ method: 'current', severity: 'error', reason: 'error-reason', message: 'oh no' },
			];
		}

		const mockPlayer = makePlayer('a3');
		mockPlayer.addPlugin(MultiSevAdvisor);
		mockPlayer.setup({});
		await mockPlayer.ready();

		mockPlayer.queue([{ id: 'x' }]);
		const infos: unknown[] = [];
		const errors: unknown[] = [];
		mockPlayer.on('info', (d: unknown) => infos.push(d));
		mockPlayer.on('error', (d: unknown) => errors.push(d));

		mockPlayer.item(0);

		interface Advisory { error: { code: string } }
		expect(infos.length).toBe(1);
		expect((infos[0] as Advisory).error.code).toBe('plugin:multi-sev/info-reason');
		expect(errors.length).toBe(1);
		expect((errors[0] as Advisory).error.code).toBe('plugin:multi-sev/error-reason');
	});

	it('skips advisories when the plugin is disabled', async () => {
		class DisabledAdvisor extends Plugin {
			static override readonly id = 'disabled-advisor';
			static override readonly description = 'test';
			static override readonly advisories: ReadonlyArray<PluginAdvisory> = [
				{ method: 'current', severity: 'warning', reason: 'r', message: 'm' },
			];
		}

		const mockPlayer = makePlayer('a4');
		mockPlayer.addPlugin(DisabledAdvisor);
		mockPlayer.setup({});
		await mockPlayer.ready();

		mockPlayer.queue([{ id: 'x' }]);
		const warnings: unknown[] = [];
		mockPlayer.on('warning', (data: unknown) => warnings.push(data));

		// Disable, then mutate — advisory should NOT fire.
		mockPlayer.getPluginById('disabled-advisor')?.disable();
		mockPlayer.item(0);
		expect(warnings.length).toBe(0);
	});

	it('matches `duringEvent` when the named event is currently dispatching', async () => {
		// duringEvent matching uses the player's _dispatchStack. We can't
		// directly trigger a `before*` from the kit without backend, but we
		// CAN push onto the stack to simulate.
		class DuringPlayAdvisor extends Plugin {
			static override readonly id = 'during-play';
			static override readonly description = 'test';
			static override readonly advisories: ReadonlyArray<PluginAdvisory> = [
				{ method: 'current', duringEvent: 'beforePlay', severity: 'warning', reason: 'r', message: 'm' },
			];
		}

		const mockPlayer = makePlayer('a5');
		mockPlayer.addPlugin(DuringPlayAdvisor);
		mockPlayer.setup({});
		await mockPlayer.ready();

		mockPlayer.queue([{ id: 'x' }]);
		const warnings: unknown[] = [];
		mockPlayer.on('warning', (data: unknown) => warnings.push(data));

		// No event in flight — advisory does NOT fire.
		mockPlayer.item(0);
		expect(warnings.length).toBe(0);

		// Simulate `beforePlay` in flight via push/pop instance methods.
		const pInternals = mockPlayer as unknown as PlayerTestInternals;
		pInternals.pushDispatch('beforePlay');
		try {
			mockPlayer.item(0);
		}
		finally {
			pInternals.popDispatch();
		}
		expect(warnings.length).toBe(1);
	});
});
