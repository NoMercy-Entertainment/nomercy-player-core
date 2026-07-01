// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Coarse lifecycle readiness state for the player instance. Returned by
 * `player.setupState()`. Useful for guarding UI actions that require the
 * player to have completed its setup sequence.
 */
export enum SetupState {
	/** `setup()` has not been called yet. */
	NOT_SETUP = 'not-setup',
	/** `setup()` is in flight — config resolving, plugins registering. */
	SETTING_UP = 'setup',
	/** Setup completed — the player is ready to accept commands. */
	READY = 'ready',
	/** `dispose()` completed — the instance is permanently shut down. */
	DISPOSED = 'disposed',
}

/**
 * Buffer state derived from the active backend. Returned by
 * `player.bufferState()`. Transitions from `idle` → `loading` → back to
 * `idle` on normal playback; spikes to `seeking` on seek and `stalled` when
 * the network can't keep up.
 */
export enum BufferState {
	/** No active media or buffer is comfortably ahead. */
	IDLE = 'idle',
	/** Backend is fetching the initial segments. */
	LOADING = 'loading',
	/** A seek is in progress and the buffer is repositioning. */
	SEEKING = 'seeking',
	/** Playback stalled because the buffer ran dry. */
	STALLED = 'stalled',
}

/**
 * Network connectivity state. Returned by `player.networkState()`. Updated
 * by the network monitor registered during setup; `ONLINE` when no monitor
 * is configured.
 */
export enum NetworkState {
	/** Network is reachable and delivering acceptable bandwidth. */
	ONLINE = 'online',
	/** No network connectivity detected. */
	OFFLINE = 'offline',
	/** Network is reachable but downlink is below the slow-connection threshold (1.5 Mbps). */
	SLOW = 'slow',
}

/**
 * Tab / document visibility state. Returned by `player.visibilityState()`.
 * Updated by the `document.visibilitychange` listener; `VISIBLE` when no
 * visibility monitor is configured.
 */
export enum VisibilityState {
	/** The player's document tab is in the foreground. */
	VISIBLE = 'visible',
	/** The player's document tab is hidden or minimised. */
	HIDDEN = 'hidden',
}

/**
 * Quality / bitrate selection mode. Returned by `player.qualityMode()`.
 * Transitions from `AUTO` to `MANUAL` when the user or a plugin locks a
 * specific level; back to `AUTO` when they restore adaptive switching.
 */
export enum QualityState {
	/** Adaptive bitrate — the backend picks the best level automatically. */
	AUTO = 'auto',
	/** A specific quality level is locked by the consumer or a plugin. */
	MANUAL = 'manual',
}

/**
 * Audio track selection mode. Returned by `player.audioTrackMode()`.
 * Transitions from `DEFAULT` to `MANUAL` once the user or a plugin explicitly
 * selects a track.
 */
export enum AudioTrackState {
	/** The backend's default audio track is active (no explicit selection). */
	DEFAULT = 'default',
	/** A track was explicitly chosen — preference plugins persist this pick. */
	MANUAL = 'manual',
}

/**
 * Repeat mode. Returned by `player.repeatState()` and carried on the `repeat`
 * event. String values are identical to the v1 tokens so no runtime migration
 * is needed; only the type changes from a string union to a proper enum.
 *
 * - `OFF`  — no repeat.
 * - `ALL`  — loop the entire queue.
 * - `ONE`  — loop only the current item.
 */
export enum RepeatState {
	OFF = 'off',
	ALL = 'all',
	ONE = 'one',
}

/**
 * Shuffle mode. Returned by `player.shuffleState()` and carried on the
 * `shuffle` event.
 *
 * - `OFF` — linear playback order.
 * - `ON`  — randomised queue order.
 */
export enum ShuffleState {
	OFF = 'off',
	ON = 'on',
}

/**
 * Top-level playback lifecycle state. Returned by `player.playState()`.
 */
export enum PlayState {
	/** Player constructed; `load()` not yet called. */
	IDLE = 'idle',
	/** Item is being fetched / initialised by the backend. */
	LOADING = 'loading',
	/** Backend is actively advancing the clock. */
	PLAYING = 'playing',
	/** Playback is suspended; position held. */
	PAUSED = 'paused',
	/** Playback stopped; position may be reset. */
	STOPPED = 'stopped',
	/** Unrecoverable failure; consumer should surface a message. */
	ERROR = 'error',
}

/**
 * Volume gain stage. Returned by `player.volumeState()`.
 */
export enum VolumeState {
	/** Audio output is active (gain > 0). */
	UNMUTED = 'unmuted',
	/** Audio output is suppressed regardless of the volume level. */
	MUTED = 'muted',
}

/**
 * Cast / handoff state for the active Cast session. Returned by
 * `player.castState()` and carried on the `castState` event.
 */
export enum CastState {
	/** Cast is not available in this browser (SDK absent or no devices found). */
	UNAVAILABLE = 'unavailable',
	/** At least one Cast device is reachable; the user has not started a session. */
	AVAILABLE = 'available',
	/** A Cast session is being established. */
	CONNECTING = 'connecting',
	/** A Cast session is active and playback is delegated to the receiver. */
	CONNECTED = 'connected',
	/** A session was active but has ended (user disconnected, receiver lost, etc.). */
	DISCONNECTED = 'disconnected',
}
