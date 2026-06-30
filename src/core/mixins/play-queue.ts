// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { ActionOptions, BasePlaylistItem, LoadOptions } from '../../types';

import type { Internals } from '../state';

// ──────────────────────────────────────────────────────────────────────────
// Mixin: play-queue — race-free convenience helpers that sit above
// `item()` + `queue()` + `play()`.
//
// Root cause this kills: consumers writing
//   player.queue(items); player.item(start); player.play();
// race because item() fires a fire-and-forget load() internally and
// play() runs backend.play() → element.play() BEFORE the src is set.
//
// The safe primitive is item(target, { autoplay: true }) — it calls play()
// only inside the .then() of the resolved load(), never before. Both helpers
// here delegate exclusively to that path.
// ──────────────────────────────────────────────────────────────────────────

export const playQueueMethods = {
	/**
	 * Move the cursor to `target` (item reference, string id, numeric index,
	 * or a predicate) and start playback AFTER the item finishes loading.
	 *
	 * This is the race-free alternative to calling `item(target)` followed by
	 * a separate `play()`. Under the hood it routes through
	 * `item(target, { autoplay: true })`, which only fires `play()` inside the
	 * resolved `.then()` of the internal `load()` call — never before the
	 * backend has set `element.src`.
	 *
	 * `opts.source` is threaded through every emitted event so NoMercy Connect
	 * echo-prevention sees the correct origin and skips re-broadcasting its own
	 * remote-applied commands.
	 *
	 * `opts.startAt` passes a seek offset (seconds) straight to the `load()`
	 * pipeline so backends that support `startTime` (hls.js `startPosition`)
	 * fetch the first fragment at the offset instead of downloading from the
	 * beginning and seeking away.
	 */
	playItem(
		this: Internals,
		target: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean),
		opts?: LoadOptions,
	): void {
		this.item(target, {
			...opts,
			autoplay: true,
		});
	},

	/**
	 * Replace the entire queue with `items` and begin playing from `start`.
	 *
	 * When `start` is omitted the first item in `items` is played. `start`
	 * accepts the same target union as `item()`: an item reference, a string
	 * id, a numeric index, or a predicate — so callers can pass either a
	 * pre-queued item object or its id without re-finding the index themselves.
	 *
	 * `opts.source` and `opts.startAt` thread through in the same way as
	 * `playItem()` — see its doc for details.
	 *
	 * Does NOT stop or unload the currently-playing item before replacing the
	 * queue; the underlying `item()` call interrupts it when `load()` fires.
	 * Call `stop()` first when a clean teardown before the transition matters.
	 *
	 * Silently no-ops when `items` is empty (no queue, no cursor movement).
	 */
	playNow(
		this: Internals,
		items: BasePlaylistItem[],
		start?: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean),
		opts?: LoadOptions,
	): void {
		if (items.length === 0)
			return;

		this.queue(items, opts as ActionOptions);

		const target = start ?? items[0];
		this.item(target as BasePlaylistItem | string | number, {
			...opts,
			autoplay: true,
		});
	},
} as const;
