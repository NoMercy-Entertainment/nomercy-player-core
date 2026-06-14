// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { IIdGenerator } from './IIdGenerator';

/**
 * Default `IIdGenerator` — uses `crypto.randomUUID()`. Falls back to a
 * timestamp + random suffix in environments where `crypto.randomUUID` is
 * absent (some old workers, non-secure contexts).
 */
export const defaultIdGenerator: IIdGenerator = {
	next(): string {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return `${Date.now().toString(36)}-${Math.random().toString(36)
			.slice(2)}`;
	},
};
