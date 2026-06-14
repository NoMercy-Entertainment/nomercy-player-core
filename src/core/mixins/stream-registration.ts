// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { IStreamFactory } from '../../adapters/stream/IStreamSource';
import type { Internals } from '../state';

import { StreamRegistry } from '../../adapters/stream/registry';

/**
 * The stream-registration mixin's slice of player state — composed into
 * `PlayerCoreState`. The lazy `_ensureStreamRegistry` helper here is the
 * writer; the `streamsReady` setup stage triggers the same lazy-init.
 */
export interface StreamRegistrationState {
	/**
	 * Per-player stream factory registry. Lazy — first touch (either via the
	 * `streamsReady` setup stage or via consumer `registerStream`) creates
	 * the registry and seeds it with the kit defaults (`native`, `hls`).
	 */
	_streamRegistry: StreamRegistry | undefined;
}

// ──────────────────────────────────────────────────────────────────────────
// Private helpers — only used by streamRegistrationMethods
// ──────────────────────────────────────────────────────────────────────────

/**
 * Lazy-init the per-player stream registry. Default factories (`native`, `hls`)
 * are registered the first time the registry is touched OR when `setup()`
 * reaches the `streamsReady` stage — whichever comes first.
 */
function _ensureStreamRegistry(self: Internals): StreamRegistry {
	if (!self._streamRegistry) {
		self._streamRegistry = new StreamRegistry();
	}
	return self._streamRegistry;
}

// ──────────────────────────────────────────────────────────────────────────
// Mixin: stream registration — delegates to the per-player `StreamRegistry`.
// Defaults (`native`, `hls`) are wired in lazily; consumers may register
// custom factories via `registerStream(factory)`.
// ──────────────────────────────────────────────────────────────────────────

export const streamRegistrationMethods = {
	/**
	 * Register a custom stream factory. Factories are tried in reverse
	 * registration order (most-recently-registered first), so a factory
	 * registered without `prepend` takes priority over the built-in `hls` and
	 * `native` factories. Pass `prepend: true` to push the factory to the back
	 * of the queue instead. Re-registering a factory with the same `id` replaces
	 * the existing entry. Returns the player for fluent chaining.
	 */
	registerStream(this: Internals, factory: IStreamFactory, prepend?: boolean): unknown {
		_ensureStreamRegistry(this).register(factory, prepend);
		return this;
	},
	/** Remove a registered factory by id. No-op when the id is not registered. Returns the player for fluent chaining. */
	unregisterStream(this: Internals, id: string): unknown {
		_ensureStreamRegistry(this).unregister(id);
		return this;
	},
	/** Snapshot of registered factory ids in resolution order (highest-priority first). */
	streams(this: Internals): ReadonlyArray<string> {
		return _ensureStreamRegistry(this).list();
	},
	/** Look up a registered factory by id. Returns `undefined` when not found. */
	getStreamFactory(this: Internals, id: string): IStreamFactory | undefined {
		return _ensureStreamRegistry(this).findById(id);
	},
} as const;
