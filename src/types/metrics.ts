/**
 * Performance metrics tracked automatically by the player. Snapshotted via
 * `player.metrics()`; emitted periodically via the `playback:metrics` event.
 * All timing values are in milliseconds unless noted otherwise.
 *
 * The index signature `[customMetric: string]: number` lets plugins publish
 * their own numeric counters under a namespaced key without extending this
 * interface.
 */
export interface PlaybackMetrics {
	/** Time-to-first-byte: ms from `load()` to the first network response byte. */
	ttfb: number;
	/** Time-to-first-frame: ms from `play()` to the `firstFrame` event. */
	ttff: number;
	/** Ratio of stalled time to total playback time (0–1). */
	rebufferRatio: number;
	/** Average received bitrate over the session (bits per second). */
	avgBitrate: number;
	/** Cumulative dropped video frames reported by the backend. */
	droppedFrames: number;
	/** Number of times the decoder stalled waiting for data. */
	decoderStalls: number;
	/** ms from page load to the first `play()` call (session join latency). */
	joinTime: number;
	/** Total active playback time in this session (ms). */
	sessionDurationMs: number;
	/** Extension slot — plugins add namespaced numeric counters here. */
	[customMetric: string]: number;
}
