import type { CueList } from './cue';

/**
 * Registry contract for a cue-format parser. Parsers turn raw text (LRC, VTT,
 * TTML, SRT, custom proprietary formats, etc.) into a `CueList<T>` the
 * player's `CueTracker` can iterate.
 *
 * Built-in parsers (LRC, VTT, sprite-VTT) ship with the kit and register
 * automatically. Consumers add custom formats via
 * `player.registerCueParser(parser)`.
 */
export interface CueParser<T = unknown> {
	/**
	 * Identifier — `'lrc'`, `'vtt'`, `'sprite-vtt'`, vendor-prefixed for
	 * custom formats (`'fillz:karaoke'`).
	 */
	readonly id: string;

	/**
	 * Whether this parser handles the given URL / content-type. The registry
	 * walks parsers in registration order (most recent first) and uses the
	 * first match. Returning `true` here is a commitment — no fall-through.
	 */
	canParse(url: string, contentType?: string): boolean;

	/**
	 * Parse raw text into a typed cue list. Errors propagate; the registry
	 * surfaces them via the player's standard error pipeline.
	 */
	parse(raw: string, opts?: { baseUrl?: string }): CueList<T>;
}

/**
 * Ordered registry of cue parsers. Resolution is most-recently-registered
 * first, so consumer-supplied parsers can override built-ins for the same
 * URL pattern.
 */
export class CueParserRegistry {
	private readonly parsers: CueParser[] = [];

	/**
	 * Add a parser to the registry. Re-registering an id replaces the existing
	 * entry. `prepend: true` puts the parser at the LOW-priority end of the
	 * list — built-ins use this to seed defaults that can be overridden.
	 */
	register(parser: CueParser, prepend?: boolean): void {
		// Drop existing entry with the same id — re-register is always replace.
		const existing = this.parsers.findIndex(p => p.id === parser.id);
		if (existing >= 0)
			this.parsers.splice(existing, 1);

		if (prepend)
			this.parsers.unshift(parser);
		else this.parsers.push(parser);
	}

	unregister(id: string): void {
		const idx = this.parsers.findIndex(p => p.id === id);
		if (idx >= 0)
			this.parsers.splice(idx, 1);
	}

	/**
	 * Walk parsers in resolution order (most-recently-registered first) and
	 * return the first one whose `canPlay` accepts the input. Returns
	 * `undefined` when nothing matches — caller decides whether absence is an
	 * error or a no-op.
	 */
	resolve(url: string, contentType?: string): CueParser | undefined {
		for (let i = this.parsers.length - 1; i >= 0; i--) {
			const parser = this.parsers[i];
			if (!parser)
				continue;
			if (parser.canParse(url, contentType))
				return parser;
		}
		return undefined;
	}

	findById(id: string): CueParser | undefined {
		return this.parsers.find(p => p.id === id);
	}

	/** Snapshot of registered parser ids in resolution order (last → first). */
	list(): string[] {
		return this.parsers.map(p => p.id).reverse();
	}

	dispose(): void {
		this.parsers.length = 0;
	}
}
