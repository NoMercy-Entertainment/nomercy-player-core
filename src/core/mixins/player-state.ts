import { AudioTrackState, BufferState, NetworkState, QualityState, VisibilityState } from '../../types';

import type { Internals } from '../state';
import { peekBackendTyped } from '../util/backend';


// ──────────────────────────────────────────────────────────────────────────
// Narrow backend interfaces — local to this mixin
// ──────────────────────────────────────────────────────────────────────────

interface _BackendWithState { state?: () => string }
interface _BackendWithSetQuality { setQuality?: (idx: number | 'auto') => void }
interface _BackendWithSetAudioTrack { setAudioTrack?: (idx: number) => void }


// ──────────────────────────────────────────────────────────────────────────
// Mixin: shared buffer / network / stream / visibility / quality / audioTrack
// state reads. Both NMMusicPlayer and NMVideoPlayer exhibit these identically.
// The per-library `_backend` is accessed via `_peekBackend` so this mixin is
// backend-agnostic and does not need to know whether it runs in a music or
// video context.
// ──────────────────────────────────────────────────────────────────────────

export const playerStateMethods = {
	bufferState(this: Internals): BufferState {
		const backend = peekBackendTyped<_BackendWithState>(this);
		switch (backend?.state?.()) {
			case 'loading': return BufferState.LOADING;
			case 'seeking': return BufferState.SEEKING;
			case 'stalled': return BufferState.STALLED;
			default: return BufferState.IDLE;
		}
	},

	networkState(this: Internals): NetworkState {
		const monitor = this._platform?.network;
		if (!monitor)
			return NetworkState.ONLINE;
		if (!monitor.isOnline())
			return NetworkState.OFFLINE;
		const downlink = monitor.downlinkMbps?.();
		if (typeof downlink === 'number' && downlink > 0 && downlink < 1.5)
			return NetworkState.SLOW;
		return NetworkState.ONLINE;
	},

	streamState(this: Internals): string {
		const backend = peekBackendTyped<_BackendWithState>(this);
		if (!backend)
			return 'idle';
		return backend.state?.() ?? 'idle';
	},

	visibilityState(this: Internals): VisibilityState {
		const visible = this._platform?.visibility?.isVisible() ?? true;
		return visible ? VisibilityState.VISIBLE : VisibilityState.HIDDEN;
	},

	qualityState(this: Internals, target?: number | 'auto'): QualityState | void {
		if (target === undefined)
			return this._qualityState;
		this._qualityState = target === 'auto' ? QualityState.AUTO : QualityState.MANUAL;
		const backend = peekBackendTyped<_BackendWithSetQuality>(this);
		backend?.setQuality?.(target);
		this.emit('qualityState', { state: this._qualityState });
	},

	audioTrackState(this: Internals, idx?: number): AudioTrackState | void {
		if (idx === undefined)
			return this._audioTrackState;
		this._audioTrackState = AudioTrackState.MANUAL;
		const backend = peekBackendTyped<_BackendWithSetAudioTrack>(this);
		backend?.setAudioTrack?.(idx);
		this.emit('audioTrackState', { state: this._audioTrackState });
	},
} as const;
