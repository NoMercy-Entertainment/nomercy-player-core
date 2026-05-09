import type {
	StreamFactory,
	StreamFactoryOptions,
	StreamInterceptor,
	StreamSource,
} from './source';
import { StreamError } from '../errors';

/**
 * Ordered list of stream factories. Both players keep one of these and ask it
 * to resolve a URL to a playable StreamSource.
 *
 * Default factories (`native`, `hls`) are registered automatically on init.
 * DASH and others register on demand via `registerStream(...)` on the player.
 *
 * Resolution order: most-recently-registered factory wins (last-in-first-out)
 * unless `prepend` is used. This lets a consumer override a default factory by
 * registering their own with the same content match. Example: a custom HLS
 * implementation that takes precedence over the built-in hls.js wrapper.
 */
export class StreamRegistry {
	private readonly factories: StreamFactory[] = [];
	private readonly interceptors: StreamInterceptor[] = [];

	register(factory: StreamFactory, prepend?: boolean): void {
		// Drop any existing factory with the same id — a re-registration is
		// always a replacement, not a duplication.
		const existing = this.factories.findIndex(f => f.id === factory.id);
		if (existing >= 0)
			this.factories.splice(existing, 1);

		if (prepend)
			this.factories.unshift(factory);
		else this.factories.push(factory);
	}

	unregister(id: string): void {
		const idx = this.factories.findIndex(f => f.id === id);
		if (idx >= 0)
			this.factories.splice(idx, 1);
	}

	resolve(opts: StreamFactoryOptions): StreamSource {
		// Walk from most-recently-registered to oldest so prepended factories
		// take precedence over defaults.
		for (let i = this.factories.length - 1; i >= 0; i--) {
			const factory = this.factories[i];
			if (!factory)
				continue;
			if (factory.canPlay(opts.url, opts.contentType, opts.capabilities)) {
				// Thread the registry through so the source can call
				// runInterceptors() on its manifest / segment fetches.
				return factory.create({
					...opts,
					registry: this,
				});
			}
		}
		throw new StreamError({
			code: 'core:stream/no-factory-match',
			severity: 'error',
			scope: { kind: 'core' },
			message: `No stream factory could play ${opts.url}${opts.contentType ? ` (${opts.contentType})` : ''}. Register a factory via player.registerStream(...) first.`,
			context: {
				url: opts.url,
				contentType: opts.contentType,
			},
		});
	}

	has(id: string): boolean {
		return this.factories.some(f => f.id === id);
	}

	/** Look up a registered factory by id. */
	findById(id: string): StreamFactory | undefined {
		return this.factories.find(f => f.id === id);
	}

	/** Snapshot of registered factory ids in resolution order (last → first). */
	list(): string[] {
		return this.factories.map(f => f.id).reverse();
	}

	// ── Content interceptors ──

	/**
	 * Install a content interceptor — runs against every manifest / segment
	 * response before the underlying protocol handler sees it. Multiple
	 * interceptors compose in registration order. Returns the unsubscribe fn.
	 */
	intercept(fn: StreamInterceptor): () => void {
		this.interceptors.push(fn);
		return () => {
			const idx = this.interceptors.indexOf(fn);
			if (idx >= 0)
				this.interceptors.splice(idx, 1);
		};
	}

	/**
	 * Run a response through all registered interceptors. Stream backends call
	 * this internally before yielding the body to hls.js / native parsers.
	 */
	async runInterceptors(url: string, response: Response): Promise<Response> {
		let current = response;
		for (const fn of this.interceptors) {
			current = await fn(url, current);
		}
		return current;
	}

	dispose(): void {
		this.factories.length = 0;
		this.interceptors.length = 0;
	}
}
