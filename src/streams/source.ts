import type { StreamRegistry } from './registry';

/** Events any StreamSource can emit. */
export type StreamEvent
	= | 'manifest-loaded'
		| 'level-switched'
		| 'level-considered'
		| 'fragment-loaded'
		| 'encrypted'
		| 'error';

/** Quality level information for adaptive streams. */
export interface StreamLevel {
	bitrate: number;
	height?: number;
	width?: number;
	label: string;
	index?: number;
}

/** State a StreamSource exposes via `state()`. */
export type StreamSourceState = 'idle' | 'loading' | 'ready' | 'playing' | 'error';

/**
 * Capability hint passed to `StreamFactory.canPlay` so factories can refuse
 * based on device limits even when the URL otherwise matches. Populated from
 * `navigator.mediaCapabilities` and player config.
 */
export interface StreamCapabilities {
	width?: number;
	height?: number;
	bitrate?: number;
	framerate?: number;
	preferred?: 'smooth' | 'powerEfficient';
}

/**
 * Protocol-agnostic stream wrapper. HLS, DASH, native — all implement this.
 * Typed against HTMLMediaElement so it works for `<audio>` and `<video>`.
 */
export interface StreamSource {
	readonly kind: 'native' | 'hls' | 'dash';
	attach(element: HTMLMediaElement): Promise<void>;
	detach(): void;
	destroy(): void;

	/** Current source state. */
	state(): StreamSourceState;

	getLevels?(): StreamLevel[];
	setLevel?(idx: number): void;
	/** Quality level currently driving playback. */
	getCurrentLevel?(): StreamLevel | undefined;
	/**
	 * Override the default ABR strategy with a custom selector. Receives the
	 * level list and a context object; returns the chosen index.
	 */
	setLevelStrategy?(fn: (levels: StreamLevel[], ctx: { bandwidth: number; bufferedSeconds: number }) => number): void;

	on(event: StreamEvent, fn: (data?: any) => void): void;
	off(event: StreamEvent, fn: (data?: any) => void): void;
}

export interface StreamFactoryOptions {
	url: string;
	contentType?: string;
	accessToken?: string | (() => string);
	/** Per-stream request headers — overrides global auth headers for this stream. */
	headers?: Record<string, string>;
	/** Capability hints from the device. */
	capabilities?: StreamCapabilities;
	/**
	 * Owning registry — passed by `StreamRegistry.resolve()` so the source can
	 * pipe manifest / segment fetches through `runInterceptors()`. Optional so
	 * direct `factory.create({ url })` calls still work in tests.
	 */
	registry?: StreamRegistry;
}

export interface StreamFactory {
	readonly id: string;
	/**
	 * Test whether this factory can handle the given URL / content-type. The
	 * optional `capabilities` argument lets factories refuse based on device
	 * limits even when the URL otherwise matches.
	 */
	canPlay(url: string, contentType?: string, capabilities?: StreamCapabilities): boolean;
	create(opts: StreamFactoryOptions): StreamSource;
}

/**
 * Stream-content interceptor. Plugins install one to mutate manifest / segment
 * responses before they reach the underlying pipeline (hls.js, native, etc.).
 * Return the original or a modified Response.
 */
export type StreamInterceptor = (url: string, response: Response) => Response | Promise<Response>;
