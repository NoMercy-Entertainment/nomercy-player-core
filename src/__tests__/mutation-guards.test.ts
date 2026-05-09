/**
 * Locks the `mutationGuards` config + `beforeMutation` event contract.
 *
 * Spec §C: every state-mutating method (e.g. `current`, `volume`) emits
 * `beforeMutation` with `{ method, args, phase, dispatchStack }`. Hot-path
 * mutations (`volume`, `currentTime`, `playbackRate`, `bandwidth`,
 * `recordMetric`) skip the guard by default; opt in via `mutationGuards`.
 *
 * Mirrors the MockPlayer pattern in `tier1-features.test.ts`.
 */

import type { BaseEventMap } from '../types';
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

	declare current: { (): any; (target: any): void };
	declare currentIndex: () => number;

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

function seedQueue(p: MockPlayer): void {
	(p as any).queue([
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
		const p = makePlayer('mg-default').setup({});
		await p.ready();
		seedQueue(p);

		const seen: string[] = [];
		p.on('beforeMutation' as any, (e: any) => {
			seen.push(e.data.method);
		});

		p.current('a');
		p.volume(0.5);

		expect(seen).toContain('current');
		expect(seen).not.toContain('volume');
	});

	// ── 2. mutationGuards: false — nothing fires ──

	it('mutationGuards:false: neither current() nor volume fires beforeMutation', async () => {
		const p = makePlayer('mg-false').setup({ mutationGuards: false });
		await p.ready();
		seedQueue(p);

		const seen: string[] = [];
		p.on('beforeMutation' as any, (e: any) => {
			seen.push(e.data.method);
		});

		p.current('a');
		p.volume(0.5);

		expect(seen).toEqual([]);
	});

	// ── 3. mutationGuards: 'all' — both fire ──

	it('mutationGuards:\'all\': both current() and volume fire beforeMutation', async () => {
		const p = makePlayer('mg-all').setup({ mutationGuards: 'all' });
		await p.ready();
		seedQueue(p);

		const seen: string[] = [];
		p.on('beforeMutation' as any, (e: any) => {
			seen.push(e.data.method);
		});

		p.current('a');
		p.volume(0.5);

		expect(seen).toContain('current');
		expect(seen).toContain('volume');
	});

	// ── 4. mutationGuards: ['volume'] — normal still fires, named hot fires ──

	it('mutationGuards:[\'volume\']: current() fires (normal always fires), volume fires (named hot)', async () => {
		const p = makePlayer('mg-array').setup({ mutationGuards: ['volume'] });
		await p.ready();
		seedQueue(p);

		const seen: string[] = [];
		p.on('beforeMutation' as any, (e: any) => {
			seen.push(e.data.method);
		});

		p.current('a');
		p.volume(0.5);

		expect(seen).toContain('current');
		expect(seen).toContain('volume');
	});

	it('mutationGuards:[\'volume\']: a non-named hot method (playbackRate) still skips', async () => {
		const p = makePlayer('mg-array-skip').setup({ mutationGuards: ['volume'] });
		await p.ready();

		const seen: string[] = [];
		p.on('beforeMutation' as any, (e: any) => {
			seen.push(e.data.method);
		});

		(p as any).playbackRate(1.5);

		expect(seen).not.toContain('playbackRate');
	});

	// ── 5. preventDefault cancels mutation, emits mutationPrevented ──

	it('preventDefault() cancels the mutation AND emits mutationPrevented', async () => {
		const p = makePlayer('mg-prevent').setup({});
		await p.ready();
		seedQueue(p);
		p.current('a');
		const before = p.currentIndex();

		let preventedPayload: { method: string; reason: string } | undefined;
		p.on('beforeMutation' as any, (e: any) => {
			if (e.data.method === 'current')
				e.preventDefault();
		});
		p.on('mutationPrevented' as any, (data: any) => {
			preventedPayload = data;
		});

		p.current('c');

		expect(preventedPayload).toEqual({ method: 'current', reason: 'listener-prevented' });
		expect(p.currentIndex()).toBe(before);
	});

	it('preventDefault() on volume (mutationGuards:all) cancels the volume change', async () => {
		const p = makePlayer('mg-prevent-volume').setup({ mutationGuards: 'all' });
		await p.ready();
		const before = p.volume();

		let preventedPayload: { method: string; reason: string } | undefined;
		p.on('beforeMutation' as any, (e: any) => {
			if (e.data.method === 'volume')
				e.preventDefault();
		});
		p.on('mutationPrevented' as any, (data: any) => {
			preventedPayload = data;
		});

		p.volume(0.25);

		expect(preventedPayload).toEqual({ method: 'volume', reason: 'listener-prevented' });
		expect(p.volume()).toBe(before);
	});

	// ── 6. Payload shape ──

	it('beforeMutation payload: { method, args, phase, dispatchStack }', async () => {
		const p = makePlayer('mg-payload').setup({ mutationGuards: 'all' });
		await p.ready();

		let captured: any;
		p.on('beforeMutation' as any, (e: any) => {
			if (e.data.method === 'volume')
				captured = e.data;
		});

		p.volume(0.42);

		expect(captured).toBeDefined();
		expect(captured.method).toBe('volume');
		expect(Array.isArray(captured.args)).toBe(true);
		expect(captured.args).toEqual([0.42]);
		expect(typeof captured.phase).toBe('string');
		expect(captured.phase).toBe('ready');
		expect(Array.isArray(captured.dispatchStack)).toBe(true);
	});

	it('beforeMutation.dispatchStack is populated when called inside another event handler', async () => {
		const p = makePlayer('mg-stack').setup({ mutationGuards: 'all' });
		await p.ready();

		let captured: ReadonlyArray<string> | undefined;
		p.on('beforeMutation' as any, (e: any) => {
			if (e.data.method === 'volume')
				captured = e.data.dispatchStack;
		});
		p.on('beforePlay' as any, () => {
			p.volume(0.3);
		});

		await p.play();

		expect(captured).toBeDefined();
		expect(captured!.length).toBeGreaterThanOrEqual(1);
		expect(captured).toContain('beforePlay');
	});
});
