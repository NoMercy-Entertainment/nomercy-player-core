import { browserPolicyError } from '../../errors';
import { CastState as _CastStateEnum } from '../../types';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Private helpers — only used by castMethods
// ──────────────────────────────────────────────────────────────────────────

interface _CastGlobal {
	cast: { framework: { CastContext: { getInstance: () => { requestSession: () => Promise<unknown> } } } };
}

/** Probe whether the Cast Web Sender SDK is loaded on the page. */
function _isCastAvailable(): boolean {
	// Cast Web Sender SDK not in standard DOM types — probe via `in`.
	return typeof globalThis !== 'undefined' && 'cast' in globalThis;
}

/** Probe whether AirPlay is available (WebKit-only, on a video element). */
function _isAirPlayAvailable(): boolean {
	// WebKitPlaybackTargetAvailabilityEvent not in standard DOM types — probe via `in`.
	return typeof window !== 'undefined' && 'WebKitPlaybackTargetAvailabilityEvent' in window;
}

/** Probe whether the W3C RemotePlayback API is available. */
function _isRemotePlaybackAvailable(): boolean {
	// RemotePlayback not yet in standard TS DOM lib — probe via `in`.
	const proto: unknown = typeof window !== 'undefined' ? window.HTMLMediaElement?.prototype : undefined;
	return proto !== undefined && typeof proto === 'object' && proto !== null && 'remote' in proto;
}


// ──────────────────────────────────────────────────────────────────────────
// Mixin: cast / handoff — `castState`, `transferTo`.
// ──────────────────────────────────────────────────────────────────────────

export const castMethods = {
	/**
	 * Coarse handoff state. Returns the status of the most recently active
	 * remote-playback target. With no Cast/AirPlay/RemotePlayback APIs
	 * available, returns `'unavailable'`.
	 */
	castState(this: Internals): _CastStateEnum {
		if (this._castState !== undefined)
			return this._castState;
		if (_isCastAvailable() || _isAirPlayAvailable() || _isRemotePlaybackAvailable()) {
			return _CastStateEnum.AVAILABLE;
		}
		return _CastStateEnum.UNAVAILABLE;
	},
	/**
	 * Initiate handoff to a remote target. Throws structured `BrowserPolicyError`
	 * when the target's API is unavailable in the current environment so
	 * consumers can surface a "device not supported" UI message instead of
	 * falling through to an opaque error.
	 */
	async transferTo(this: Internals, target: 'cast' | 'airplay' | 'remote-playback' | 'local'): Promise<void> {
		const setState = (s: _CastStateEnum): void => {
			this._castState = s;
			this.emit('castState', { state: s });
		};

		switch (target) {
			case 'cast': {
				if (!_isCastAvailable()) {
					throw browserPolicyError('core:policy/castUnavailable', 'Cast Web Sender SDK not loaded. Add `<script src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1"></script>` to enable Cast.');
				}
				setState(_CastStateEnum.CONNECTING);
				try {
					const castGlobal = globalThis as unknown as _CastGlobal;
					await castGlobal.cast.framework.CastContext.getInstance().requestSession();
					setState(_CastStateEnum.CONNECTED);
				}
				catch (err) {
					setState(_CastStateEnum.AVAILABLE);
					throw err;
				}
				return;
			}
			case 'airplay': {
				if (!_isAirPlayAvailable()) {
					throw browserPolicyError('core:policy/airplayUnavailable', 'AirPlay is WebKit-only (Safari, iOS).');
				}
				// AirPlay handoff requires the consumer to call
				// `videoElement.webkitShowPlaybackTargetPicker()` directly
				// because Safari binds the picker to user-gesture events.
				// Mark the state as connecting; consumer wires the picker.
				setState(_CastStateEnum.CONNECTING);
				if (this.videoElement?.webkitShowPlaybackTargetPicker) {
					this.videoElement.webkitShowPlaybackTargetPicker();
				}
				return;
			}
			case 'remote-playback': {
				if (!_isRemotePlaybackAvailable()) {
					throw browserPolicyError('core:policy/remotePlaybackUnavailable', 'RemotePlayback API not supported in this browser.');
				}
				const video = this.videoElement;
				if (!video?.remote) {
					throw browserPolicyError('core:policy/remotePlaybackUnavailable', 'No video element bound to player.');
				}
				setState(_CastStateEnum.CONNECTING);
				try {
					await video.remote.prompt();
					setState(_CastStateEnum.CONNECTED);
				}
				catch (err) {
					setState(_CastStateEnum.AVAILABLE);
					throw err;
				}
				return;
			}
			case 'local': {
				// Tear down any active remote session.
				setState(_CastStateEnum.DISCONNECTED);
				return;
			}
			default:
				throw browserPolicyError('core:policy/transferTargetUnknown', `Unknown transfer target: ${target}`);
		}
	},
} as const;
