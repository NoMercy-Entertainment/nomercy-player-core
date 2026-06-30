// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Pluggable unique-ID generator. Each call returns a fresh, collision-resistant
 * string. The default uses `crypto.randomUUID()`. Tests inject a sequential
 * counter so generated IDs are deterministic and assertion-friendly.
 */
export interface IIdGenerator {
	next(): string;
}
