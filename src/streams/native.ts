import type {
	StreamEvent,
	StreamFactory,
	StreamFactoryOptions,
	StreamSource,
	StreamSourceState,
} from './source';

/**
 * Native protocol — direct media-element source.
 *
 * Handles formats the browser plays directly via `<audio src=...>` or
 * `<video src=...>`: mp3, flac, aac, m4a, wav, ogg, opus, mp4, webm, mov.
 * Anything else falls through to other factories (HLS, DASH, etc.).
 *
 * No transformations, no manifest parsing, no decoders — the browser handles
 * everything. The cheapest possible stream source.
 */

const AUDIO_EXT_RE = /\.(?:mp3|flac|aac|m4a|wav|ogg|opus|weba)(?:\?|$)/iu;
const VIDEO_EXT_RE = /\.(?:mp4|webm|mov|m4v|ogv)(?:\?|$)/iu;

class NativeStreamSource implements StreamSource {
	readonly kind = 'native' as const;
	private listeners = new Map<StreamEvent, Set<(data?: any) => void>>();
	private element?: HTMLMediaElement;
	private boundError?: () => void;
	private _state: StreamSourceState = 'idle';

	constructor(private readonly url: string) {}

	async attach(element: HTMLMediaElement): Promise<void> {
		this.element = element;
		this._state = 'loading';

		// Forward the element's error event onto our stream surface so the
		// player's stream-error handling sees the failure regardless of source.
		this.boundError = () => {
			this._state = 'error';
			this.emit('error', element.error);
		};
		element.addEventListener('error', this.boundError);

		element.src = this.url;

		// Wait for the element to actually start loading metadata so attach()
		// callers can `await` and know the source is wired.
		await new Promise<void>((resolve, reject) => {
			const onLoad = () => {
				cleanup();
				this._state = 'ready';
				this.emit('manifest-loaded');
				resolve();
			};
			const onError = () => {
				cleanup();
				this._state = 'error';
				reject(element.error ?? new Error('media element error'));
			};
			const cleanup = () => {
				element.removeEventListener('loadedmetadata', onLoad);
				element.removeEventListener('error', onError);
			};
			element.addEventListener('loadedmetadata', onLoad, { once: true });
			element.addEventListener('error', onError, { once: true });
		});
	}

	detach(): void {
		if (this.element && this.boundError) {
			this.element.removeEventListener('error', this.boundError);
		}
		if (this.element) {
			this.element.removeAttribute('src');
			// load() forces the element to release the source — without this,
			// some browsers hold the network connection open until GC.
			try {
				this.element.load();
			}
			catch { /* defensive */ }
		}
		this.element = undefined;
		this.boundError = undefined;
		this._state = 'idle';
	}

	destroy(): void {
		this.detach();
		this.listeners.clear();
	}

	state(): StreamSourceState {
		return this._state;
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
			catch (err) { /* swallow per stream-source contract */ void err; }
		}
	}
}

export const nativeFactory: StreamFactory = {
	id: 'native',

	canPlay(url: string, contentType?: string): boolean {
		// Path-based detection first — works without a HEAD request
		if (AUDIO_EXT_RE.test(url) || VIDEO_EXT_RE.test(url))
			return true;

		// Content-type-based fallback when the server told us
		if (contentType) {
			if (contentType.startsWith('audio/') && !contentType.includes('mpegurl'))
				return true;
			if (contentType.startsWith('video/') && !contentType.includes('mpegurl'))
				return true;
		}

		return false;
	},

	create(opts: StreamFactoryOptions): StreamSource {
		return new NativeStreamSource(opts.url);
	},
};

export default nativeFactory;
