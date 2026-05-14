import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: base URL + audio context
// ──────────────────────────────────────────────────────────────────────────

export const baseUrlAudioContextMethods = {
	baseUrl(this: Internals, url?: string): string | undefined | void {
		if (url === undefined)
			return this._baseUrl;
		this._baseUrl = url;
	},
	audioContext(this: Internals): AudioContext | undefined {
		return this._audioContext;
	},
} as const;
