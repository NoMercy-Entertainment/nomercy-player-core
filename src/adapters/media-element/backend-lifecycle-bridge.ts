// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { MinimalBackendEventPayload } from './MediaElementBackend';

/**
 * Minimal event-source contract `bridgeBackendPlayState` needs from a backend.
 * `IAudioBackend` and `IVideoBackend` both satisfy this structurally through
 * their own `on<E extends BackendEvent>(event, fn)` overload — no adapter
 * object is required at the call site.
 */
export interface BackendLifecycleSource<TPayload extends MinimalBackendEventPayload> {
	on: <K extends keyof TPayload>(event: K, fn: (data?: TPayload[K]) => void) => void;
}

/**
 * Callback + option surface for `bridgeBackendPlayState`. Every field mirrors
 * a hook a per-library player needs to translate raw backend lifecycle events
 * into its own `_playState` field and public `play` / `playing` / `pause`
 * events. The mechanical gating is shared here; state storage, the emitted
 * payload, and per-medium nuance stay with the caller.
 */
export interface BackendLifecycleBridgeOptions<TPayload extends MinimalBackendEventPayload> {
	/** Read the player's current "is playing" flag. */
	isPlaying: () => boolean;
	/** Write the player's "is playing" flag. */
	setPlaying: (playing: boolean) => void;
	/** Called once when the backend transitions from not-playing to playing. */
	onPlay: () => void;
	/**
	 * Called on every raw `play` backend event, regardless of whether the
	 * gated transition in `onPlay` fired. Covers per-medium logic that must
	 * observe every `play` event even when `_playState` was already
	 * `'playing'` (e.g. a phase transition racing a "load → wait → play"
	 * sequence where the state flip already happened earlier).
	 */
	onPlayEvent?: () => void;
	/** Called on every `playing` backend event (buffering resolved, media rendering). */
	onPlaying: () => void;
	/** Called once when the backend transitions from playing to not-playing. */
	onPause: () => void;
	/**
	 * Called on every reset event (see `resetEvents`), before the conditional
	 * pause transition below runs. Used to clear per-load flags such as a
	 * "first frame emitted" latch.
	 */
	onReset: () => void;
	/**
	 * Extra condition a `pause` event must satisfy, on top of "was playing",
	 * before the pause transition fires. Omit to always allow the transition.
	 * Video uses this to suppress the transition when the element already
	 * reached `ended` — browsers fire `pause` immediately before `ended` at
	 * natural playback completion, and without the guard that produces a
	 * spurious `pause` event right before `ended`.
	 */
	pauseGuard?: () => boolean;
	/**
	 * Backend events that reset "we're playing" state back to paused — a new
	 * source starting to load, or the current source being cleared. Defaults
	 * to `['loadstart']`.
	 */
	resetEvents?: ReadonlyArray<keyof TPayload>;
}

/**
 * Bridge a backend's `play` / `playing` / `pause` / reset lifecycle events
 * onto a player's own play-state field and public event surface.
 *
 * `NMVideoPlayer` and `NMMusicPlayer` each wired an almost-identical state
 * machine for this — same gating conditions, same field-mutation shape — that
 * had drifted into two independently-maintained copies. The mechanical
 * dispatch lives here; state storage, the emitted payload, and any real
 * per-medium nuance (`pauseGuard`, `resetEvents`, `onPlayEvent`) stay with the
 * caller so neither library's observable behaviour changes.
 */
export function bridgeBackendPlayState<TPayload extends MinimalBackendEventPayload>(
	backend: BackendLifecycleSource<TPayload>,
	options: BackendLifecycleBridgeOptions<TPayload>,
): void {
	backend.on('play', () => {
		if (!options.isPlaying()) {
			options.setPlaying(true);
			options.onPlay();
		}
		options.onPlayEvent?.();
	});

	backend.on('playing', () => {
		options.onPlaying();
	});

	backend.on('pause', () => {
		const guardPassed = options.pauseGuard ? options.pauseGuard() : true;
		if (options.isPlaying() && guardPassed) {
			options.setPlaying(false);
			options.onPause();
		}
	});

	const resetHandler = (): void => {
		options.onReset();
		if (options.isPlaying()) {
			options.setPlaying(false);
			options.onPause();
		}
	};

	const resetEvents: ReadonlyArray<keyof TPayload> = options.resetEvents ?? ['loadstart'];
	for (const event of resetEvents) {
		backend.on(event, resetHandler);
	}
}
