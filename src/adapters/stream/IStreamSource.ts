import type {
	ErrorData,
	FragLoadedData,
	LevelSwitchedData,
} from 'hls.js';

import type { StreamRegistry } from './registry';

/**
 * Events an `IStreamSource` can emit. Subscribe via `source.on(event, fn)`.
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

/** Payload for `level-considered` — ABR evaluated but did not switch. */
export interface StreamLevelConsideredPayload {
	/** Index of the candidate level. */
	level: number;
	/** Reason the switch was not made. */
	reason: string;
}

/** Payload for `encrypted` — an encrypted segment was encountered. */
export interface StreamEncryptedPayload {
	/** Key URI from the manifest. */
	keyUri: string;
	/** Key format identifier (e.g. `'identity'`, `'com.apple.streamingkeydelivery'`). */
	keyFormat?: string;
}

/**
 * `error` payload from the native browser path (`HTMLMediaElement.error`),
 * or from hls.js (`ErrorData`).
 */
export type StreamErrorPayload = MediaError | ErrorData;

/**
 * Typed payload map for every `StreamEvent`. Consumers receive the narrowed
 * type automatically from `IStreamSource.on(event, fn)` — no inline annotations
 * or casts needed at the call site.
 */
export interface StreamEventPayloadMap {
	/** Manifest or metadata parsed; quality levels are now available. */
	'manifest-loaded': undefined;
	/** ABR or explicit call switched to a new quality rendition. */
	'level-switched': LevelSwitchedData;
	/** ABR evaluated a candidate level but did not switch (informational). */
	'level-considered': StreamLevelConsideredPayload;
	/** A media segment finished downloading. */
	'fragment-loaded': FragLoadedData;
	/** An encrypted segment was encountered; DRM key exchange is pending. */
	'encrypted': StreamEncryptedPayload;
	/** A fatal or non-fatal error occurred. */
	'error': StreamErrorPayload;
}

/** One quality rendition from an adaptive playlist, or a description of a fixed-bitrate source. */
export interface StreamLevel {
	bitrate: number;
	height?: number;
	width?: number;
	label: string;
	index?: number;
}

export const STREAM_SOURCE_STATE = {
	IDLE: 'idle',
	LOADING: 'loading',
	READY: 'ready',
	PLAYING: 'playing',
	ERROR: 'error',
} as const;

/** Lifecycle state reported by `IStreamSource.state()`. */
export type StreamSourceState = typeof STREAM_SOURCE_STATE[keyof typeof STREAM_SOURCE_STATE];

/**
 * Device capability hint passed to `IStreamFactory.canPlay`. Factories use this
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
export interface IStreamSource {
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

	on<E extends StreamEvent>(event: E, fn: (data: StreamEventPayloadMap[E]) => void): void;
	off<E extends StreamEvent>(event: E, fn: (data: StreamEventPayloadMap[E]) => void): void;
}

/**
 * Arguments passed to `IStreamFactory.create()` and forwarded by
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
export interface IStreamFactory {
	readonly id: string;

	/**
	 * Return `true` if this factory can handle the given URL and content-type.
	 * The optional `capabilities` argument lets the factory decline when the
	 * device cannot decode what the URL points to.
	 */
	canPlay(url: string, contentType?: string, capabilities?: StreamCapabilities): boolean;

	/** Instantiate an `IStreamSource` for the given options. */
	create(opts: StreamFactoryOptions): IStreamSource;
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
