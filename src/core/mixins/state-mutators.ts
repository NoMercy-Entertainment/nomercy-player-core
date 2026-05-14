import type { PlayStateToken, RepeatStateToken, ShuffleStateToken, VolumeStateToken } from '../state';
import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: state-enum read accessors. Subclasses override only when they need
// to type the return value as the library's own enum.
// ──────────────────────────────────────────────────────────────────────────

export const stateMethods = {
	playState(this: Internals): PlayStateToken {
		return this._playState;
	},
	volumeState(this: Internals): VolumeStateToken {
		return this._volumeState;
	},
	repeatState(this: Internals, state?: RepeatStateToken): RepeatStateToken | void {
		if (state === undefined)
			return this._repeatState;
		this._repeatState = state;
		this.emit('repeat', { state });
	},
	shuffleState(this: Internals, state?: ShuffleStateToken | boolean): ShuffleStateToken | void {
		if (state === undefined)
			return this._shuffleState;
		const next = typeof state === 'boolean' ? (state ? 'on' : 'off') : state;
		this._shuffleState = next;
		this.emit('shuffle', { state: next });
	},
} as const;
