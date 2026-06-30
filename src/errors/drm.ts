// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { PlayerError } from './player';

/**
 * Thrown when a DRM operation fails — `requestMediaKeySystemAccess` denied,
 * license server returned an error, or key expiry. Scope is `{ kind: 'core' }`.
 * Codes follow `core:drm/<reason>`.
 */
export class DrmError extends PlayerError {
	override readonly name = 'DrmError';
}
