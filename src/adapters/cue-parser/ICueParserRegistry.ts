// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { ICueParser } from './ICueParser';

/**
 * Ordered registry of cue parsers. Resolution is most-recently-registered
 * first, so consumer-supplied parsers can override built-ins for the same
 * URL pattern.
 */
export interface ICueParserRegistry {
	register(parser: ICueParser, prepend?: boolean): void;
	unregister(id: string): void;
	resolve(url: string, contentType?: string): ICueParser | undefined;
	findById(id: string): ICueParser | undefined;
	list(): string[];
	dispose(): void;
}
