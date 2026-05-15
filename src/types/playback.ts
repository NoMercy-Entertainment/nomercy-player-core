/**
 * Aggregated time state snapshot returned by `player.timeData()`. All values
 * are in seconds; `percentage` is in the range [0, 100].
 */
export interface TimeState {
	/** Current playback position (seconds). */
	position: number;
	/** Total duration of the active item (seconds). `0` when unknown. */
	duration: number;
	/** How far ahead the buffer extends from the current position (seconds). */
	buffered: number;
	/** Seconds remaining until the end of the item. */
	remaining: number;
	/** Playback progress as a percentage of total duration (0–100). */
	percentage: number;
}
