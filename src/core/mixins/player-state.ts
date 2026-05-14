import { AudioTrackState, BufferState, NetworkState, QualityState, VisibilityState } from '../../types';
import type { PlayerPhase } from '../../types';
import { runDispatchBefore } from '../../dispatch';
import type { BeforeDispatchOutcome } from '../../dispatch';
import { stateError } from '../../errors';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Narrow backend interfaces — local to this mixin
// ──────────────────────────────────────────────────────────────────────────

interface _BackendWithState { state?: () => string }
interface _BackendWithSetQuality { setQuality?: (idx: number | 'auto') => void }
interface _BackendWithSetAudioTrack { setAudioTrack?: (idx: number) => void }


// ──────────────────────────────────────────────────────────────────────────
// Backend shape — structural contract for the resolved backend handle.
// Declared here so callers can narrow via `_resolveBackend` / `_peekBackend`.
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


// ──────────────────────────────────────────────────────────────────────────
// Mixin: shared buffer / network / stream / visibility / quality / audioTrack
// state reads. Both NMMusicPlayer and NMVideoPlayer exhibit these identically.
// The per-library `_backend` is accessed via `_peekBackend` so this mixin is
// backend-agnostic and does not need to know whether it runs in a music or
// video context.
// ──────────────────────────────────────────────────────────────────────────

export const playerStateMethods = {
	_transitionPhase(this: Internals, next: PlayerPhase): void {
		const from = this._phase;
		if (from === next)
			return;
		this._phase = next;

		this.emit('phase', {
			from,
			to: next,
		});
	},

	_resolveBackend(this: Internals): BackendShape | undefined {
		if (typeof this.backend !== 'function') return undefined;
		const result = this.backend();
		return _isBackendShape(result) ? result : undefined;
	},

	_peekBackend(this: Internals): unknown {
		if (typeof this.backend !== 'function')
			return undefined;
		try {
			return this.backend();
		}
		catch { return undefined; }
	},

	_peekBackendTyped<S extends object>(this: Internals): S | undefined {
		return this._peekBackend() as S | undefined;
	},

	_assertReady(this: Internals): void {
		if (this._phase === 'idle') {
			throw stateError('core:player/not-ready', 'Player has not been setup() yet.');
		}
		if (this._phase === 'disposed' || this._phase === 'disposing') {
			throw stateError('core:player/disposed', 'Player has been disposed.');
		}
	},

	async _dispatchBefore<TData>(this: Internals, beforeEvent: string, data: TData): Promise<BeforeDispatchOutcome<TData>> {
		const timeoutMs = this.options?.beforeEventTimeoutMs;
		return runDispatchBefore<TData>(this, beforeEvent, data, timeoutMs !== undefined ? { timeoutMs } : undefined);
	},

	bufferState(this: Internals): BufferState {
		const backend = this._peekBackendTyped<_BackendWithState>();
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
		const backend = this._peekBackendTyped<_BackendWithState>();
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
		const backend = this._peekBackendTyped<_BackendWithSetQuality>();
		backend?.setQuality?.(target);
		this.emit('qualityState', { state: this._qualityState });
	},

	audioTrackState(this: Internals, idx?: number): AudioTrackState | void {
		if (idx === undefined)
			return this._audioTrackState;
		this._audioTrackState = AudioTrackState.MANUAL;
		const backend = this._peekBackendTyped<_BackendWithSetAudioTrack>();
		backend?.setAudioTrack?.(idx);
		this.emit('audioTrackState', { state: this._audioTrackState });
	},
} as const;
