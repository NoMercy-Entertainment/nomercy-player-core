import type { BaseEventMap, IPlayer } from '../types';
import { BrowserPolicyError, StateError } from '../errors';
import { Plugin } from '../plugin';

/** Options for {@link CanvasPlugin}. */
export interface CanvasOptions {
	/**
	 * Where the canvas element is mounted. Accepts a CSS selector string or a
	 * direct `HTMLElement` reference. Defaults to the player's container element.
	 */
	mount?: string | HTMLElement;

	/**
	 * Fixed canvas logical width in CSS pixels. When omitted the plugin reads
	 * `clientWidth` from the mount element and tracks changes with a
	 * `ResizeObserver`. Providing both `width` and `height` disables automatic
	 * resize tracking entirely.
	 */
	width?: number;

	/**
	 * Fixed canvas logical height in CSS pixels. See `width` for the resize
	 * tracking implications of setting this.
	 */
	height?: number;

	/**
	 * Target frames per second for the RAF render loop. The kit caps rendering to
	 * this value using frame-time differencing — actual FPS is limited by the
	 * display refresh rate. Default `60`.
	 */
	fps?: number;

	/**
	 * Canvas bitmap resolution multiplier. Pass `2` for Retina output on
	 * displays where `devicePixelRatio === 2`. Defaults to `devicePixelRatio`
	 * when available, otherwise `1`.
	 */
	pixelRatio?: number;

	/**
	 * Controls what happens at the start of each frame before renderers are
	 * called.
	 *
	 * - `'clear'` — the context is cleared with `clearRect` so each renderer
	 *   starts from a blank canvas. Use this when renderers draw independently.
	 * - `'composite'` — nothing is cleared; renderers accumulate on top of each
	 *   other. Use this for layered effects where one renderer adds to another.
	 *
	 * Default `'clear'`.
	 */
	compositeMode?: 'clear' | 'composite';
}

/** Events emitted by {@link CanvasPlugin}. */
export interface CanvasEvents {
	/** Fired once after `use()` mounts the canvas and applies the initial size. */
	mounted: { width: number; height: number };

	/** Fired whenever the canvas is resized — either by the ResizeObserver or a manual `size(w, h)` call. */
	resized: { width: number; height: number };

	/**
	 * Fired once per animation frame, after all registered renderers have run.
	 * `deltaMs` is the milliseconds elapsed since the previous frame.
	 * `time` is the `DOMHighResTimeStamp` from the browser's `requestAnimationFrame` callback.
	 */
	frame: { deltaMs: number; time: number };
}

/**
 * Callback signature for functions registered with {@link CanvasPlugin.addRenderer}.
 *
 * @param ctx     The shared 2D rendering context for the plugin's canvas.
 * @param deltaMs Milliseconds elapsed since the previous frame.
 * @param time    `DOMHighResTimeStamp` from `requestAnimationFrame`.
 */
export type CanvasRenderFn = (ctx: CanvasRenderingContext2D, deltaMs: number, time: number) => void;

/**
 * Shared canvas and RAF loop host. Without this plugin no canvas is created and
 * no animation frame is requested — the player pays zero rendering cost.
 *
 * **What it owns:**
 * - A single `<canvas>` element mounted into the player container (or the
 *   element you point `opts.mount` at).
 * - DPI scaling via `opts.pixelRatio` and a `ResizeObserver` that keeps the
 *   canvas in sync with its container.
 * - The RAF loop, frame timing, and `deltaMs` calculation.
 * - An ordered list of render callbacks. Every registered renderer runs each
 *   frame in the order it was added.
 *
 * **Typical usage:**
 * ```ts
 * const canvas = player.getPlugin(CanvasPlugin);
 * const unregister = canvas.addRenderer((ctx, deltaMs) => {
 *   ctx.fillStyle = 'red';
 *   ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
 * });
 * // Later:
 * unregister();
 * ```
 *
 * Visualizer plugins that depend on this plugin declare it in their `requires`
 * list and call `player.getPlugin(CanvasPlugin)` inside their `use()`.
 *
 * Subclasses can override `createCanvas()` to return a custom canvas element
 * (for example an `OffscreenCanvas` shim during testing).
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

	/**
	 * Mounts the canvas into the configured element, installs a `ResizeObserver`
	 * to track container size changes (unless `opts.width` and `opts.height` are
	 * both set), and starts the RAF render loop.
	 *
	 * Emits `plugin:canvas:mounted` after the initial size is applied.
	 */
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

	/**
	 * Stops the RAF loop, disconnects the `ResizeObserver`, and drops all
	 * registered renderers. After disposal, `canvas()` and `context()` throw.
	 */
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

	/**
	 * Returns the underlying `<canvas>` element.
	 *
	 * @throws {@link StateError} `plugin:canvas/not-mounted` when called before
	 *   `use()` has mounted the element. Wait for `addPlugin(CanvasPlugin)` to
	 *   resolve, or call from inside a dependent plugin's `use()`.
	 */
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

	/**
	 * Returns the cached `CanvasRenderingContext2D`.
	 *
	 * The context is created on first access and reused for all subsequent calls.
	 *
	 * @throws {@link StateError} when `canvas()` hasn't been mounted yet.
	 * @throws {@link BrowserPolicyError} `core:policy/canvas2dUnsupported` when
	 *   the environment does not support a 2D canvas context (e.g. some headless
	 *   environments or a browser with hardware acceleration disabled).
	 */
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
	 * Register a per-frame renderer. The callback is invoked once per animation
	 * frame, in registration order, after the canvas is optionally cleared
	 * (controlled by `opts.compositeMode`).
	 *
	 * Returns an unregister function — call it to stop the renderer without
	 * disposing the entire plugin. Renderers are also removed automatically when
	 * the plugin disposes.
	 *
	 * ```ts
	 * const stop = canvas.addRenderer((ctx, deltaMs) => {
	 *   ctx.fillRect(0, 0, 10, 10);
	 * });
	 * // Remove when no longer needed:
	 * stop();
	 * ```
	 */
	addRenderer(fn: CanvasRenderFn): () => void {
		this.renderers.push(fn);
		return () => this.removeRenderer(fn);
	}

	/**
	 * Remove a previously registered render callback. Silently no-ops when `fn`
	 * is not in the current renderer list.
	 */
	removeRenderer(fn: CanvasRenderFn): void {
		const idx = this.renderers.indexOf(fn);
		if (idx >= 0)
			this.renderers.splice(idx, 1);
	}

	/**
	 * Read or write the canvas logical size in CSS pixels.
	 *
	 * **Read** — `size()` returns `{ width, height }` reflecting the canvas
	 * element's current `offsetWidth` / `offsetHeight`.
	 *
	 * **Write** — `size(width, height)` applies a manual size override. The
	 * bitmap dimensions are scaled by `opts.pixelRatio` (defaults to
	 * `devicePixelRatio`). Emits `plugin:canvas:resized`. Calling this bypasses
	 * the `ResizeObserver` path for that frame but does not disconnect the
	 * observer.
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

	/**
	 * Force an immediate resize recalculation. Reads `clientWidth` / `clientHeight`
	 * from the mount surface and calls `size(w, h)`.
	 *
	 * The `ResizeObserver` handles this automatically during normal operation.
	 * Call this only when you need to react to a resize that happened outside
	 * the observer's scope (e.g. after an explicit CSS transition).
	 */
	resize(): void {
		const surface = this.surface;
		if (!surface)
			return;

		const w = this.opts?.width ?? surface.clientWidth;
		const h = this.opts?.height ?? surface.clientHeight;
		this.size(w, h);
	}

	/**
	 * Override hook — return a custom `HTMLCanvasElement` to use instead of the
	 * default `document.createElement('canvas')`. Useful for test environments
	 * that provide a canvas shim.
	 */
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

/** Plugin alias for {@link CanvasPlugin}. Pass to `addPlugin(canvasPlugin)`. */
export const canvasPlugin = CanvasPlugin;
