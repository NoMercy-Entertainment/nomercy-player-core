// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Single subtitle cue, normalised across sources. Renderers consume this
 * shape regardless of whether the cue came from a native HLS/DASH text
 * track or a sidecar VTT.
 *
 * `text` keeps renderer-safe inline tags (`<i>`, `<b>`, `<u>`); pass it
 * through `buildSubtitleFragment` to produce a safe DOM tree.
 * `plainText` is the same content with every tag stripped — useful for
 * accessibility / debug overlays / DOM-less environments.
 */
export interface SubtitleCue {
	text: string;
	plainText: string;
	/** WebVTT `line:` setting (0–100 percent), or `undefined` for auto. */
	line?: number;
	/**
	 * WebVTT `align:` normalised to `start | center | end`. Legacy values
	 * `middle` / `left` / `right` are folded into the canonical three.
	 */
	align: 'start' | 'center' | 'end';
	/** WebVTT `size:` setting (0–100, percent of safe area). Defaults to 100. */
	size: number;
	/**
	 * WebVTT `position:` setting (0–100, percent). The horizontal anchor
	 * of the cue box — combined with `align` it determines where the box
	 * sits inside the safe area. `undefined` means "auto" (derived from
	 * `align` per the WebVTT spec).
	 */
	position?: number;
}

/** Payload for the `subtitleCue` event — the active cue list, or empty. */
export interface SubtitleCueChange {
	/** Active cues at this moment. Empty array means between cues or subtitles disabled. */
	cues: SubtitleCue[];
	/** Active track language (BCP-47), if known. */
	language?: string;
}

/**
 * Payload for the `cue:enter` and `cue:exit` events. Emitted by the player
 * when a `CueTracker` is attached to the active item and a timed cue crosses
 * its boundary.
 */
export interface CueEventPayload {
	/** The `CueTracker` instance that owns this cue. */
	trackerId: string;
	/** The cue that entered or exited, with its time range and arbitrary payload. */
	cue: { start: number; end: number; payload: unknown };
}
