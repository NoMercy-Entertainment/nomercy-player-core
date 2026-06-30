// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { PlayerError } from './player';

/**
 * Thrown when a network request fails — DNS failure, offline, CORS, TCP reset,
 * or any non-HTTP transport error. Subclasses (`AuthError`) narrow further.
 * Check `error.context.httpStatus` when an HTTP status is available.
 */
export class NetworkError extends PlayerError {
	override readonly name: string = 'NetworkError';
}
