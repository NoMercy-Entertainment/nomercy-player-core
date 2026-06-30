// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { ICueParser } from '../../adapters/cue-parser/ICueParser';
import type { CueParserRegistry } from '../../adapters/cue-parser/registry';

import type { Internals } from '../state';

/**
 * The cue-parser mixin's slice of player state — composed into
 * `PlayerCoreState`. The registry instance is created centrally in
 * `initPlayerCoreState`; this mixin is its sole mutator (register / unregister).
 */
export interface CueParserState {
	/**
	 * Registry of cue-format parsers available to this player instance.
	 * Pre-seeded with VTT in `initPlayerCoreState`; consumers or plugins can
	 * register additional formats via `player.registerCueParser()`.
	 */
	_cueParsers: CueParserRegistry;
}

// ──────────────────────────────────────────────────────────────────────────
// Mixin: cue parser registry
// ──────────────────────────────────────────────────────────────────────────

export const cueParserMethods = {
	/**
	 * Register a custom cue-format parser. Parsers are tried most-recently-registered first.
	 * Pass `prepend: true` to push the parser below all existing entries instead.
	 * Re-registering with the same `id` replaces the existing entry.
	 */
	registerCueParser(this: Internals, parser: ICueParser, prepend?: boolean): void {
		this._cueParsers.register(parser, prepend);
	},
	/** Remove a registered cue parser by id. No-op when the id is not found. */
	unregisterCueParser(this: Internals, id: string): void {
		this._cueParsers.unregister(id);
	},
	/** Return the highest-priority parser that matches `url`, or `undefined` when none match. */
	resolveCueParser(this: Internals, url: string): ICueParser | undefined {
		return this._cueParsers.resolve(url);
	},
} as const;
