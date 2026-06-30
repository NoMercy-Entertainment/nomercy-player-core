// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { NetworkError } from './network';

/**
 * Thrown on 401 (unauthenticated) or 403 (forbidden) HTTP responses. Extends
 * `NetworkError` so generic `instanceof NetworkError` catches still work. The
 * player's built-in retry policy runs `auth.refreshOnUnauthenticated()` on 401
 * before raising this class; 403 propagates immediately with `attempts: 0`.
 */
export class AuthError extends NetworkError {
	override readonly name: string = 'AuthError';
}
