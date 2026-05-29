import type { Internals } from '../state';

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
