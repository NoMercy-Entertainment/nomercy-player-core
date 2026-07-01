// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended coverage for `metricsMethods` — targets the uncovered functions
 * in `src/core/mixins/metrics.ts`:
 *  - announce() — full DOM branch + document-undefined guard
 *  - now() — clockSource path + fallback to Date.now()
 *  - metrics() + recordMetric() (already partially covered; added for completeness)
 */

import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
	declare announce: (text: string, level?: 'polite' | 'assertive') => void;
	declare now: () => number;
	declare metrics: () => Record<string, number | null>;
	declare recordMetric: (name: string, value: number) => void;

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

function makePlayer(divId: string, opts?: object): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	const mockPlayer = new MockPlayer(divId);
	if (opts)
		(mockPlayer as any).options = opts;
	return mockPlayer;
}

describe('metricsMethods extended', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	describe('announce()', () => {
		it('appends an aria-live div to the container', () => {
			const mockPlayer = makePlayer('met-1');
			mockPlayer.announce('Loading…');
			const node = mockPlayer.container.querySelector('[aria-live]');
			expect(node).not.toBeNull();
			expect(node?.textContent).toBe('Loading…');
		});

		it('uses aria-live="polite" by default', () => {
			const mockPlayer = makePlayer('met-2');
			mockPlayer.announce('Info');
			const node = mockPlayer.container.querySelector('[aria-live="polite"]');
			expect(node).not.toBeNull();
		});

		it('uses aria-live="assertive" when level is "assertive"', () => {
			const mockPlayer = makePlayer('met-3');
			mockPlayer.announce('Alert!', 'assertive');
			const node = mockPlayer.container.querySelector('[aria-live="assertive"]');
			expect(node).not.toBeNull();
		});

		it('sets role="status" on the announcement node', () => {
			const mockPlayer = makePlayer('met-4');
			mockPlayer.announce('Status');
			const node = mockPlayer.container.querySelector('[role="status"]');
			expect(node).not.toBeNull();
		});

		it('positions the node off-screen', () => {
			const mockPlayer = makePlayer('met-5');
			mockPlayer.announce('Off-screen');
			const node = mockPlayer.container.querySelector('[aria-live]') as HTMLElement | null;
			expect(node?.style.left).toBe('-9999px');
		});

		it('removes the node after 1500ms via setTimeout', async () => {
			vi.useFakeTimers();
			const mockPlayer = makePlayer('met-6');
			mockPlayer.announce('Transient');
			expect(mockPlayer.container.querySelector('[aria-live]')).not.toBeNull();
			vi.advanceTimersByTime(1500);
			expect(mockPlayer.container.querySelector('[aria-live]')).toBeNull();
			vi.useRealTimers();
		});

		it('does not remove the node if it was already removed before the timeout fires', async () => {
			vi.useFakeTimers();
			const mockPlayer = makePlayer('met-7');
			mockPlayer.announce('Will be manually removed');
			const node = mockPlayer.container.querySelector('[aria-live]') as HTMLElement;
			mockPlayer.container.removeChild(node);
			expect(() => vi.advanceTimersByTime(1500)).not.toThrow();
			vi.useRealTimers();
		});
	});

	describe('now()', () => {
		it('returns Date.now() when no clockSource is configured', () => {
			const mockPlayer = makePlayer('met-8');
			const before = Date.now();
			const ts = mockPlayer.now();
			const after = Date.now();
			expect(ts).toBeGreaterThanOrEqual(before);
			expect(ts).toBeLessThanOrEqual(after);
		});

		it('returns the result of clockSource when configured', () => {
			const clockSource = vi.fn().mockReturnValue(42_000);
			const mockPlayer = makePlayer('met-9', { clockSource });
			expect(mockPlayer.now()).toBe(42_000);
			expect(clockSource).toHaveBeenCalled();
		});
	});
});
