// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/** Options for {@link GpuSurface}. */
export interface GpuSurfaceOptions {
	/** Backing-store pixels per CSS pixel. Default `1`. */
	scale?: number;
	/** Passed to `getContext('webgl2', ...)`. */
	contextAttributes?: WebGLContextAttributes;
	/** Called once when no WebGL2 context could be created. */
	onUnsupported?: (reason: string) => void;
	onContextLost?: () => void;
	onContextRestored?: () => void;
}

/**
 * A WebGL2 canvas that owns its own element under a caller-given parent.
 *
 * It is a separate element on purpose: a canvas that already holds a 2D
 * context returns `null` for `webgl2`, and `CanvasPlugin` takes the 2D context
 * of its own canvas on the first tick. The surface never throws; when WebGL2
 * is missing `context()` returns `null` and `onUnsupported` fires once.
 *
 * The caller decides the scale (the backing store is `round(css * scale)`) and
 * recreates its GL resources when `onContextRestored` fires.
 */
export class GpuSurface {
	private readonly _canvas: HTMLCanvasElement;
	private _gl: WebGL2RenderingContext | null = null;
	private _scale: number;
	private _cssWidth = 0;
	private _cssHeight = 0;
	private _lost = false;
	private _disposed = false;

	private readonly _onLost = (event: Event): void => {
		event.preventDefault();
		this._lost = true;
		this.opts.onContextLost?.();
	};

	private readonly _onRestored = (): void => {
		this._lost = false;
		this.opts.onContextRestored?.();
	};

	constructor(parent: HTMLElement, private readonly opts: GpuSurfaceOptions = {}) {
		this._scale = opts.scale ?? 1;
		this._canvas = document.createElement('canvas');
		this._canvas.className = 'nmplayer-gpu-surface';
		this._canvas.style.position = 'absolute';
		this._canvas.style.left = '0';
		this._canvas.style.top = '0';
		this._canvas.style.width = '100%';
		this._canvas.style.height = '100%';
		this._canvas.style.pointerEvents = 'none';

		try {
			this._gl = this._canvas.getContext('webgl2', opts.contextAttributes) as WebGL2RenderingContext | null;
		}
		catch { /* a blocked context is the same as an unsupported one */ }

		if (!this._gl) {
			opts.onUnsupported?.('webgl2-unavailable');
			return;
		}

		this._canvas.addEventListener('webglcontextlost', this._onLost);
		this._canvas.addEventListener('webglcontextrestored', this._onRestored);
		parent.appendChild(this._canvas);
	}

	canvas(): HTMLCanvasElement {
		return this._canvas;
	}

	/** The WebGL2 context, or `null` when unsupported or after `dispose()`. */
	context(): WebGL2RenderingContext | null {
		return this._gl;
	}

	isLost(): boolean {
		return this._lost;
	}

	scale(): number {
		return this._scale;
	}

	setScale(scale: number): void {
		this._scale = scale;
		this.resize(this._cssWidth, this._cssHeight);
	}

	/** Sets the backing store to `round(css * scale)` for the given CSS size. */
	resize(cssWidth: number, cssHeight: number): void {
		this._cssWidth = cssWidth;
		this._cssHeight = cssHeight;
		this._canvas.width = Math.max(0, Math.round(cssWidth * this._scale));
		this._canvas.height = Math.max(0, Math.round(cssHeight * this._scale));
	}

	/**
	 * Releases the GL context through `WEBGL_lose_context` and removes the
	 * canvas. Browsers cap live contexts, so repeated mounts need this.
	 * Idempotent.
	 */
	dispose(): void {
		if (this._disposed)
			return;
		this._disposed = true;

		this._canvas.removeEventListener('webglcontextlost', this._onLost);
		this._canvas.removeEventListener('webglcontextrestored', this._onRestored);
		try {
			this._gl?.getExtension('WEBGL_lose_context')?.loseContext();
		}
		catch { /* the context is already gone */ }
		this._gl = null;
		this._canvas.remove();
	}
}
