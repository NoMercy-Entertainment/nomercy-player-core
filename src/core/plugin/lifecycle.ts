// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Snapshot returned by `state()`. `runtime` is plugin-defined and intended for
 * debug overlays / save+restore tooling.
 */
export interface PluginState<O = unknown> {
	id: string;
	version: string;
	enabled: boolean;
	opts: Readonly<O>;
	runtime: Record<string, unknown>;
}
