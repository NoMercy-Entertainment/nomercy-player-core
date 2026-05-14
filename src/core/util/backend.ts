import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Backend accessor helpers shared by transport, time, volume, player-state,
// media-tracks, and audio-output mixins.
// ──────────────────────────────────────────────────────────────────────────

export interface BackendShape {
	play?: () => Promise<void> | void;
	pause?: () => void;
	stop?: () => void;
	load?: (url: string) => Promise<void>;
	currentTime?: (t: number) => void;
	buffered?: () => number;
	bufferedRanges?: () => TimeRanges;
	volume?: (v: number) => void;
	mute?: () => void;
	unmute?: () => void;
	playbackRate?: (rate: number) => void;
}

function _isBackendShape(value: unknown): value is BackendShape {
	return typeof value === 'object' && value !== null;
}

/** Resolve the backend, throwing if absent. Used by transport/time/volume where a backend is expected. */
export function resolveBackend(self: Internals): BackendShape | undefined {
	if (typeof self.backend !== 'function') return undefined;
	const result = self.backend();
	return _isBackendShape(result) ? result : undefined;
}

/**
 * Resolve the active backend handle without forcing instantiation. Returns
 * `undefined` when no backend has been touched yet (so reads on a freshly-set-up
 * player without a load() return empty arrays instead of throwing).
 */
export function peekBackend(self: Internals): unknown {
	if (typeof self.backend !== 'function')
		return undefined;
	try {
		return self.backend();
	}
	catch { return undefined; }
}

export function peekBackendTyped<S extends object>(self: Internals): S | undefined {
	return peekBackend(self) as S | undefined;
}
