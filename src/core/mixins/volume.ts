import type { Internals } from '../state';
import { resolveBackend } from '../util/backend';
import { emitBeforeMutation } from '../util/mutation-guard';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: volume
// ──────────────────────────────────────────────────────────────────────────

export const volumeMethods = {
	volume(this: Internals, v?: number): number | void {
		if (v === undefined) {
			return this._volumeState === 'muted' ? 0 : this._internalVolume;
		}
		if (!emitBeforeMutation(this, 'volume', [v]))
			return;
		this._internalVolume = Math.max(0, Math.min(1, v));
		if (this._volumeState !== 'muted') {
			this._volumeBeforeMute = this._internalVolume;
		}
		this.emit('volume', { level: this._internalVolume });

		resolveBackend(this)?.volume?.(this._internalVolume);
	},
	mute(this: Internals): void {
		if (this._volumeState === 'muted')
			return;
		this._volumeBeforeMute = this._internalVolume;
		this._volumeState = 'muted';
		this.emit('mute', { muted: true });

		resolveBackend(this)?.mute?.();
	},
	unmute(this: Internals): void {
		if (this._volumeState === 'unmuted')
			return;
		this._volumeState = 'unmuted';
		this._internalVolume = this._volumeBeforeMute;
		this.emit('mute', { muted: false });

		resolveBackend(this)?.unmute?.();
	},
	toggleMute(this: Internals): void {
		if (this._volumeState === 'muted')
			this.unmute();
		else this.mute();
	},
	volumeUp(this: Internals, step = 0.05): void {
		this.volume(this._internalVolume + step);
	},
	volumeDown(this: Internals, step = 0.05): void {
		this.volume(this._internalVolume - step);
	},
} as const;
