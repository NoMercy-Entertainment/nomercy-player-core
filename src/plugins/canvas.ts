import type { BaseEventMap, IPlayer } from '../types';
import { BrowserPolicyError, StateError } from '../errors';
import { Plugin } from '../plugin';

export interface CanvasOptions {
	/** Where the canvas mounts. Default: the player's container element. */
	mount?: string | HTMLElement;
	/** Canvas dimensions. Defaults to mount element's clientWidth/clientHeight. */
	width?: number;
	height?: number;
	/** Target FPS — kit caps the render loop. Default `60`. */
	fps?: number;
	/** Canvas resolution multiplier. Default `devicePixelRatio`. */
	pixelRatio?: number;
	/** Stack visualizers on the same canvas (clear before each render) vs. composite (draw over). Default `'clear'`. */
	compositeMode?: 'clear' | 'composite';
}

export interface CanvasEvents {
	mounted: { width: number; height: number };
	resized: { width: number; height: number };
	frame: { deltaMs: number; time: number };
}

/** Render callback signature — receives the 2D context and the frame timing. */
export type CanvasRenderFn = (ctx: CanvasRenderingContext2D, deltaMs: number, time: number) => void;

/**
 * Canvas + RAF host plugin. Lives in core. **Strictly opt-in** — without
 * registering this plugin, no canvas is allocated, no RAF loop runs, and the
 * player pays zero rendering cost.
 *
 * Owns:
 *  - one `<canvas>` element mounted into the player container (or the configured mount)
 *  - dpi scaling + ResizeObserver wiring
 *  - the RAF loop, frame timing, deltaMs
 *  - a list of registered render callbacks called in registration order each frame
 */
export class CanvasPlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, CanvasOptions, CanvasEvents> {
	static override readonly id: string = 'canvas';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'Canvas mount + shared RAF loop — opt-in foundation for every visualizer';

	private surface: HTMLDivElement | null = null;
	private _canvas: HTMLCanvasElement | null = null;
	private _ctx: CanvasRenderingContext2D | null = null;
	private renderers: Array<CanvasRenderFn> = [];
	private resizeObserver: ResizeObserver | null = null;
	private rafRunning = false;

	override use(): void {
		const surface = this.mount('surface');
		surface.style.position = 'relative';
		surface.style.width = '100%';
		surface.style.height = '100%';
		this.surface = surface;

		const canvasEl = this.createCanvas(surface);
		surface.appendChild(canvasEl);
		this._canvas = canvasEl;

		this.applyInitialSize();
		this.installResizeObserver();
		this.startRenderLoop();
	}

	override dispose(): void {
		this.renderers.length = 0;
		this.rafRunning = false;
		if (this.resizeObserver) {
			try {
				this.resizeObserver.disconnect();
			}
			catch { /* swallow */ }
			this.resizeObserver = null;
		}
		this._canvas = null;
		this._ctx = null;
		this.surface = null;
	}

	/** Raw canvas element. Throws if accessed before `use()` has mounted it. */
	canvas(): HTMLCanvasElement {
		if (!this._canvas) {
			throw new StateError({
				code: 'plugin:canvas/not-mounted',
				severity: 'error',
				scope: {
					kind: 'plugin',
					id: 'canvas',
				},
				message: 'CanvasPlugin.canvas() called before plugin use() mounted the element.',
				suggestion: 'Wait for `addPlugin(CanvasPlugin)` to resolve, or call from inside `use()` of a dependent plugin.',
			});
		}
		return this._canvas;
	}

	/** 2D rendering context (cached). */
	context(): CanvasRenderingContext2D {
		if (this._ctx)
			return this._ctx;
		const canvasEl = this.canvas();
		const ctx = canvasEl.getContext('2d');
		if (!ctx) {
			throw new BrowserPolicyError({
				code: 'core:policy/canvas2dUnsupported',
				severity: 'error',
				scope: {
					kind: 'plugin',
					id: 'canvas',
				},
				message: 'getContext("2d") returned null — environment does not support a 2D canvas context.',
			});
		}
		this._ctx = ctx;
		return ctx;
	}

	/**
	 * Register a per-frame renderer. Returns an unregister fn.
	 * Auto-removed on plugin dispose.
	 */
	addRenderer(fn: CanvasRenderFn): () => void {
		this.renderers.push(fn);
		return () => this.removeRenderer(fn);
	}

	/** Remove a previously registered renderer. */
	removeRenderer(fn: CanvasRenderFn): void {
		const idx = this.renderers.indexOf(fn);
		if (idx >= 0)
			this.renderers.splice(idx, 1);
	}

	/**
	 * Read or write canvas dimensions.
	 *
	 * `size()` — returns `{ width, height }` of the current logical canvas size.
	 * `size(width, height)` — manual size override. Bypasses the ResizeObserver path.
	 */
	size(): { width: number; height: number };
	size(width: number, height: number): void;
	size(width?: number, height?: number): { width: number; height: number } | void {
		if (width === undefined) {
			return {
				width: this._canvas ? this._canvas.offsetWidth : 0,
				height: this._canvas ? this._canvas.offsetHeight : 0,
			};
		}
		const canvasEl = this._canvas;
		if (!canvasEl)
			return;
		const h = height!;
		const ratio = this.opts?.pixelRatio ?? (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
		canvasEl.width = Math.max(0, Math.floor(width * ratio));
		canvasEl.height = Math.max(0, Math.floor(h * ratio));
		canvasEl.style.width = `${width}px`;
		canvasEl.style.height = `${h}px`;
		this.emit('resized', {
			width,
			height: h,
		});
	}

	/** Force a resize recalculation now (rarely needed — ResizeObserver handles it). */
	resize(): void {
		const surface = this.surface;
		if (!surface)
			return;
		const w = this.opts?.width ?? surface.clientWidth;
		const h = this.opts?.height ?? surface.clientHeight;
		this.size(w, h);
	}

	/** Override hook: provide a custom canvas element. */
	protected createCanvas(_mount: HTMLElement): HTMLCanvasElement {
		return document.createElement('canvas');
	}

	private applyInitialSize(): void {
		const surface = this.surface;
		const canvasEl = this._canvas;
		if (!surface || !canvasEl)
			return;
		const w = this.opts?.width ?? surface.clientWidth ?? 0;
		const h = this.opts?.height ?? surface.clientHeight ?? 0;
		this.size(w, h);
		this.emit('mounted', {
			width: w,
			height: h,
		});
	}

	private installResizeObserver(): void {
		if (this.opts?.width !== undefined && this.opts?.height !== undefined)
			return;
		if (typeof ResizeObserver === 'undefined')
			return;
		const surface = this.surface;
		if (!surface)
			return;
		const ro = new ResizeObserver(() => { this.resize(); });
		ro.observe(surface);
		this.resizeObserver = ro;
	}

	private startRenderLoop(): void {
		if (this.rafRunning)
			return;
		this.rafRunning = true;
		this.frame((deltaMs, time) => {
			if (!this.rafRunning)
				return;
			const compositeMode = this.opts?.compositeMode ?? 'clear';
			const canvasEl = this._canvas;
			if (canvasEl && compositeMode === 'clear') {
				const ctx = this.context();
				ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
			}
			if (this.renderers.length > 0) {
				const ctx = this.context();
				for (const fn of this.renderers.slice()) {
					try {
						fn(ctx, deltaMs, time);
					}
					catch (err) {
						if (typeof console !== 'undefined' && console.error) {
							console.error('[CanvasPlugin] renderer threw:', err);
						}
					}
				}
			}
			this.emit('frame', {
				deltaMs,
				time,
			});
		});
	}
}

export const canvasPlugin = CanvasPlugin;
