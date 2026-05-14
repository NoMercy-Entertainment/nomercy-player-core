import type { CueParser } from '../../cues/parser-registry';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: cue parser registry
// ──────────────────────────────────────────────────────────────────────────

export const cueParserMethods = {
	/**
	 * Register a custom cue-format parser. Parsers are tried most-recently-registered first.
	 * Pass `prepend: true` to push the parser below all existing entries instead.
	 * Re-registering with the same `id` replaces the existing entry.
	 */
	registerCueParser(this: Internals, parser: CueParser, prepend?: boolean): void {
		this._cueParsers.register(parser, prepend);
	},
	/** Remove a registered cue parser by id. No-op when the id is not found. */
	unregisterCueParser(this: Internals, id: string): void {
		this._cueParsers.unregister(id);
	},
	/** Return the highest-priority parser that matches `url`, or `undefined` when none match. */
	resolveCueParser(this: Internals, url: string): CueParser | undefined {
		return this._cueParsers.resolve(url);
	},
} as const;
