import type {
	IStreamFactory,
	IStreamSource,
	StreamFactoryOptions,
	StreamInterceptor,
} from './IStreamSource';

/**
 * Per-player catalogue of stream factories and content interceptors.
 */
export interface IStreamRegistry {
	register(factory: IStreamFactory, prepend?: boolean): void;
	unregister(id: string): void;
	resolve(opts: StreamFactoryOptions): IStreamSource;
	has(id: string): boolean;
	findById(id: string): IStreamFactory | undefined;
	list(): string[];
	intercept(fn: StreamInterceptor): () => void;
	runInterceptors(url: string, response: Response): Promise<Response>;
	dispose(): void;
}
