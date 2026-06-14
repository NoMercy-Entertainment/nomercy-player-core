// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { BeforeDispatchOutcome } from '../dispatch';

/**
 * Result returned by `Plugin.dispatchBefore(...)`. Alias for `BeforeDispatchOutcome`
 * so plugin authors share the single source-of-truth type from `dispatch.ts`.
 */
export type BeforeDispatchResult<TData> = BeforeDispatchOutcome<TData>;

/** Options for `Plugin.dispatchBefore(...)`. */
export interface DispatchBeforeOptions {
	/** Cap on `delay()` waits before timing out. Default = player's `beforeEventTimeoutMs`. */
	timeoutMs?: number;
}
