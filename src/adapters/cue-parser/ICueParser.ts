// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CueList } from '../../core/cues/cue';

/**
 * Registry contract for a cue-format parser. Parsers turn raw text (LRC, VTT,
 * TTML, SRT, custom proprietary formats, etc.) into a `CueList<T>` the
 * player's `CueTracker` can iterate.
 *
 * Built-in parsers (LRC, VTT, sprite-VTT) ship with the kit and register
 * automatically. Consumers add custom formats via
 * `player.registerCueParser(parser)`.
 */
export interface ICueParser<T = unknown> {
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
