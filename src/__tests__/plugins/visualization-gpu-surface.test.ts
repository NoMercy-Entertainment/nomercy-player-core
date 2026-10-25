// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * GpuSurface and FrameDataTexture against a mock WebGL2 context. jsdom and
 * happy-dom ship no WebGL, so the mock records the calls the helpers make.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FrameDataTexture, GpuSurface } from '../../plugins/visualization';

interface MockGl {
	getExtension: ReturnType<typeof vi.fn>;
	loseContext: ReturnType<typeof vi.fn>;
	createTexture: ReturnType<typeof vi.fn>;
	deleteTexture: ReturnType<typeof vi.fn>;
	bindTexture: ReturnType<typeof vi.fn>;
	texParameteri: ReturnType<typeof vi.fn>;
	pixelStorei: ReturnType<typeof vi.fn>;
	texImage2D: ReturnType<typeof vi.fn>;
	texSubImage2D: ReturnType<typeof vi.fn>;
	[key: string]: unknown;
}

function makeGl(): MockGl {
	const loseContext = vi.fn();
	return {
		TEXTURE_2D: 3553,
		R8: 33321,
		RED: 6403,
		UNSIGNED_BYTE: 5121,
		UNPACK_ALIGNMENT: 3317,
		TEXTURE_MIN_FILTER: 10241,
		TEXTURE_MAG_FILTER: 10240,
		TEXTURE_WRAP_S: 10242,
		TEXTURE_WRAP_T: 10243,
		LINEAR: 9729,
		CLAMP_TO_EDGE: 33071,
		loseContext,
		getExtension: vi.fn((name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null)),
		createTexture: vi.fn(() => ({ id: 'texture' })),
		deleteTexture: vi.fn(),
		bindTexture: vi.fn(),
		texParameteri: vi.fn(),
		pixelStorei: vi.fn(),
		texImage2D: vi.fn(),
		texSubImage2D: vi.fn(),
	};
}

function stubWebGl2(gl: MockGl | null): void {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) => (type === 'webgl2' ? gl : null)) as never);
}

function lastUpload(gl: MockGl): Uint8Array {
	const calls = gl.texSubImage2D.mock.calls;
	return calls[calls.length - 1]![8] as Uint8Array;
}

describe('GpuSurface', () => {
	let parent: HTMLElement;

	beforeEach(() => {
		parent = document.createElement('div');
		document.body.appendChild(parent);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	it('creates its own canvas under the given parent and exposes the context', () => {
		const gl = makeGl();
		stubWebGl2(gl);

		const surface = new GpuSurface(parent);

		expect(surface.canvas().parentElement).toBe(parent);
		expect(parent.querySelectorAll('canvas')).toHaveLength(1);
		expect(surface.context()).toBe(gl);
		expect(surface.isLost()).toBe(false);
	});

	it('reports unsupported through the callback and does not throw when webgl2 is missing', () => {
		stubWebGl2(null);
		const onUnsupported = vi.fn();

		let surface!: GpuSurface;
		expect(() => {
			surface = new GpuSurface(parent, { onUnsupported });
		}).not.toThrow();

		expect(onUnsupported).toHaveBeenCalledExactlyOnceWith('webgl2-unavailable');
		expect(surface.context()).toBeNull();
		expect(parent.querySelectorAll('canvas')).toHaveLength(0);
		expect(() => {
			surface.resize(100, 50);
			surface.dispose();
		}).not.toThrow();
	});

	it('does not throw when getContext itself throws', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => {
			throw new Error('blocked');
		}) as never);
		const onUnsupported = vi.fn();

		expect(() => new GpuSurface(parent, { onUnsupported })).not.toThrow();
		expect(onUnsupported).toHaveBeenCalledOnce();
	});

	it('prevents default on context loss, then emits both callbacks and recovers on restore', () => {
		const gl = makeGl();
		stubWebGl2(gl);
		const onContextLost = vi.fn();
		const onContextRestored = vi.fn();
		const surface = new GpuSurface(parent, { onContextLost, onContextRestored });

		const lost = new Event('webglcontextlost', { cancelable: true });
		surface.canvas().dispatchEvent(lost);

		expect(lost.defaultPrevented).toBe(true);
		expect(onContextLost).toHaveBeenCalledOnce();
		expect(surface.isLost()).toBe(true);
		expect(onContextRestored).not.toHaveBeenCalled();

		surface.canvas().dispatchEvent(new Event('webglcontextrestored'));

		expect(onContextRestored).toHaveBeenCalledOnce();
		expect(surface.isLost()).toBe(false);
		expect(surface.context()).toBe(gl);
	});

	it('sizes the backing store to round(css * scale)', () => {
		stubWebGl2(makeGl());
		const surface = new GpuSurface(parent, { scale: 0.5 });

		surface.resize(300.4, 150.5);
		expect(surface.canvas().width).toBe(150);
		expect(surface.canvas().height).toBe(75);

		surface.setScale(1.5);
		expect(surface.scale()).toBe(1.5);
		expect(surface.canvas().width).toBe(451);
		expect(surface.canvas().height).toBe(226);
	});

	it('releases the context via lose_context and removes the canvas on dispose; a second dispose does not throw', () => {
		const gl = makeGl();
		stubWebGl2(gl);
		const onContextLost = vi.fn();
		const surface = new GpuSurface(parent, { onContextLost });
		const canvas = surface.canvas();

		surface.dispose();

		expect(gl.loseContext).toHaveBeenCalledOnce();
		expect(canvas.isConnected).toBe(false);
		expect(surface.context()).toBeNull();

		expect(() => surface.dispose()).not.toThrow();
		expect(gl.loseContext).toHaveBeenCalledOnce();

		canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
		expect(onContextLost).not.toHaveBeenCalled();
	});
});

describe('FrameDataTexture', () => {
	it('creates a width x rows R8 texture', () => {
		const gl = makeGl();

		const frameTexture = new FrameDataTexture(gl as unknown as WebGL2RenderingContext, 128, 2);

		expect(frameTexture.width).toBe(128);
		expect(frameTexture.rows).toBe(2);
		expect(frameTexture.texture).toEqual({ id: 'texture' });
		expect(gl.pixelStorei).toHaveBeenCalledWith(gl.UNPACK_ALIGNMENT, 1);
		expect(gl.texImage2D).toHaveBeenCalledWith(gl.TEXTURE_2D, 0, gl.R8, 128, 2, 0, gl.RED, gl.UNSIGNED_BYTE, expect.any(Uint8Array));
	});

	it('uploads upsampled rows by linear interpolation, values asserted on a known ramp', () => {
		const gl = makeGl();
		const frameTexture = new FrameDataTexture(gl as unknown as WebGL2RenderingContext, 5, 1);

		frameTexture.upload([Uint8Array.from([0, 100, 200])]);

		expect(gl.texSubImage2D).toHaveBeenCalledWith(gl.TEXTURE_2D, 0, 0, 0, 5, 1, gl.RED, gl.UNSIGNED_BYTE, expect.any(Uint8Array));
		expect(Array.from(lastUpload(gl))).toEqual([0, 50, 100, 150, 200]);
	});

	it('uploads downsampled rows from a 256 step ramp, one row after the other', () => {
		const gl = makeGl();
		const frameTexture = new FrameDataTexture(gl as unknown as WebGL2RenderingContext, 4, 2);
		const ramp = Uint8Array.from({ length: 256 }, (_value, i) => i);
		const flat = new Uint8Array(16).fill(77);

		frameTexture.upload([ramp, flat]);

		expect(Array.from(lastUpload(gl))).toEqual([0, 85, 170, 255, 77, 77, 77, 77]);
	});

	it('keeps rows that are not given and zero-fills an empty row', () => {
		const gl = makeGl();
		const frameTexture = new FrameDataTexture(gl as unknown as WebGL2RenderingContext, 2, 2);

		frameTexture.upload([Uint8Array.from([9, 9]), Uint8Array.from([5, 5])]);
		frameTexture.upload([new Uint8Array(0)]);

		expect(Array.from(lastUpload(gl))).toEqual([0, 0, 5, 5]);
	});

	it('deletes the texture on dispose and ignores a second dispose', () => {
		const gl = makeGl();
		const frameTexture = new FrameDataTexture(gl as unknown as WebGL2RenderingContext, 4, 1);

		frameTexture.dispose();
		frameTexture.dispose();
		frameTexture.upload([Uint8Array.from([1, 2, 3, 4])]);

		expect(gl.deleteTexture).toHaveBeenCalledOnce();
		expect(gl.texSubImage2D).not.toHaveBeenCalled();
	});
});
