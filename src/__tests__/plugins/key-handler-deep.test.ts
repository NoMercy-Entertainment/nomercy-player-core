// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Deep behavioral tests for `KeyHandlerPlugin`.
 *
 * The existing media-session-and-key-handler.test.ts covers: bind/unbind,
 * typing-target suppression, default binding set, hardware media keys map,
 * disableMediaControls option.
 *
 * This file covers the remaining ~52 uncovered lines:
 *  - replace() — semantic alias for bind()
 *  - bindings() snapshot is independent of live map
 *  - opts.extend: false clears defaults before user bindings apply
 *  - opts.bindings merged on top of defaults
 *  - opts.when predicate gates all key handling
 *  - opts.cooldownMs throttles rapid-fire keys
 *  - scope: 'container' binds to container element
 *  - scope: HTMLElement binds to that element
 *  - scope() returns EventTarget (document fallback)
 *  - parseCombo canonical key normalisation (modifier order, case folding)
 *  - contenteditable targets are suppressed
 *  - <select> targets are suppressed
 *  - <textarea> targets are suppressed
 *  - media key actions call the correct player methods
 *  - player.rewind / forward / volumeUp / volumeDown / toggleMute are invoked
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
import { KeyHandlerPlugin } from '../../plugins/key-handler';

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
	declare getPlugin: (PluginClass: unknown) => unknown;
	declare getPluginById: (id: string) => unknown;
	declare removePlugin: (PluginClass: unknown) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<unknown>;
	declare enabledPlugins: () => ReadonlyArray<unknown>;
	declare play: (opts?: unknown) => Promise<void>;
	declare pause: (opts?: unknown) => Promise<void>;
	declare stop: (opts?: unknown) => Promise<void>;
	declare togglePlayback: (opts?: unknown) => Promise<void>;
	declare t: (key: string, vars?: Record<string, string>) => string;
	declare time: { (): number; (t: number, opts?: unknown): Promise<void> };
	declare volume: { (): number; (v: number): void };
	declare experimental: unknown;

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

	static _reset(): void { _instances.clear(); }
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

function dispatch(key: string, opts: { altKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; target?: EventTarget } = {}): void {
	const ev = new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
		altKey: opts.altKey ?? false,
		ctrlKey: opts.ctrlKey ?? false,
		shiftKey: opts.shiftKey ?? false,
	});
	(opts.target ?? document).dispatchEvent(ev);
}

describe('KeyHandlerPlugin — deep behavioral coverage', () => {
	beforeEach(() => MockPlayer._reset());
	afterEach(() => {
		MockPlayer._reset();
		document.body.innerHTML = '';
	});

	// ── replace() ─────────────────────────────────────────────────────────────

	it('replace() is equivalent to bind() — replaces handler for the same combo', async () => {
		const p = makePlayer('kh-replace-1').setup({});
		p.addPlugin(KeyHandlerPlugin);
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		const fn1 = vi.fn();
		const fn2 = vi.fn();
		inst.bind('g', fn1);
		inst.replace('g', fn2);
		dispatch('g');

		expect(fn2).toHaveBeenCalledOnce();
		expect(fn1).not.toHaveBeenCalled();
	});

	// ── bindings() snapshot ───────────────────────────────────────────────────

	it('bindings() returns a snapshot — mutating it does not affect live binding table', async () => {
		const p = makePlayer('kh-snapshot-1').setup({});
		p.addPlugin(KeyHandlerPlugin);
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		const snapshot = inst.bindings();
		(snapshot as Map<string, unknown>).delete(' ');

		// Live binding table still has Space.
		expect(inst.bindings().has(' ')).toBe(true);
	});

	// ── opts.extend: false ────────────────────────────────────────────────────

	it('opts.extend: false clears defaults; only user bindings survive', async () => {
		const p = makePlayer('kh-extend-false-1').setup({});
		const custom = vi.fn();
		p.addPlugin(KeyHandlerPlugin, {
			extend: false,
			bindings: { x: custom },
		});
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		const map = inst.bindings();
		expect(map.has(' ')).toBe(false);
		expect(map.has('x')).toBe(true);

		dispatch('x');
		expect(custom).toHaveBeenCalledOnce();
	});

	// ── opts.bindings merged on top ────────────────────────────────────────────

	it('opts.bindings wins over defaults for the same combo', async () => {
		const p = makePlayer('kh-opts-bindings-1').setup({});
		const customSpace = vi.fn();
		p.addPlugin(KeyHandlerPlugin, {
			bindings: { ' ': customSpace },
		});
		await p.ready();

		dispatch(' ');
		expect(customSpace).toHaveBeenCalledOnce();
	});

	// ── opts.when predicate ────────────────────────────────────────────────────

	it('opts.when returning false suppresses all key handling', async () => {
		const p = makePlayer('kh-when-1').setup({});
		const whenFn = vi.fn(() => false);
		p.addPlugin(KeyHandlerPlugin, { when: whenFn });
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		const handler = vi.fn();
		inst.bind('q', handler);
		dispatch('q');

		expect(whenFn).toHaveBeenCalled();
		expect(handler).not.toHaveBeenCalled();
	});

	it('opts.when returning true allows key handling', async () => {
		const p = makePlayer('kh-when-2').setup({});
		const whenFn = vi.fn(() => true);
		p.addPlugin(KeyHandlerPlugin, { when: whenFn });
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		const handler = vi.fn();
		inst.bind('q', handler);
		dispatch('q');

		expect(handler).toHaveBeenCalledOnce();
	});

	// ── opts.cooldownMs ────────────────────────────────────────────────────────

	it('opts.cooldownMs: 0 disables throttling — consecutive fires pass through', async () => {
		const p = makePlayer('kh-cooldown-0').setup({});
		p.addPlugin(KeyHandlerPlugin, { cooldownMs: 0 });
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		const handler = vi.fn();
		inst.bind('q', handler);
		dispatch('q');
		dispatch('q');
		dispatch('q');

		expect(handler).toHaveBeenCalledTimes(3);
	});

	it('default cooldownMs 300 throttles rapid-fire keys', async () => {
		vi.useFakeTimers();
		const p = makePlayer('kh-cooldown-default').setup({});
		p.addPlugin(KeyHandlerPlugin);
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		const handler = vi.fn();
		inst.bind('q', handler);

		dispatch('q'); // fires
		dispatch('q'); // throttled — < 300ms since last fire
		dispatch('q'); // throttled

		expect(handler).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(300);
		dispatch('q'); // fires again after cooldown
		expect(handler).toHaveBeenCalledTimes(2);

		vi.useRealTimers();
	});

	// ── scope: 'container' ────────────────────────────────────────────────────

	it('scope: "container" attaches listener to container element', async () => {
		const p = makePlayer('kh-scope-container').setup({});
		p.addPlugin(KeyHandlerPlugin, { scope: 'container' });
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		expect(inst.scope()).toBe(p.container);
	});

	// ── scope: HTMLElement ────────────────────────────────────────────────────

	it('scope: HTMLElement attaches listener to the given element', async () => {
		const customEl = document.createElement('div');
		document.body.appendChild(customEl);

		const p = makePlayer('kh-scope-el').setup({});
		p.addPlugin(KeyHandlerPlugin, { scope: customEl });
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		// Verify behavior: handler fires when the event is dispatched on customEl.
		const handler = vi.fn();
		inst.bind('h', handler);

		const ev = new KeyboardEvent('keydown', { key: 'h', bubbles: true });
		customEl.dispatchEvent(ev);

		expect(handler).toHaveBeenCalledOnce();
	});

	// ── combo normalisation ────────────────────────────────────────────────────

	it('modifier order is canonical — shift+ctrl+k and ctrl+shift+k resolve the same', async () => {
		const p = makePlayer('kh-combo-1').setup({});
		p.addPlugin(KeyHandlerPlugin, { extend: false, bindings: {} });
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		const fn = vi.fn();
		inst.bind('shift+ctrl+k', fn);

		const ev = new KeyboardEvent('keydown', {
			key: 'k',
			ctrlKey: true,
			shiftKey: true,
			bubbles: true,
		});
		document.dispatchEvent(ev);

		expect(fn).toHaveBeenCalledOnce();
	});

	it('single-character keys are lowercased in canonical form', async () => {
		const p = makePlayer('kh-combo-lower').setup({});
		p.addPlugin(KeyHandlerPlugin, { extend: false });
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		const fn = vi.fn();
		inst.bind('P', fn);

		dispatch('p');
		expect(fn).toHaveBeenCalledOnce();
	});

	// ── typing target suppression ──────────────────────────────────────────────

	it('suppresses keys from <textarea> targets', async () => {
		const p = makePlayer('kh-textarea').setup({});
		p.addPlugin(KeyHandlerPlugin, { cooldownMs: 0 });
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		const fn = vi.fn();
		inst.bind('p', fn);

		const ta = document.createElement('textarea');
		document.body.appendChild(ta);
		dispatch('p', { target: ta });
		expect(fn).not.toHaveBeenCalled();
	});

	it('suppresses keys from <select> targets', async () => {
		const p = makePlayer('kh-select').setup({});
		p.addPlugin(KeyHandlerPlugin, { cooldownMs: 0 });
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		const fn = vi.fn();
		inst.bind('p', fn);

		const sel = document.createElement('select');
		document.body.appendChild(sel);
		dispatch('p', { target: sel });
		expect(fn).not.toHaveBeenCalled();
	});

	it('suppresses keys from contenteditable elements', async () => {
		const p = makePlayer('kh-contenteditable').setup({});
		p.addPlugin(KeyHandlerPlugin, { cooldownMs: 0 });
		await p.ready();
		const inst = p.getPluginById('key-handler') as KeyHandlerPlugin;

		const fn = vi.fn();
		inst.bind('p', fn);

		const div = document.createElement('div');
		div.contentEditable = 'true';
		document.body.appendChild(div);
		dispatch('p', { target: div });
		expect(fn).not.toHaveBeenCalled();
	});

	// ── default bindings trigger player methods ───────────────────────────────

	it('Space calls player.togglePlayback()', async () => {
		const p = makePlayer('kh-space').setup({});
		p.addPlugin(KeyHandlerPlugin);
		await p.ready();

		const toggleFn = vi.fn(() => Promise.resolve());
		p.togglePlayback = toggleFn;

		dispatch(' ');
		expect(toggleFn).toHaveBeenCalledOnce();
	});

	it('ArrowLeft calls player.rewind(5)', async () => {
		const p = makePlayer('kh-arrowleft').setup({});
		p.addPlugin(KeyHandlerPlugin);
		await p.ready();

		const rewindFn = vi.fn();
		(p as MockPlayer & { rewind: (n: number) => void }).rewind = rewindFn;

		dispatch('ArrowLeft');
		expect(rewindFn).toHaveBeenCalledWith(5);
	});

	it('ArrowRight calls player.forward(5)', async () => {
		const p = makePlayer('kh-arrowright').setup({});
		p.addPlugin(KeyHandlerPlugin);
		await p.ready();

		const forwardFn = vi.fn();
		(p as MockPlayer & { forward: (n: number) => void }).forward = forwardFn;

		dispatch('ArrowRight');
		expect(forwardFn).toHaveBeenCalledWith(5);
	});

	it('ArrowUp calls player.volumeUp()', async () => {
		const p = makePlayer('kh-arrowup').setup({});
		p.addPlugin(KeyHandlerPlugin);
		await p.ready();

		const volumeUpFn = vi.fn();
		(p as MockPlayer & { volumeUp: () => void }).volumeUp = volumeUpFn;

		dispatch('ArrowUp');
		expect(volumeUpFn).toHaveBeenCalledOnce();
	});

	it('ArrowDown calls player.volumeDown()', async () => {
		const p = makePlayer('kh-arrowdown').setup({});
		p.addPlugin(KeyHandlerPlugin);
		await p.ready();

		const volumeDownFn = vi.fn();
		(p as MockPlayer & { volumeDown: () => void }).volumeDown = volumeDownFn;

		dispatch('ArrowDown');
		expect(volumeDownFn).toHaveBeenCalledOnce();
	});

	it('m calls player.toggleMute()', async () => {
		const p = makePlayer('kh-m').setup({});
		p.addPlugin(KeyHandlerPlugin);
		await p.ready();

		const toggleMuteFn = vi.fn();
		(p as MockPlayer & { toggleMute: () => void }).toggleMute = toggleMuteFn;

		dispatch('m');
		expect(toggleMuteFn).toHaveBeenCalledOnce();
	});

	it('MediaPlay calls player.play() when disableMediaControls is false', async () => {
		const p = makePlayer('kh-mediaplay').setup({});
		p.addPlugin(KeyHandlerPlugin, { cooldownMs: 0 });
		await p.ready();

		const playFn = vi.fn(() => Promise.resolve());
		p.play = playFn;

		dispatch('MediaPlay');
		expect(playFn).toHaveBeenCalledOnce();
	});

	it('MediaPause calls player.pause() when disableMediaControls is false', async () => {
		const p = makePlayer('kh-mediapause').setup({});
		p.addPlugin(KeyHandlerPlugin, { cooldownMs: 0 });
		await p.ready();

		const pauseFn = vi.fn(() => Promise.resolve());
		p.pause = pauseFn;

		dispatch('MediaPause');
		expect(pauseFn).toHaveBeenCalledOnce();
	});

	it('MediaTrackNext calls player.next?.()', async () => {
		const p = makePlayer('kh-tracknext').setup({});
		p.addPlugin(KeyHandlerPlugin, { cooldownMs: 0 });
		await p.ready();

		const nextFn = vi.fn(() => Promise.resolve());
		(p as MockPlayer & { next: () => Promise<void> }).next = nextFn;

		dispatch('MediaTrackNext');
		expect(nextFn).toHaveBeenCalledOnce();
	});

	it('MediaTrackPrevious calls player.previous?.()', async () => {
		const p = makePlayer('kh-trackprev').setup({});
		p.addPlugin(KeyHandlerPlugin, { cooldownMs: 0 });
		await p.ready();

		const prevFn = vi.fn(() => Promise.resolve());
		(p as MockPlayer & { previous: () => Promise<void> }).previous = prevFn;

		dispatch('MediaTrackPrevious');
		expect(prevFn).toHaveBeenCalledOnce();
	});
});
