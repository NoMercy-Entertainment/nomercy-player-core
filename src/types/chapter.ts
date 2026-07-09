// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Chapter metadata for a single chapter in the active item's chapter list.
 * Chapters are populated from a sidecar WebVTT file or from embedded metadata;
 * the full list is available via `player.chapters()`.
 */
export interface Chapter {
	/** Zero-based chapter index in the chapter list. */
	index: number;
	/** Chapter start time (seconds). */
	start: number;
	/** Chapter end time (seconds). */
	end: number;
	/** Display name of the chapter. */
	title: string;
	/**
	 * `true` when the malformed-chapter safety net generated this entry to
	 * fill a gap the source list left uncovered. Absent (never `false`) on
	 * every chapter that came from the ingest source, so a plain truthy check
	 * is enough for a consumer to style fillers differently.
	 */
	synthetic?: boolean;
}
