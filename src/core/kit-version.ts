// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import pkg from '../../package.json';

/**
 * Semver string for the currently running kit build. Derived from
 * `package.json` at compile time via `resolveJsonModule` so it cannot drift
 * from the published version.
 *
 * Plugin authors compare their `static readonly minCoreVersion` against this
 * value at registration time — `addPlugin` throws
 * `core:plugin/incompatible-core-version` when the plugin's required minimum
 * exceeds it.
 */
export const KIT_VERSION: string = pkg.version;
