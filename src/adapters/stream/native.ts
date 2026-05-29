import type {
	IStreamFactory,
	IStreamSource,
	StreamEvent,
	StreamEventPayloadMap,
	StreamFactoryOptions,
	StreamSourceState,
} from './IStreamSource';

const AUDIO_EXT_RE = /\.(?:mp3|flac|aac|m4a|wav|ogg|opus|weba)(?:\?|$)/iu;
const VIDEO_EXT_RE = /\.(?:mp4|webm|mov|m4v|ogv)(?:\?|$)/iu;

class NativeStreamSource implements IStreamSource {
	readonly kind = 'native' as const;
	private listeners = new Map<StreamEvent, Set<(data: StreamEventPayloadMap[StreamEvent]) => void>>();
	private element?: HTMLMediaElement;
	private boundError?: () => void;
	private _state: StreamSourceState = 'idle';

	constructor(private readonly url: string) {}

	async attach(element: HTMLMediaElement): Promise<void> {
		this.element = element;
		this._state = 'loading';

		this.boundError = () => {
			this._state = 'error';
			if (element.error)
				this.emit('error', element.error);
		};
		element.addEventListener('error', this.boundError);

		element.src = this.url;

		await new Promise<void>((resolve, reject) => {
			const cleanup = () => {
				element.removeEventListener('loadedmetadata', onLoad);
				element.removeEventListener('error', onError);
			};
			const onLoad = () => {
				cleanup();
				this._state = 'ready';
				this.emit('manifest-loaded', undefined);
				resolve();
			};
			const onError = () => {
				cleanup();
				this._state = 'error';
				reject(element.error ?? new Error('media element error'));
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
export const nativeFactory: IStreamFactory = {
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

	create(opts: StreamFactoryOptions): IStreamSource {
		return new NativeStreamSource(opts.url);
	},
};

export default nativeFactory;
