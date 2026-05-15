import type { StreamRegistry } from './registry';


/**
 * Events a `StreamSource` can emit. Subscribe via `source.on(event, fn)`.
 *
 * - `manifest-loaded` — playlist / header parsed; levels are now available.
 * - `level-switched` — ABR or manual call changed the active quality level.
 * - `level-considered` — ABR evaluated a level but did not switch (informational).
 * - `fragment-loaded` — a media segment finished downloading.
 * - `encrypted` — an encrypted segment was encountered; DRM key exchange is pending.
 * - `error` — a fatal or non-fatal error occurred; data carries the raw error.
 */
export type StreamEvent
	= | 'manifest-loaded'
		| 'level-switched'
		| 'level-considered'
		| 'fragment-loaded'
		| 'encrypted'
		| 'error';


/** One quality rendition from an adaptive playlist, or a description of a fixed-bitrate source. */
export interface StreamLevel {
	bitrate: number;
	height?: number;
	width?: number;
	label: string;
	index?: number;
}


/** Lifecycle state reported by `StreamSource.state()`. */
export type StreamSourceState = 'idle' | 'loading' | 'ready' | 'playing' | 'error';


/**
 * Device capability hint passed to `StreamFactory.canPlay`. Factories use this
 * to decline URLs they could technically parse but cannot decode on this hardware.
 * Populated from `navigator.mediaCapabilities` and the player's config.
 */
export interface StreamCapabilities {
	width?: number;
	height?: number;
	bitrate?: number;
	framerate?: number;
	preferred?: 'smooth' | 'powerEfficient';
}


/**
 * Protocol-agnostic handle for a playing or pending media source. One instance
 * per active playback item. Backends obtain one from `StreamRegistry.resolve()`,
 * call `attach()` to wire it to the media element, then `detach()` / `destroy()`
 * when the item changes or the player disposes.
 *
 * All three concrete kinds (`native`, `hls`, `dash`) satisfy this interface, so
 * backend code does not need to branch on protocol.
 */
export interface StreamSource {
	readonly kind: 'native' | 'hls' | 'dash';

	/** Wire this source to a media element. Resolves once metadata is available. */
	attach(element: HTMLMediaElement): Promise<void>;

	/** Remove this source from the element without releasing internal state. */
	detach(): void;

	/** Detach and release all internal state. The instance is unusable after this. */
	destroy(): void;

	/** Current lifecycle state. */
	state(): StreamSourceState;

	/** All renditions reported by the manifest. Empty for fixed-bitrate sources. */
	getLevels?(): StreamLevel[];

	/** Force a specific rendition index. Pass `-1` to return to ABR. */
	setLevel?(idx: number): void;

	/** Rendition currently driving playback, or `undefined` before the first switch. */
	getCurrentLevel?(): StreamLevel | undefined;

	/**
	 * Replace the default ABR selector with a custom function. Called before each
	 * level switch with the full level list and current network context.
	 */
	setLevelStrategy?(fn: (levels: StreamLevel[], ctx: { bandwidth: number; bufferedSeconds: number }) => number): void;

	on(event: StreamEvent, fn: (data?: any) => void): void;
	off(event: StreamEvent, fn: (data?: any) => void): void;
}


/**
 * Arguments passed to `StreamFactory.create()` and forwarded by
 * `StreamRegistry.resolve()`. The `registry` field is injected automatically
 * by the registry so the created source can pipe its fetches through
 * `runInterceptors()`; callers do not set it directly.
 */
export interface StreamFactoryOptions {
	url: string;
	contentType?: string;
	accessToken?: string | (() => string);
	/** Per-stream headers — merged over any global auth headers for this item only. */
	headers?: Record<string, string>;
	/** Capability hints from the device. */
	capabilities?: StreamCapabilities;
	registry?: StreamRegistry;
}


/**
 * Plugin contract for registering a new streaming protocol. Implement this
 * interface and pass the instance to `player.registerStream(factory)`.
 *
 * `canPlay` is called for every URL the player resolves; return `true` only when
 * your factory can handle it. `create` is called at most once per resolution.
 */
export interface StreamFactory {
	readonly id: string;

	/**
	 * Return `true` if this factory can handle the given URL and content-type.
	 * The optional `capabilities` argument lets the factory decline when the
	 * device cannot decode what the URL points to.
	 */
	canPlay(url: string, contentType?: string, capabilities?: StreamCapabilities): boolean;

	/** Instantiate a `StreamSource` for the given options. */
	create(opts: StreamFactoryOptions): StreamSource;
}


/**
 * Function installed via `StreamRegistry.intercept()`. Receives every manifest
 * and segment response before the underlying pipeline (hls.js, native, etc.)
 * processes it. Return the original `Response` unchanged or a replacement.
 *
 * Multiple interceptors compose in registration order; each receives the output
 * of the previous one.
 */
export type StreamInterceptor = (url: string, response: Response) => Response | Promise<Response>;
