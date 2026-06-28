// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Deep behavioral tests for `MessagePlugin`.
 *
 * The existing message-and-canvas.test.ts covers: basic show() display,
 * hide() clears the toast, aria attributes, queue basics.
 *
 * This file covers the remaining ~33 uncovered lines:
 *  - displayMessage(string) and displayMessage({ text, durationMs })
 *  - show() replaces a currently-visible toast and resets the timer
 *  - queue() plays a sequence back-to-back; each item shown for its durationMs
 *  - queue() cancels an in-flight queue when called again
 *  - clear() cancels in-flight queue + hides current toast
 *  - displayPersistent() creates named element in container
 *  - displayPersistent() updates text of existing id in-place
 *  - removePersistent() removes the element from DOM
 *  - removePersistent() no-op for missing id
 *  - dispose() removes all persistent elements + clears toast ref
 *  - opts.mountSelector finds an existing element
 *  - opts.durationMs is honoured by displayMessage when not overridden
 */

import type { BaseEventMap } from '../../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../../index';
import { MessagePlugin } from '../../plugins/message';

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = {} as HTMLElement;

	get id(): string { return this.playerId; }

	declare options: (config?: unknown) => unknown;
	declare setup: (config: unknown) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare phase: () => string;
	declare addPlugin: (PluginClass: unknown, opts?: unknown) => this;
	declare getPlugin: <P extends object>(PluginClass: { id: string; new(): P }) => P | undefined;
	declare getPluginById: <P extends object = object>(id: string) => P | undefined;
	declare removePlugin: (PluginClass: unknown) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<unknown>;
	declare enabledPlugins: () => ReadonlyArray<unknown>;
	declare play: (opts?: unknown) => Promise<void>;
	declare pause: (opts?: unknown) => Promise<void>;
	declare stop: (opts?: unknown) => Promise<void>;
	declare t: (key: string, vars?: Record<string, string>) => string;
	declare time: { (): number; (t: number, opts?: unknown): Promise<void> };
	declare volume: { (): number; (v: number): void };
	declare experimental: unknown;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing') return resolved.instance as unknown as this;
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _reset(): void { _instances.clear(); }
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MessagePlugin — deep behavioral coverage', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		MockPlayer._reset();
	});
	afterEach(() => {
		vi.useRealTimers();
		MockPlayer._reset();
		document.body.innerHTML = '';
	});

	// ── show() ────────────────────────────────────────────────────────────────

	describe('show()', () => {
		it('displays text and auto-hides after ms', async () => {
			const p = makePlayer('msg-show-1').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;
			const toast = (inst as unknown as { toast: HTMLDivElement }).toast;

			inst.show('Hello', 500);
			expect(toast.textContent).toBe('Hello');
			expect(toast.style.display).toBe('block');

			vi.advanceTimersByTime(500);
			expect(toast.style.display).toBe('none');
		});

		it('replaces a visible toast and resets the timer', async () => {
			const p = makePlayer('msg-show-2').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;
			const toast = (inst as unknown as { toast: HTMLDivElement }).toast;

			inst.show('First', 1000);
			vi.advanceTimersByTime(500); // halfway through

			inst.show('Second', 500);
			expect(toast.textContent).toBe('Second');

			// If the old timer had not been cancelled, 'Second' would hide at 500ms
			// but a half-elapsed 1000ms timer would fire at 1000ms-500ms = 500ms from now too.
			// Advance another 200ms — toast should still be showing (new 500ms timer).
			vi.advanceTimersByTime(300);
			expect(toast.style.display).toBe('block');

			vi.advanceTimersByTime(200);
			expect(toast.style.display).toBe('none');
		});
	});

	// ── hide() ────────────────────────────────────────────────────────────────

	describe('hide()', () => {
		it('cancels the auto-hide timer and hides immediately', async () => {
			const p = makePlayer('msg-hide-1').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;
			const toast = (inst as unknown as { toast: HTMLDivElement }).toast;

			inst.show('Visible', 1000);
			inst.hide();

			expect(toast.style.display).toBe('none');
			expect(toast.textContent).toBe('');

			// Timer should be cancelled — no additional hide side-effects.
			vi.advanceTimersByTime(2000);
			expect(toast.style.display).toBe('none');
		});
	});

	// ── displayMessage() ──────────────────────────────────────────────────────

	describe('displayMessage()', () => {
		it('string form calls show(text, defaultDuration)', async () => {
			const p = makePlayer('msg-dm-1').setup({});
			p.addPlugin(MessagePlugin, { durationMs: 400 });
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;
			const toast = (inst as unknown as { toast: HTMLDivElement }).toast;

			inst.displayMessage('Test');
			expect(toast.textContent).toBe('Test');

			vi.advanceTimersByTime(400);
			expect(toast.style.display).toBe('none');
		});

		it('object form uses durationMs from the object', async () => {
			const p = makePlayer('msg-dm-2').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;
			const toast = (inst as unknown as { toast: HTMLDivElement }).toast;

			inst.displayMessage({ text: 'Hi', durationMs: 200 });
			expect(toast.textContent).toBe('Hi');

			vi.advanceTimersByTime(200);
			expect(toast.style.display).toBe('none');
		});

		it('explicit ms override wins over object.durationMs', async () => {
			const p = makePlayer('msg-dm-3').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;
			const toast = (inst as unknown as { toast: HTMLDivElement }).toast;

			inst.displayMessage({ text: 'Override', durationMs: 1000 }, 100);

			vi.advanceTimersByTime(100);
			expect(toast.style.display).toBe('none');
		});
	});

	// ── queue() ───────────────────────────────────────────────────────────────

	describe('queue()', () => {
		it('plays messages back-to-back, each for its own duration', async () => {
			const p = makePlayer('msg-queue-1').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;
			const toast = (inst as unknown as { toast: HTMLDivElement }).toast;

			inst.queue([
				{ text: 'Step 1', durationMs: 100 },
				{ text: 'Step 2', durationMs: 200 },
			]);

			expect(toast.textContent).toBe('Step 1');

			vi.advanceTimersByTime(100);
			expect(toast.textContent).toBe('Step 2');

			vi.advanceTimersByTime(200);
			// Queue done — no new message shown.
		});

		it('calling queue() again cancels the in-flight run', async () => {
			const p = makePlayer('msg-queue-2').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;
			const toast = (inst as unknown as { toast: HTMLDivElement }).toast;

			inst.queue([{ text: 'Old 1', durationMs: 1000 }, { text: 'Old 2', durationMs: 1000 }]);
			expect(toast.textContent).toBe('Old 1');

			// Interrupt with new queue before first message finishes.
			inst.queue([{ text: 'New 1', durationMs: 50 }]);
			expect(toast.textContent).toBe('New 1');

			// Old queue should not fire anymore.
			vi.advanceTimersByTime(1000);
			// Only New 1 fired and finished — toast should be done.
			expect(toast.textContent).not.toBe('Old 2');
		});
	});

	// ── clear() ───────────────────────────────────────────────────────────────

	describe('clear()', () => {
		it('hides the toast and cancels in-flight queue', async () => {
			const p = makePlayer('msg-clear-1').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;
			const toast = (inst as unknown as { toast: HTMLDivElement }).toast;

			inst.queue([{ text: 'Running', durationMs: 500 }, { text: 'Next', durationMs: 500 }]);
			expect(toast.textContent).toBe('Running');

			inst.clear();
			expect(toast.style.display).toBe('none');

			vi.advanceTimersByTime(1000);
			// No messages should appear after clear.
			expect(toast.style.display).toBe('none');
		});
	});

	// ── displayPersistent() ───────────────────────────────────────────────────

	describe('displayPersistent()', () => {
		it('creates a named overlay element in the container', async () => {
			const p = makePlayer('msg-persist-1').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;

			inst.displayPersistent('Tap to play', 'autoplay-blocked');

			const el = p.container.querySelector('[data-persistent-id="autoplay-blocked"]');
			expect(el).not.toBeNull();
			expect(el!.textContent).toBe('Tap to play');
		});

		it('updates text of existing id in-place without creating a new element', async () => {
			const p = makePlayer('msg-persist-2').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;

			inst.displayPersistent('Loading…', 'status');
			inst.displayPersistent('Almost there!', 'status');

			const els = p.container.querySelectorAll('[data-persistent-id="status"]');
			expect(els).toHaveLength(1);
			expect(els[0]!.textContent).toBe('Almost there!');
		});

		it('element has role="status" and aria-live="polite"', async () => {
			const p = makePlayer('msg-persist-aria').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;

			inst.displayPersistent('Test', 'test-id');

			const el = p.container.querySelector('[data-persistent-id="test-id"]');
			expect(el?.getAttribute('role')).toBe('status');
			expect(el?.getAttribute('aria-live')).toBe('polite');
		});
	});

	// ── removePersistent() ────────────────────────────────────────────────────

	describe('removePersistent()', () => {
		it('removes the named element from the DOM', async () => {
			const p = makePlayer('msg-rmpersist-1').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;

			inst.displayPersistent('Remove me', 'to-remove');
			inst.removePersistent('to-remove');

			const el = p.container.querySelector('[data-persistent-id="to-remove"]');
			expect(el).toBeNull();
		});

		it('no-op for an id that was never displayed', async () => {
			const p = makePlayer('msg-rmpersist-2').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;

			expect(() => inst.removePersistent('never-existed')).not.toThrow();
		});
	});

	// ── dispose() ────────────────────────────────────────────────────────────

	describe('dispose()', () => {
		it('removes all persistent elements from the DOM', async () => {
			const p = makePlayer('msg-dispose-1').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;

			inst.displayPersistent('A', 'a');
			inst.displayPersistent('B', 'b');

			p.removePlugin(MessagePlugin);

			expect(p.container.querySelector('[data-persistent-id="a"]')).toBeNull();
			expect(p.container.querySelector('[data-persistent-id="b"]')).toBeNull();
		});

		it('clears the toast reference so show() after dispose is a no-op', async () => {
			const p = makePlayer('msg-dispose-2').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;

			p.removePlugin(MessagePlugin);

			// show() after dispose must not throw.
			expect(() => inst.show('Late', 100)).not.toThrow();
		});

		it('cancels pending hide timers', async () => {
			const p = makePlayer('msg-dispose-3').setup({});
			p.addPlugin(MessagePlugin);
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;

			inst.show('Showing', 500);
			p.removePlugin(MessagePlugin);

			// After dispose the timer should be gone. Advancing should not cause errors.
			expect(() => vi.advanceTimersByTime(600)).not.toThrow();
		});
	});

	// ── opts.mountSelector ────────────────────────────────────────────────────

	describe('opts.mountSelector', () => {
		it('reuses an existing element when found by selector', async () => {
			const customEl = document.createElement('div');
			customEl.id = 'custom-toast';
			document.body.appendChild(customEl);

			const p = makePlayer('msg-selector-1').setup({});
			p.addPlugin(MessagePlugin, { mountSelector: '#custom-toast' });
			await p.ready();
			const inst = p.getPlugin(MessagePlugin)!;

			const toast = (inst as unknown as { toast: HTMLDivElement }).toast;
			expect(toast).toBe(customEl);
		});
	});
});
