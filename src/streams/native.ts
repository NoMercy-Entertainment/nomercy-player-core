import type {
	StreamEvent,
	StreamFactory,
	StreamFactoryOptions,
	StreamSource,
	StreamSourceState,
} from './source';


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

		this.boundError = () => {
			this._state = 'error';
			this.emit('error', element.error);
		};
		element.addEventListener('error', this.boundError);

		element.src = this.url;

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
			// Without load(), some browsers keep the network connection open until GC.
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
			catch (err) { void err; }
		}
	}
}


/**
 * Native stream factory — resolves URLs to direct media-element sources.
 *
 * Matches audio files (mp3, flac, aac, m4a, wav, ogg, opus, weba) and video
 * files (mp4, webm, mov, m4v, ogv) by URL extension or MIME type prefix. Any
 * URL this factory claims is handed straight to `element.src`; the browser
 * handles decoding with no intermediate library.
 *
 * Detection is extension-first (no HEAD request needed) with a content-type
 * fallback. HLS/DASH MIME types are excluded so those factories stay in charge.
 *
 * Register order: this factory ships pre-registered at the lowest priority.
 * Any other factory that also claims a URL wins because the registry resolves
 * newest-first.
 */
export const nativeFactory: StreamFactory = {
	id: 'native',

	canPlay(url: string, contentType?: string): boolean {
		if (AUDIO_EXT_RE.test(url) || VIDEO_EXT_RE.test(url))
			return true;

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
