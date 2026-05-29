import type { StreamRegistry } from './registry';
import type {
	StreamEvent,
	StreamEventPayloadMap,
	StreamFactory,
	StreamFactoryOptions,
	StreamLevel,
	StreamSource,
	StreamSourceState,
} from './IStreamSource';
import Hls from 'hls.js';
import type {
	ErrorData,
	HlsConfig,
	Loader,
	LoaderCallbacks,
	LoaderConfiguration,
	LoaderContext,
	LoaderResponse,
	LoaderStats,
} from 'hls.js';
import { MediaFormatError, StreamError } from '../../errors';


export const HLS_EXT_RE = /\.m3u8(?:\?|$)/iu;
// RFC 8216 + IANA: canonical is `application/vnd.apple.mpegurl`, legacy aliases include `application/x-mpegurl` and `audio/mpegurl`.
const HLS_MIME_RE = /^(?:application|audio)\/(?:vnd\.apple\.mpegurl|x-mpegurl|mpegurl)$/iu;

/**
 * `StreamSource` implementation for HLS streams.
 *
 * On browsers that report native HLS support (Safari, iOS WebKit) the URL is
 * set directly on the media element — no extra library, full OS integration.
 * Everywhere else `hls.js` handles manifest parsing, ABR, and segment loading.
 *
 * When a `StreamRegistry` is provided and has interceptors installed, every
 * manifest and segment response is piped through `registry.runInterceptors()`
 * before hls.js processes the bytes. Interceptors are NOT called on the native
 * path because the browser fetches those resources directly.
 */
export class HlsStreamSource implements StreamSource {
	readonly kind = 'hls' as const;

	private hls?: Hls;
	private element?: HTMLMediaElement;
	private listeners = new Map<StreamEvent, Set<(data: StreamEventPayloadMap[StreamEvent]) => void>>();
	private boundElementError?: () => void;
	private _state: StreamSourceState = 'idle';
	private currentLevelIdx = -1;

	constructor(private readonly url: string, private readonly registry?: StreamRegistry) {}

	/** @internal */
	getRegistry(): StreamRegistry | undefined {
		return this.registry;
	}

	async attach(element: HTMLMediaElement): Promise<void> {
		this.element = element;
		this._state = 'loading';

		this.boundElementError = () => {
			if (element.error)
				this.emit('error', element.error);
		};
		element.addEventListener('error', this.boundElementError);

		const native = canPlayNativeHls(element);
		if (native) {
			element.src = this.url;
			await this.waitForLoadedMetadata(element);
			return;
		}

		if (!Hls.isSupported()) {
			throw new MediaFormatError({
				code: 'core:media/hls-unsupported',
				severity: 'error',
				scope: {
					kind: 'stream',
					id: 'hls',
				},
				message: 'HLS playback requires either native browser support (Safari) or hls.js. Neither is available in this environment.',
			});
		}

		const registry = this.registry;
		this.hls = new Hls({
			autoStartLoad: true,
			enableWorker: true,
			lowLatencyMode: false,
			...(registry ? { loader: makeInterceptingLoader(registry) } : {}),
		});

		this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
			this._state = 'ready'; this.emit('manifest-loaded', undefined);
		});
		this.hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
			if (typeof data?.level === 'number')
				this.currentLevelIdx = data.level;
			this.emit('level-switched', data);
		});
		this.hls.on(Hls.Events.FRAG_LOADED, (_, data) => this.emit('fragment-loaded', data));
		this.hls.on(Hls.Events.ERROR, (_, data) => {
			if (data?.fatal) {
				this._state = 'error';
				this.emit('error', data);
			}
		});

		this.hls.attachMedia(element);
		await new Promise<void>((resolve, reject) => {
			const onAttached = () => {
				cleanup();
				resolve();
			};
			const onErr = (_: string, data: ErrorData) => {
				if (data.fatal) {
					cleanup();
					reject(new StreamError({
						code: 'core:stream/hls-attach-failed',
						severity: 'error',
						scope: {
							kind: 'stream',
							id: 'hls',
						},
						message: `hls.js attach error: ${data.details ?? 'unknown'}`,
						cause: data,
					}));
				}
			};
			const cleanup = () => {
				this.hls?.off(Hls.Events.MEDIA_ATTACHED, onAttached);
				this.hls?.off(Hls.Events.ERROR, onErr);
			};
			this.hls!.on(Hls.Events.MEDIA_ATTACHED, onAttached);
			this.hls!.on(Hls.Events.ERROR, onErr);
		});

		this.hls.loadSource(this.url);
	}

	detach(): void {
		if (this.element && this.boundElementError) {
			this.element.removeEventListener('error', this.boundElementError);
		}
		if (this.hls) {
			try {
				this.hls.detachMedia();
			}
			catch { /* defensive */ }
			try {
				this.hls.destroy();
			}
			catch { /* defensive */ }
			this.hls = undefined;
		}
		if (this.element) {
			this.element.removeAttribute('src');
			try {
				this.element.load();
			}
			catch { /* defensive */ }
		}
		this.element = undefined;
		this.boundElementError = undefined;
		this._state = 'idle';
	}

	destroy(): void {
		this.detach();
		this.listeners.clear();
	}

	state(): StreamSourceState {
		return this._state;
	}

	getLevels(): StreamLevel[] {
		if (!this.hls)
			return [];
		return this.hls.levels.map((l, index) => ({
			bitrate: l.bitrate,
			height: l.height,
			width: l.width,
			label: l.name ?? `${l.bitrate}`,
			index,
		}));
	}

	setLevel(idx: number): void {
		if (!this.hls)
			return;
		this.hls.currentLevel = idx;
	}

	getCurrentLevel(): StreamLevel | undefined {
		if (!this.hls || this.currentLevelIdx < 0)
			return undefined;
		const l = this.hls.levels[this.currentLevelIdx];
		if (!l)
			return undefined;
		return {
			bitrate: l.bitrate,
			height: l.height,
			width: l.width,
			label: l.name ?? `${l.bitrate}`,
			index: this.currentLevelIdx,
		};
	}

	on<E extends StreamEvent>(event: E, fn: (data: StreamEventPayloadMap[E]) => void): void {
		let set = this.listeners.get(event);
		if (!set) {
			set = new Set();
			this.listeners.set(event, set);
		}
		(set as Set<(data: StreamEventPayloadMap[E]) => void>).add(fn);
	}

	off<E extends StreamEvent>(event: E, fn: (data: StreamEventPayloadMap[E]) => void): void {
		const set = this.listeners.get(event);
		if (!set)
			return;
		(set as Set<(data: StreamEventPayloadMap[E]) => void>).delete(fn);
		if (set.size === 0)
			this.listeners.delete(event);
	}

	private emit<E extends StreamEvent>(event: E, data: StreamEventPayloadMap[E]): void {
		const set = this.listeners.get(event);
		if (!set)
			return;
		for (const fn of [...set]) {
			try {
				(fn as (data: StreamEventPayloadMap[E]) => void)(data);
			}
			catch (err) { void err; /* swallow per contract */ }
		}
	}

	private async waitForLoadedMetadata(element: HTMLMediaElement): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			const onLoad = () => {
				cleanup();
				resolve();
			};
			const onError = () => {
				cleanup();
				reject(element.error ?? new MediaFormatError({
					code: 'core:media/load-failed',
					severity: 'error',
					scope: {
						kind: 'stream',
						id: 'hls',
					},
					message: 'media element error',
					cause: element.error,
				}));
			};
			const cleanup = () => {
				element.removeEventListener('loadedmetadata', onLoad);
				element.removeEventListener('error', onError);
			};
			element.addEventListener('loadedmetadata', onLoad, { once: true });
			element.addEventListener('error', onError, { once: true });
		});
	}
}

function canPlayNativeHls(element: HTMLMediaElement): boolean {
	const probe = element.canPlayType('application/vnd.apple.mpegurl');
	return probe === 'maybe' || probe === 'probably';
}

/** Narrow view of hls.js's static `DefaultConfig` — only the loader field we use. */
interface HlsWithDefaultConfig {
	DefaultConfig?: { loader?: new (config: HlsConfig) => Loader<LoaderContext> };
}


/**
 * Build an hls.js `Loader` constructor that wraps the default loader (FetchLoader
 * where available, XhrLoader fallback) and pipes every successful response through
 * `registry.runInterceptors()` before forwarding it to hls.js. Errors, aborts,
 * and timeouts pass through untouched.
 *
 * Returns `undefined` when `hls.js` does not expose `DefaultConfig.loader` (older
 * builds); callers omit the `loader` override in that case.
 */
function makeInterceptingLoader(registry: StreamRegistry): (new (config: HlsConfig) => Loader<LoaderContext>) | undefined {
	const Base = (Hls as unknown as HlsWithDefaultConfig).DefaultConfig?.loader;
	if (!Base)
		return undefined;

	// TS does not narrow closure captures across deferred class bodies.
	// Capturing `Base` in a typed local lets the class constructor body compile.
	const BaseCtor: new (config: HlsConfig) => Loader<LoaderContext> = Base;

	return class InterceptingLoader {
		private inner: Loader<LoaderContext>;
		public context: LoaderContext | null = null;
		public stats: LoaderStats;

		constructor(config: HlsConfig) {
			this.inner = new BaseCtor(config);
			this.stats = this.inner.stats;
		}

		destroy(): void { this.inner.destroy(); }
		abort(): void { this.inner.abort(); }
		getCacheAge(): number | null { return this.inner.getCacheAge?.() ?? null; }
		getResponseHeader(name: string): string | null { return this.inner.getResponseHeader?.(name) ?? null; }

		load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>): void {
			this.context = context;
			const wrapped: LoaderCallbacks<LoaderContext> = {
				...callbacks,
				onSuccess: async (response: LoaderResponse, stats: LoaderStats, ctx: LoaderContext, networkDetails: unknown) => {
					try {
						const synthetic = toResponse(response, ctx.url ?? context.url);
						const intercepted = await registry.runInterceptors(ctx.url ?? context.url, synthetic);
						const data = await readBody(intercepted, response.data);
						callbacks.onSuccess({ ...response, data }, stats, ctx, networkDetails);
					}
					catch {
						// Interceptor failure must not break playback — pass through
						callbacks.onSuccess(response, stats, ctx, networkDetails);
					}
				},
			};
			this.inner.load(context, config, wrapped);
		}
	};
}

function toResponse(response: { data?: string | ArrayBuffer | object; code?: number }, url: string): Response {
	const body = response.data;
	const init: ResponseInit = {
		status: response.code ?? 200,
		headers: { 'x-source-url': url },
	};

	if (body == null)
		return new Response(null, init);
	if (typeof body === 'string')
		return new Response(body, init);
	if (body instanceof ArrayBuffer)
		return new Response(body, init);

	// hls.js may hand us an already-parsed manifest object — re-stringify so
	// interceptors always receive a real Response with a readable body.
	return new Response(JSON.stringify(body), init);
}


async function readBody(response: Response, original: string | ArrayBuffer | object | undefined): Promise<string | ArrayBuffer | object | undefined> {
	if (original == null)
		return undefined;
	if (typeof original === 'string')
		return await response.text();
	if (original instanceof ArrayBuffer)
		return await response.arrayBuffer();

	try {
		return JSON.parse(await response.text());
	}
	catch { return original; }
}


/**
 * HLS stream factory — resolves `.m3u8` URLs to `HlsStreamSource` instances.
 *
 * URL detection:
 * - `.m3u8` extension (with optional query string)
 * - `application/vnd.apple.mpegurl`, `application/x-mpegurl`, or `audio/mpegurl`
 *   content-type (RFC 8216 + common aliases)
 *
 * On browsers with native HLS support (Safari, iOS) the source sets `element.src`
 * directly and skips hls.js entirely. On all other browsers hls.js handles ABR,
 * manifest parsing, and segment loading. When a `StreamRegistry` is attached and
 * has interceptors installed, fetches are routed through those interceptors before
 * hls.js processes the bytes.
 *
 * This factory ships pre-registered at the second-highest priority (above native).
 * Register a custom factory with the same `canPlay` signature to override it.
 */
export const hlsFactory: StreamFactory = {
	id: 'hls',

	canPlay(url: string, contentType?: string): boolean {
		if (HLS_EXT_RE.test(url))
			return true;
		if (contentType && HLS_MIME_RE.test(contentType))
			return true;
		return false;
	},

	create(opts: StreamFactoryOptions): StreamSource {
		return new HlsStreamSource(opts.url, opts.registry);
	},
};

export default hlsFactory;
