// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Minimal fetch abstraction. The kit's `authFetch` orchestrator uses this
 * internally so the underlying transport can be swapped in tests (injecting a
 * mock) or native-shell environments (routing through a native HTTP stack
 * that respects system proxies / certificate pinning).
 *
 * The signature deliberately mirrors the browser's `fetch` global so standard
 * implementations are zero-cost wrappers:
 *
 * ```ts
 * const defaultFetch: IFetch = (url, opts) => fetch(url, opts);
 * ```
 */
export interface IFetch {
	(url: string, opts?: RequestInit): Promise<Response>;
}
