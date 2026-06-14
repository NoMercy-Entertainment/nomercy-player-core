// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Semver string for the currently running kit build.
 *
 * Plugin authors compare their `static readonly minCoreVersion` against this
 * value at registration time — `addPlugin` throws
 * `core:plugin/incompatible-core-version` when the plugin's required minimum
 * exceeds it. Mirrors the kit's `package.json` version and is bumped together
 * with it on every release.
 */
export const KIT_VERSION = '2.0.0-beta.1';
