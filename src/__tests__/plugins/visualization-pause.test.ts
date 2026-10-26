// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * VisualizationPlugin pause support and the opt-in GPU surface hooks. The
 * plugin is installed against a stub player with fake canvas and spectrum
 * dependencies, so the render tick is driven by hand.
 */

import type { GpuSurface, VisualizationFrame, VisualizationOptions } from '../../plugins/visualization';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LifecycleRegistry } from '../../adapters/lifecycle-registry/default';
import { CanvasPlugin } from '../../plugins/canvas';
import { SpectrumPlugin } from '../../plugins/spectrum';
import { VisualizationPlugin } from '../../plugins/visualization';

class GpuTestVisualization extends VisualizationPlugin {
	static override readonly id: string = 'gpu-viz';

	renderCalls = 0;

	protected override render(_ctx: CanvasRenderingContext2D, _frame: VisualizationFrame): void {
		this.renderCalls++;
	}

	mountSurface(parent: HTMLElement): GpuSurface {
		return this.createGpuSurface(parent, { scale: 1 });
	}
}

const sampleFrame: VisualizationFrame = {
	frequency: new Uint8Array([100, 150, 200]),
	waveform: new Uint8Array([128, 130, 125]),
	time: 5.5,
	deltaMs: 16,
	energy: 0.4,
	bandEnergies: { bass: 0.3, mid: 0.2, treble: 0.1 },
	frequencyFloat: new Float32Array([-40, -30, -20]),
	waveformFloat: new Float32Array([0, 0.5, -0.5]),
	sampleRate: 44100,
	binHz: 44100 / 2048,
	peakHz: 2 * (44100 / 2048),
	peakBandEnergies: { bass: 0.3, mid: 0.2, treble: 0.1 },
};

function install(opts: VisualizationOptions = {}) {
	const canvasElement = document.createElement('canvas');
	document.body.appendChild(canvasElement);
	const fakeCanvas = { addRenderer: vi.fn(), removeRenderer: vi.fn(), canvas: () => canvasElement };
	const fakeSpectrum = { enabled: () => true, syntheticMode: () => false, currentFrame: () => sampleFrame };
	const events: Array<{ event: string; data: unknown }> = [];
	const player = {
		options: {},
		container: document.body,
		emit: (event: string, data: unknown) => events.push({ event, data }),
		on: vi.fn(),
		off: vi.fn(),
		getPlugin: (ctor: unknown) => {
			if (ctor === CanvasPlugin)
				return fakeCanvas;
			return ctor === SpectrumPlugin ? fakeSpectrum : undefined;
		},
	};
	const lifecycle = new LifecycleRegistry();
	const plugin = new GpuTestVisualization();
	plugin.initialize(player as never, opts, lifecycle);
	plugin.use();

	const ctx = {} as CanvasRenderingContext2D;
	const tick = (count = 1): void => {
		const renderer = fakeCanvas.addRenderer.mock.calls[0]![0] as (context: CanvasRenderingContext2D, deltaMs: number, time: number) => void;
		for (let i = 0; i < count; i++)
			renderer(ctx, 16, i);
	};
	return { plugin, fakeCanvas, canvasElement, events, lifecycle, tick };
}

function stubWebGl2(gl: unknown): void {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) => (type === 'webgl2' ? gl : null)) as never);
}

let documentHidden = false;

function setDocumentHidden(hidden: boolean): void {
	documentHidden = hidden;
	document.dispatchEvent(new Event('visibilitychange'));
}

describe('VisualizationPlugin GPU surface hooks', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	it('emits unsupported with the webgl2 reason and does not throw when webgl2 is missing', () => {
		stubWebGl2(null);
		const { plugin, events } = install();

		expect(() => plugin.mountSurface(document.body)).not.toThrow();

		expect(events).toContainEqual({ event: 'plugin:gpu-viz:unsupported', data: { reason: 'webgl2-unavailable' } });
	});

	it('emits plugin events when the context is lost and restored', () => {
		const gl = { getExtension: vi.fn(() => null) };
		stubWebGl2(gl);
		const { plugin, events } = install();
		const surface = plugin.mountSurface(document.body);

		surface.canvas().dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
		surface.canvas().dispatchEvent(new Event('webglcontextrestored'));

		expect(events.map(entry => entry.event)).toEqual(['plugin:gpu-viz:gpu:contextlost', 'plugin:gpu-viz:gpu:contextrestored']);
	});

	it('releases the surface on dispose, and a second dispose does not throw', () => {
		const loseContext = vi.fn();
		stubWebGl2({ getExtension: vi.fn(() => ({ loseContext })) });
		const { plugin } = install();
		const surface = plugin.mountSurface(document.body);
		const canvas = surface.canvas();

		plugin.dispose();

		expect(loseContext).toHaveBeenCalledOnce();
		expect(canvas.isConnected).toBe(false);
		expect(() => plugin.dispose()).not.toThrow();
	});

	it('replaces the earlier surface when a second one is created', () => {
		const loseContext = vi.fn();
		stubWebGl2({ getExtension: vi.fn(() => ({ loseContext })) });
		const { plugin } = install();

		plugin.mountSurface(document.body);
		plugin.mountSurface(document.body);

		expect(loseContext).toHaveBeenCalledOnce();
		expect(document.body.querySelectorAll('canvas')).toHaveLength(2);
	});
});

describe('VisualizationPlugin pause', () => {
	beforeEach(() => {
		documentHidden = false;
		Object.defineProperty(document, 'hidden', { configurable: true, get: () => documentHidden });
	});

	afterEach(() => {
		delete (document as unknown as { hidden?: boolean }).hidden;
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	it('renders nothing across 30 ticks while inactive, and resumes after reactivation', () => {
		const { plugin, fakeCanvas, tick } = install();

		tick(2);
		expect(plugin.renderCalls).toBe(2);

		plugin.setActive(false);
		expect(plugin.isActive()).toBe(false);
		tick(30);
		expect(plugin.renderCalls).toBe(2);

		plugin.setActive(false);
		plugin.setActive(true);
		plugin.setActive(true);
		expect(plugin.isActive()).toBe(true);
		expect(() => tick(3)).not.toThrow();
		expect(plugin.renderCalls).toBe(5);
		expect(fakeCanvas.addRenderer).toHaveBeenCalledOnce();
	});

	it('does no frame work while inactive', () => {
		const { plugin, tick } = install();
		const rendered = vi.fn();
		(plugin as unknown as { emit: unknown }).emit = rendered;

		plugin.setActive(false);
		tick(30);

		expect(rendered).not.toHaveBeenCalled();
		expect(plugin.currentFrame()).toBeUndefined();
	});

	it('goes inactive while the document is hidden when pauseWhenHidden is set', () => {
		const { plugin, tick } = install({ pauseWhenHidden: true });

		setDocumentHidden(true);
		tick(30);
		expect(plugin.renderCalls).toBe(0);
		expect(plugin.isActive()).toBe(false);

		setDocumentHidden(false);
		tick(2);
		expect(plugin.renderCalls).toBe(2);
	});

	it('starts inactive when the document is already hidden at use() time', () => {
		documentHidden = true;
		const { plugin, tick } = install({ pauseWhenHidden: true });

		tick(5);

		expect(plugin.renderCalls).toBe(0);
	});

	it('ignores a hidden document by default', () => {
		const { plugin, tick } = install();

		setDocumentHidden(true);
		tick(3);

		expect(plugin.renderCalls).toBe(3);
	});

	it('goes inactive while the observer reports not intersecting when pauseWhenOffscreen is set', () => {
		const observers: Array<{ callback: (entries: Array<{ isIntersecting: boolean }>) => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
		class FakeIntersectionObserver {
			observe = vi.fn();
			disconnect = vi.fn();
			constructor(public callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
				observers.push(this);
			}
		}
		vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
		const { plugin, canvasElement, lifecycle, tick } = install({ pauseWhenOffscreen: true });

		expect(observers).toHaveLength(1);
		expect(observers[0]!.observe).toHaveBeenCalledWith(canvasElement);

		observers[0]!.callback([{ isIntersecting: false }]);
		tick(30);
		expect(plugin.renderCalls).toBe(0);

		observers[0]!.callback([{ isIntersecting: true }]);
		tick(2);
		expect(plugin.renderCalls).toBe(2);

		lifecycle.dispose();
		expect(observers[0]!.disconnect).toHaveBeenCalled();
	});

	it('creates no observer unless pauseWhenOffscreen is set', () => {
		const construct = vi.fn();
		vi.stubGlobal('IntersectionObserver', class {
			constructor() {
				construct();
			}
		});

		install();

		expect(construct).not.toHaveBeenCalled();
	});

	it('stays inactive after the document shows again when it was set inactive by hand', () => {
		const { plugin, tick } = install({ pauseWhenHidden: true });

		plugin.setActive(false);
		setDocumentHidden(true);
		setDocumentHidden(false);
		tick(5);

		expect(plugin.renderCalls).toBe(0);
		expect(plugin.isActive()).toBe(false);
	});
});
