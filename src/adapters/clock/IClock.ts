// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Pluggable clock. Returns the current time as a Unix-epoch millisecond
 * integer. Consumers needing distributed-sync accuracy inject a server-synced
 * implementation via `setup({ clockSource })`.
 *
 * The default (`systemClock`) delegates to `Date.now()`. Tests inject a
 * controllable fake so time-dependent logic can be driven deterministically.
 */
export interface IClock {
	now(): number;
}
