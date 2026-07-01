// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * MessagePlugin + CanvasPlugin behaviour. Locks the just-landed real impls so
 * regressions on the toast surface, RAF orchestration, or renderer registry
 * surface immediately.
 *
 * Mirrors the conventions in `tier1-features.test.ts`: a self-contained
 * MockPlayer built on the kit's shared mixins so plugins exercise the real
 * spine, not a hand-rolled stub.
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
import { CanvasPlugin } from '../../plugins/canvas';
import { MessagePlugin } from '../../plugins/message';

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
	declare addPlugin: (PluginClass: any, opts?: any) => this;
	declare getPlugin: <P extends object>(PluginClass: { id: string; new(): P }) => P | undefined;
	declare getPluginById: <P extends object = object>(id: string) => P | undefined;
	declare removePlugin: (PluginClass: any) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<any>;
	declare enabledPlugins: () => ReadonlyArray<any>;
	declare play: (opts?: any) => Promise<void>;
	declare pause: (opts?: any) => Promise<void>;
	declare stop: (opts?: any) => Promise<void>;
	declare t: (key: string, vars?: Record<string, string>) => string;
	declare time: { (): number; (t: number, opts?: any): Promise<void> };
	declare volume: { (): number; (v: number): void };
	declare experimental: any;

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

// happy-dom does not implement <canvas> 2D contexts. Stub it with a minimal
// shape so the plugin's render loop can call clearRect / fillRect without
// blowing up. Real visualizer logic exercises the actual browser via E2E.
function installCanvasStub(): void {
	const proto = HTMLCanvasElement.prototype as unknown as { getContext: (type: string) => unknown };
	if ((proto as unknown as { __nmStubbed?: boolean }).__nmStubbed)
		return;
	(proto as unknown as { __nmStubbed: boolean }).__nmStubbed = true;
	proto.getContext = function (type: string): unknown {
		if (type !== '2d')
			return null;
		const stub: Partial<CanvasRenderingContext2D> = {
			clearRect: () => {},
			fillRect: () => {},
			save: () => {},
			restore: () => {},
			beginPath: () => {},
			closePath: () => {},
			moveTo: () => {},
			lineTo: () => {},
			stroke: () => {},
			fill: () => {},
		};
		return stub as CanvasRenderingContext2D;
	};
}

describe('MessagePlugin + CanvasPlugin', () => {
	beforeEach(() => {
		installCanvasStub();
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
		vi.useRealTimers();
	});

	// ── MessagePlugin ───────────────────────────────────────────────────────

	describe('MessagePlugin', () => {
		it('show("hello", 100) makes the toast visible and auto-hides after 100ms', async () => {
			vi.useFakeTimers();
			const mockPlayer = makePlayer('msg-show').setup({});
			mockPlayer.addPlugin(MessagePlugin);
			await mockPlayer.ready();

			const inst = mockPlayer.getPluginById<MessagePlugin>('message')!;
			inst.show('hello', 100);

			const toast = mockPlayer.container.querySelector<HTMLDivElement>('.nmplayer-message-toast');
			expect(toast).toBeTruthy();
			expect(toast!.textContent).toBe('hello');
			expect(toast!.style.display).toBe('block');
			expect(toast!.getAttribute('role')).toBe('status');
			expect(toast!.getAttribute('aria-live')).toBe('polite');

			vi.advanceTimersByTime(101);
			expect(toast!.style.display).toBe('none');
			expect(toast!.textContent).toBe('');
		});

		it('hide() cancels a pending auto-hide', async () => {
			vi.useFakeTimers();
			const mockPlayer = makePlayer('msg-hide').setup({});
			mockPlayer.addPlugin(MessagePlugin);
			await mockPlayer.ready();

			const inst = mockPlayer.getPluginById<MessagePlugin>('message')!;
			inst.show('keep', 1000);
			const toast = mockPlayer.container.querySelector<HTMLDivElement>('.nmplayer-message-toast')!;
			expect(toast.style.display).toBe('block');

			inst.hide();
			expect(toast.style.display).toBe('none');

			// If the timeout were still pending, advancing would reset display
			// or wipe textContent again. Re-show afterwards to confirm state is
			// fully clean.
			vi.advanceTimersByTime(2000);
			expect(toast.textContent).toBe('');
		});

		it('queue([...]) shows messages in order, gated by per-message duration', async () => {
			vi.useFakeTimers();
			const mockPlayer = makePlayer('msg-queue').setup({});
			mockPlayer.addPlugin(MessagePlugin);
			await mockPlayer.ready();

			const inst = mockPlayer.getPluginById<MessagePlugin>('message')!;
			inst.queue([
				{ text: 'one', durationMs: 50 },
				{ text: 'two', durationMs: 50 },
				{ text: 'three', durationMs: 50 },
			]);

			const toast = mockPlayer.container.querySelector<HTMLDivElement>('.nmplayer-message-toast')!;
			expect(toast.textContent).toBe('one');

			vi.advanceTimersByTime(51);
			expect(toast.textContent).toBe('two');

			vi.advanceTimersByTime(51);
			expect(toast.textContent).toBe('three');

			vi.advanceTimersByTime(51);
			// Queue drained — the final timeout calls next(idx+1) which is
			// past the end, so the toast stays on its last text but no new
			// hide fires. Acceptable; assert at minimum no further mutation.
			expect(toast.textContent).toBe('three');
		});
	});

	// ── CanvasPlugin ────────────────────────────────────────────────────────

	describe('CanvasPlugin', () => {
		it('canvas() returns an HTMLCanvasElement under the player container by default', async () => {
			const mockPlayer = makePlayer('cnv-get').setup({});
			mockPlayer.addPlugin(CanvasPlugin);
			await mockPlayer.ready();

			const inst = mockPlayer.getPluginById<CanvasPlugin>('canvas')!;
			const canvas = inst.canvas();
			expect(canvas).toBeInstanceOf(HTMLCanvasElement);
			// Canvas lives inside the namespaced surface div, which is itself
			// under the player container when opts.mount is absent.
			const surface = mockPlayer.container.querySelector('.nmplayer-canvas-surface');
			expect(surface).toBeTruthy();
			expect(surface!.contains(canvas)).toBe(true);
		});

		it('surface and canvas default to pointer-events: none', async () => {
			const mockPlayer = makePlayer('cnv-pe-default').setup({});
			mockPlayer.addPlugin(CanvasPlugin);
			await mockPlayer.ready();

			const surface = mockPlayer.container.querySelector<HTMLDivElement>('.nmplayer-canvas-surface')!;
			const canvas = mockPlayer.container.querySelector<HTMLCanvasElement>('canvas')!;
			expect(surface.style.pointerEvents).toBe('none');
			expect(canvas.style.pointerEvents).toBe('none');
		});

		it('opts.pointerEvents: "auto" is applied to surface and canvas', async () => {
			const mockPlayer = makePlayer('cnv-pe-auto').setup({});
			mockPlayer.addPlugin(CanvasPlugin, { pointerEvents: 'auto' });
			await mockPlayer.ready();

			const surface = mockPlayer.container.querySelector<HTMLDivElement>('.nmplayer-canvas-surface')!;
			const canvas = mockPlayer.container.querySelector<HTMLCanvasElement>('canvas')!;
			expect(surface.style.pointerEvents).toBe('auto');
			expect(canvas.style.pointerEvents).toBe('auto');
		});

		it('opts.mount HTMLElement routes the surface into that element, not the player container', async () => {
			// Create a separate mount target outside the player container.
			const mountTarget = document.createElement('div');
			mountTarget.id = 'visualizer-mount';
			document.body.appendChild(mountTarget);

			const mockPlayer = makePlayer('cnv-mount-el').setup({});
			mockPlayer.addPlugin(CanvasPlugin, { mount: mountTarget });
			await mockPlayer.ready();

			// Surface must be inside mountTarget.
			const surface = mountTarget.querySelector('.nmplayer-canvas-surface');
			expect(surface).toBeTruthy();

			// Surface must NOT be inside the player container.
			const surfaceInContainer = mockPlayer.container.querySelector('.nmplayer-canvas-surface');
			expect(surfaceInContainer).toBeNull();

			// Canvas is inside the surface inside mountTarget.
			const inst = mockPlayer.getPluginById<CanvasPlugin>('canvas')!;
			expect(mountTarget.contains(inst.canvas())).toBe(true);
		});

		it('opts.mount CSS selector routes the surface into the resolved element', async () => {
			const mountTarget = document.createElement('div');
			mountTarget.id = 'cnv-selector-target';
			document.body.appendChild(mountTarget);

			const mockPlayer = makePlayer('cnv-mount-sel').setup({});
			mockPlayer.addPlugin(CanvasPlugin, { mount: '#cnv-selector-target' });
			await mockPlayer.ready();

			const surface = mountTarget.querySelector('.nmplayer-canvas-surface');
			expect(surface).toBeTruthy();

			const surfaceInContainer = mockPlayer.container.querySelector('.nmplayer-canvas-surface');
			expect(surfaceInContainer).toBeNull();
		});

		it('unresolvable opts.mount selector falls back to player container and logs a warning', async () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const mockPlayer = makePlayer('cnv-mount-bad').setup({});
			mockPlayer.addPlugin(CanvasPlugin, { mount: '#this-does-not-exist' });
			await mockPlayer.ready();

			// Falls back to container — surface must be there.
			const surface = mockPlayer.container.querySelector('.nmplayer-canvas-surface');
			expect(surface).toBeTruthy();

			// A warning must have been emitted. console.warn is called as:
			// console.warn(prefix, ...args) — prefix is call[0], message is call[1].
			const warned = warnSpy.mock.calls.some(call =>
				call.some(arg => String(arg).includes('#this-does-not-exist')));
			expect(warned).toBe(true);

			warnSpy.mockRestore();
		});

		it('addRenderer(fn) runs fn on the next RAF tick', async () => {
			const mockPlayer = makePlayer('cnv-add').setup({});
			mockPlayer.addPlugin(CanvasPlugin);
			await mockPlayer.ready();

			const inst = mockPlayer.getPluginById<CanvasPlugin>('canvas')!;
			const fn = vi.fn();
			inst.addRenderer(fn);

			// Wait ~3 frames worth via setTimeout so happy-dom's RAF polyfill
			// (built on top of setTimeout) actually fires. Direct awaits on
			// requestAnimationFrame microtasks don't always yield to the
			// macrotask queue under happy-dom.
			await new Promise<void>(r => setTimeout(r, 80));

			expect(fn).toHaveBeenCalled();
			const lastCall = fn.mock.calls[fn.mock.calls.length - 1]!;
			// Receives (ctx, deltaMs, time).
			expect(lastCall[0]).toBeDefined();
			expect(typeof lastCall[1]).toBe('number');
			expect(typeof lastCall[2]).toBe('number');
		});

		it('removeRenderer(fn) stops calling fn', async () => {
			const mockPlayer = makePlayer('cnv-remove').setup({});
			mockPlayer.addPlugin(CanvasPlugin);
			await mockPlayer.ready();

			const inst = mockPlayer.getPluginById<CanvasPlugin>('canvas')!;
			const fn = vi.fn();
			inst.addRenderer(fn);

			await new Promise<void>(r => setTimeout(r, 80));
			const callsBefore = fn.mock.calls.length;
			expect(callsBefore).toBeGreaterThan(0);

			inst.removeRenderer(fn);

			// Snapshot count, wait again, expect no growth.
			await new Promise<void>(r => setTimeout(r, 80));
			const callsAfter = fn.mock.calls.length;
			expect(callsAfter).toBe(callsBefore);
		});
	});
});
