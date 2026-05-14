import type { CueParser } from '../../cues/parser-registry';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: cue parser registry
// ──────────────────────────────────────────────────────────────────────────

export const cueParserMethods = {
	registerCueParser(this: Internals, parser: CueParser, prepend?: boolean): void {
		this._cueParsers.register(parser, prepend);
	},
	unregisterCueParser(this: Internals, id: string): void {
		this._cueParsers.unregister(id);
	},
	resolveCueParser(this: Internals, url: string): CueParser | undefined {
		return this._cueParsers.resolve(url);
	},
} as const;
