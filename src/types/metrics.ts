// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Performance metrics tracked automatically by the player. Snapshotted via
 * `player.metrics()`; emitted periodically via the `playback:metrics` event.
 * All timing values are in milliseconds unless noted otherwise.
 *
 * Backend availability matrix:
 *
 * | Counter        | html5VideoBackend        | html5AudioBackend |
 * |----------------|--------------------------|-------------------|
 * | ttfb           | null (not wired)         | null              |
 * | ttff           | number (firstFrame event)| number            |
 * | rebufferRatio  | number (backend:waiting) | number            |
 * | avgBitrate     | null (not wired)         | null              |
 * | droppedFrames  | number (getVideoPlaybackQuality) | null      |
 * | decoderStalls  | null (not wired)         | null              |
 * | joinTime       | number (firstFrame event)| number            |
 * | sessionDurationMs | number (timer)        | number            |
 *
 * `null` means the counter is structurally unavailable from the current
 * backend. Consumers must guard: `if (metrics.droppedFrames !== null) { ... }`.
 * The extension slot `[customMetric]` always holds `number` (plugins write real values).
 *
 * The index signature `[customMetric: string]: number | null` lets plugins
 * publish their own numeric counters under a namespaced key.
 */
export interface PlaybackMetrics {
	/**
	 * Time-to-first-byte: ms from `load()` to the first network response byte.
	 * `null` — no backend currently reports this; reserved for a future
	 * HLS/DASH segment-timing probe.
	 */
	ttfb: number | null;
	/** Time-to-first-frame: ms from `play()` to the `firstFrame` event. */
	ttff: number;
	/** Ratio of stalled time to total playback time (0–1). */
	rebufferRatio: number;
	/**
	 * Average received bitrate over the session (bits per second).
	 * `null` — no backend currently reports this; reserved for HLS level-change
	 * tracking in a future instrumentation pass.
	 */
	avgBitrate: number | null;
	/**
	 * Cumulative dropped video frames reported by `HTMLVideoElement.getVideoPlaybackQuality()`.
	 * `null` on audio-only backends where no video element exists.
	 */
	droppedFrames: number | null;
	/**
	 * Number of times the decoder stalled waiting for data.
	 * `null` — no backend currently reports this; reserved for future MSE
	 * `QueuingStrategy` instrumentation.
	 */
	decoderStalls: number | null;
	/** ms from page load to the first `play()` call (session join latency). */
	joinTime: number;
	/** Total active playback time in this session (ms). */
	sessionDurationMs: number;
	/** Extension slot — plugins add namespaced numeric counters here. */
	[customMetric: string]: number | null;
}
