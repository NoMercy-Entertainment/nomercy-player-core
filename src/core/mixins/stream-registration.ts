import type { StreamFactory } from '../../streams/source';
import { StreamRegistry } from '../../streams/registry';

import type { Internals } from '../state';


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
	registerStream(this: Internals, factory: StreamFactory, prepend?: boolean): unknown {
		_ensureStreamRegistry(this).register(factory, prepend);
		return this;
	},
	unregisterStream(this: Internals, id: string): unknown {
		_ensureStreamRegistry(this).unregister(id);
		return this;
	},
	streams(this: Internals): ReadonlyArray<string> {
		return _ensureStreamRegistry(this).list();
	},
	getStreamFactory(this: Internals, id: string): StreamFactory | undefined {
		return _ensureStreamRegistry(this).findById(id);
	},
} as const;
