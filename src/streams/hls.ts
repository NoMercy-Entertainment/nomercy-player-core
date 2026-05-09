import type { StreamRegistry } from './registry';
import type {
	StreamEvent,
	StreamFactory,
	StreamFactoryOptions,
	StreamLevel,
	StreamSource,
	StreamSourceState,
} from './source';
import Hls from 'hls.js';
import { MediaFormatError, StreamError } from '../errors';

/**
 * HLS stream factory. Uses `hls.js` everywhere except where the media element
 * reports native HLS support (Safari, iOS) — there it sets `element.src`
 * directly to take advantage of platform-level integration.
 *
 * URL detection:
 *  - `.m3u8` extension
 *  - `application/vnd.apple.mpegurl` / `application/x-mpegURL` content-type
 *
 * Native is preferred when available (no decode overhead, OS controls work).
 * Otherwise `hls.js` handles parsing, ABR, and segment loading.
 */

const HLS_EXT_RE = /\.m3u8(?:\?|$)/iu;
// RFC 8216 + IANA: canonical is `application/vnd.apple.mpegurl`, legacy aliases
// include `application/x-mpegurl` and `audio/mpegurl` (and `audio/x-mpegurl`).
const HLS_MIME_RE = /^(?:application|audio)\/(?:vnd\.apple\.mpegurl|x-mpegurl|mpegurl)$/iu;

export class HlsStreamSource implements StreamSource {
	readonly kind = 'hls' as const;

	private hls?: Hls;
	private element?: HTMLMediaElement;
	private listeners = new Map<StreamEvent, Set<(data?: any) => void>>();
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

		this.boundElementError = () => this.emit('error', element.error);
		element.addEventListener('error', this.boundElementError);

		const native = canPlayNativeHls(element);
		if (native) {
			// Native HLS path: the browser fetches manifests/segments directly.
			// There is no fetch interception hook here, so registered stream
			// interceptors do NOT run. Consumers needing interception must
			// force the hls.js path by overriding canPlayNativeHls or by
			// configuring the player to skip native.
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
			// Sensible defaults; consumers override via Hls config later if needed
			autoStartLoad: true,
			enableWorker: true,
			lowLatencyMode: false,
			// Route every manifest + segment fetch through the registry's
			// interceptor pipeline before yielding bytes to hls.js. The
			// underlying transport stays whatever hls.js chose by default
			// (FetchLoader where supported, XhrLoader as a fallback) — we just
			// wrap its success callback to thread the response through the
			// installed interceptors.
			...(registry ? { loader: makeInterceptingLoader(registry) } : {}),
		});

		this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
			this._state = 'ready'; this.emit('manifest-loaded');
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
			const onErr = (_: any, data: any) => {
				if (data?.fatal) {
					cleanup();
					reject(new StreamError({
						code: 'core:stream/hls-attach-failed',
						severity: 'error',
						scope: {
							kind: 'stream',
							id: 'hls',
						},
						message: `hls.js attach error: ${data?.details ?? 'unknown'}`,
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

	on(event: StreamEvent, fn: (data?: any) => void): void {
		let set = this.listeners.get(event);
		if (!set) {
			set = new Set();
			this.listeners.set(event, set);
		}
		set.add(fn);
	}

	off(event: StreamEvent, fn: (data?: any) => void): void {
		const set = this.listeners.get(event);
		if (!set)
			return;
		set.delete(fn);
		if (set.size === 0)
			this.listeners.delete(event);
	}

	private emit(event: StreamEvent, data?: any): void {
		const set = this.listeners.get(event);
		if (!set)
			return;
		for (const fn of [...set]) {
			try {
				fn(data);
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

/**
 * Builds an hls.js Loader constructor that wraps the default loader and runs
 * every successful response through `registry.runInterceptors()` before
 * forwarding it back to hls.js. Errors / aborts / timeouts pass through
 * untouched. The wrapped loader is whichever loader hls.js's DefaultConfig
 * picked at construction time (FetchLoader where available, XhrLoader fallback).
 */
function makeInterceptingLoader(registry: StreamRegistry): any {
	const Base: any = (Hls as any).DefaultConfig?.loader;
	if (!Base)
		return undefined;

	return class InterceptingLoader {
		private inner: any;
		public context: any = null;
		public stats: any;

		constructor(config: any) {
			this.inner = new Base(config);
			this.stats = this.inner.stats;
		}

		destroy(): void { this.inner.destroy?.(); }
		abort(): void { this.inner.abort?.(); }
		getCacheAge(): number | null { return this.inner.getCacheAge?.() ?? null; }
		getResponseHeader(name: string): string | null { return this.inner.getResponseHeader?.(name) ?? null; }

		load(context: any, config: any, callbacks: any): void {
			this.context = context;
			const wrapped = {
				...callbacks,
				onSuccess: async (response: any, stats: any, ctx: any, networkDetails: any) => {
					try {
						const synthetic = toResponse(response, ctx?.url ?? context.url);
						const intercepted = await registry.runInterceptors(ctx?.url ?? context.url, synthetic);
						const data = await readBody(intercepted, response.data);
						callbacks.onSuccess({
							...response,
							data,
						}, stats, ctx, networkDetails);
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
	// Object-shaped manifests (post-parse) — re-stringify so interceptors get a
	// real Response. Most interceptors operate on raw bytes anyway.
	return new Response(JSON.stringify(body), init);
}

async function readBody(response: Response, original: string | ArrayBuffer | object | undefined): Promise<string | ArrayBuffer | object | undefined> {
	if (original == null)
		return undefined;
	if (typeof original === 'string')
		return await response.text();
	if (original instanceof ArrayBuffer)
		return await response.arrayBuffer();
	// Object-shaped: read text and re-parse if interceptor actually mutated it
	try {
		return JSON.parse(await response.text());
	}
	catch { return original; }
}

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
