/**
 * Locks `static advisories` lookup + auto-fire on `beforeMutation`.
 *
 * Spec §C: declarative advisories — pure data — fire as info/warning/error
 * with code `plugin:<plugin-id>/<reason>` when their `method` + `duringPhase`
 * + `duringEvent` constraints all match.
 */

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

		const p = makePlayer('a1');
		p.addPlugin(AdvisorPlugin);
		p.setup({});
		await p.ready();

		(p as any).queue([{ id: 'x' }, { id: 'y' }]);
		const warnings: any[] = [];
		p.on('warning' as any, (data: any) => warnings.push(data));

		p.current(0);

		expect(warnings.length).toBe(1);
		expect(warnings[0].error.code).toBe('plugin:advisor/cursor-mutation');
		expect(warnings[0].error.message).toBe('plugin:advisor/cursor-mutation: Be careful');
		expect(warnings[0].error.severity).toBe('warning');
	});

	it('skips advisory when `duringPhase` does not include current phase', async () => {
		class PlayingOnlyAdvisor extends Plugin {
			static override readonly id = 'playing-only';
			static override readonly description = 'test';
			static override readonly advisories: ReadonlyArray<PluginAdvisory> = [
				{ method: 'current', duringPhase: 'playing', severity: 'warning', reason: 'risky', message: 'risky' },
			];
		}

		const p = makePlayer('a2');
		p.addPlugin(PlayingOnlyAdvisor);
		p.setup({});
		await p.ready();

		(p as any).queue([{ id: 'x' }]);
		const warnings: any[] = [];
		p.on('warning' as any, (data: any) => warnings.push(data));

		// Phase is 'ready', not 'playing' — advisory should NOT fire.
		p.current(0);
		expect(warnings.length).toBe(0);

		// Force phase to 'playing' to prove the constraint.
		(p as any)._phase = 'playing';
		p.current(0);
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

		const p = makePlayer('a3');
		p.addPlugin(MultiSevAdvisor);
		p.setup({});
		await p.ready();

		(p as any).queue([{ id: 'x' }]);
		const infos: any[] = [];
		const errors: any[] = [];
		p.on('info' as any, (d: any) => infos.push(d));
		p.on('error' as any, (d: any) => errors.push(d));

		p.current(0);

		expect(infos.length).toBe(1);
		expect(infos[0].error.code).toBe('plugin:multi-sev/info-reason');
		expect(errors.length).toBe(1);
		expect(errors[0].error.code).toBe('plugin:multi-sev/error-reason');
	});

	it('skips advisories when the plugin is disabled', async () => {
		class DisabledAdvisor extends Plugin {
			static override readonly id = 'disabled-advisor';
			static override readonly description = 'test';
			static override readonly advisories: ReadonlyArray<PluginAdvisory> = [
				{ method: 'current', severity: 'warning', reason: 'r', message: 'm' },
			];
		}

		const p = makePlayer('a4');
		p.addPlugin(DisabledAdvisor);
		p.setup({});
		await p.ready();

		(p as any).queue([{ id: 'x' }]);
		const warnings: any[] = [];
		p.on('warning' as any, (data: any) => warnings.push(data));

		// Disable, then mutate — advisory should NOT fire.
		(p as any).getPluginById('disabled-advisor').disable();
		p.current(0);
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

		const p = makePlayer('a5');
		p.addPlugin(DuringPlayAdvisor);
		p.setup({});
		await p.ready();

		(p as any).queue([{ id: 'x' }]);
		const warnings: any[] = [];
		p.on('warning' as any, (data: any) => warnings.push(data));

		// No event in flight — advisory does NOT fire.
		p.current(0);
		expect(warnings.length).toBe(0);

		// Simulate `beforePlay` in flight via push/pop instance methods.
		(p as any).pushDispatch('beforePlay');
		try {
			p.current(0);
		}
		finally {
			(p as any).popDispatch();
		}
		expect(warnings.length).toBe(1);
	});
});
