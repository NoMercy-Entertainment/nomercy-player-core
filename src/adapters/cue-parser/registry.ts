import type { CueParser } from './ICueParser';

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
		const existing = this.parsers.findIndex(p => p.id === parser.id);
		if (existing >= 0)
			this.parsers.splice(existing, 1);

		if (prepend)
			this.parsers.unshift(parser);
		else this.parsers.push(parser);
	}

	/** Remove the parser with `id`. No-op if not registered. */
	unregister(id: string): void {
		const idx = this.parsers.findIndex(p => p.id === id);
		if (idx >= 0)
			this.parsers.splice(idx, 1);
	}

	/**
	 * Walk parsers in resolution order (most-recently-registered first) and
	 * return the first one whose `canParse` accepts the input. Returns
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

	/** Return the registered parser with `id`, or `undefined` if absent. */
	findById(id: string): CueParser | undefined {
		return this.parsers.find(p => p.id === id);
	}

	/** Snapshot of registered parser ids in resolution order (last → first). */
	list(): string[] {
		return this.parsers.map(p => p.id).reverse();
	}

	/** Clear all registered parsers. Called on player dispose. */
	dispose(): void {
		this.parsers.length = 0;
	}
}
