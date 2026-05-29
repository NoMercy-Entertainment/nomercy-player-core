import type { Internals } from '../state';

/**
 * The base-url / audio-context mixin's slice of player state — composed into
 * `PlayerCoreState`. `_baseUrl` is written by `baseUrl(url)`; `_audioContext`
 * is written by `setPlayerAudioContext` (AudioGraphPlugin) and read via the
 * `audioContext()` accessor here.
 */
export interface BaseUrlAudioContextState {
	/**
	 * Optional base URL prepended to relative media paths. Written by
	 * `baseUrlAudioContextMethods.baseUrl(url)`. Undefined when no prefix is
	 * configured.
	 */
	_baseUrl: string | undefined;

	/**
	 * Shared `AudioContext` for the Web Audio graph. Written by
	 * `setPlayerAudioContext` (called by `AudioGraphPlugin`). Kit plugins
	 * that want to insert nodes (EQ, spectrum) read this and bail when it is
	 * `undefined` — they depend on the audio-graph plugin being present.
	 */
	_audioContext: AudioContext | undefined;
}

// ──────────────────────────────────────────────────────────────────────────
// Mixin: base URL + audio context
// ──────────────────────────────────────────────────────────────────────────

export const baseUrlAudioContextMethods = {
	/**
	 * Read or write the player's base URL.
	 *
	 * `baseUrl()` — returns the current base URL, or `undefined` when none is set.
	 *
	 * `baseUrl(url)` — update the base URL at runtime without re-running `setup()`.
	 * All subsequent `resolveUrl()` calls use the new value.
	 */
	baseUrl(this: Internals, url?: string): string | undefined | void {
		if (url === undefined)
			return this._baseUrl;
		this._baseUrl = url;
	},
	/**
	 * The player-owned `AudioContext`, or `undefined` before one has been
	 * created. Plugins that need raw audio graph access should read this rather
	 * than constructing their own context.
	 */
	audioContext(this: Internals): AudioContext | undefined {
		return this._audioContext;
	},
} as const;
