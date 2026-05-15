import type { StreamFactory, StreamFactoryOptions, StreamInterceptor, StreamSource } from './IStreamSource';

/**
 * Per-player catalogue of stream factories and content interceptors.
 */
export interface IStreamRegistry {
	register(factory: StreamFactory, prepend?: boolean): void;
	unregister(id: string): void;
	resolve(opts: StreamFactoryOptions): StreamSource;
	has(id: string): boolean;
	findById(id: string): StreamFactory | undefined;
	list(): string[];
	intercept(fn: StreamInterceptor): () => void;
	runInterceptors(url: string, response: Response): Promise<Response>;
	dispose(): void;
}
