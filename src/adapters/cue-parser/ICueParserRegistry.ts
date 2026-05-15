import type { CueParser } from './ICueParser';

/**
 * Ordered registry of cue parsers. Resolution is most-recently-registered
 * first, so consumer-supplied parsers can override built-ins for the same
 * URL pattern.
 */
export interface ICueParserRegistry {
	register(parser: CueParser, prepend?: boolean): void;
	unregister(id: string): void;
	resolve(url: string, contentType?: string): CueParser | undefined;
	findById(id: string): CueParser | undefined;
	list(): string[];
	dispose(): void;
}
