import type { BasePlaylistItem, Chapter } from '../../types';
import { parseVtt } from '../../cues/parsers/vtt';
import { buildResolvedUrl } from '../../resolved-url';
import type { Internals } from '../state';


/**
 * Items can carry inline subtitle tracks under
 * `tracks: [{ kind: 'subtitles', file, language, label, type }]`. Players
 * extend `BasePlaylistItem` with the field, but the kit doesn't model
 * it directly — we read it through a narrowed interface so the helper
 * stays player-agnostic without resorting to `any`.
 */
export interface SidecarTrack {
	id?: string;
	kind?: string;
	file?: string;
	language?: string;
	label?: string;
	type?: string;
}

export interface ItemWithTracks extends BasePlaylistItem {
	tracks?: SidecarTrack[];
	chapters?: Chapter[];
}

export interface ItemWithDefinedTracks extends BasePlaylistItem {
	tracks: SidecarTrack[];
	chapters?: Chapter[];
}

export function hasTracksField(item: BasePlaylistItem): item is ItemWithDefinedTracks {
	return 'tracks' in item && Array.isArray((item as ItemWithTracks).tracks) && (item as ItemWithTracks).tracks!.length > 0;
}

export async function resolveItemTrackUrls<T extends BasePlaylistItem>(
	self: Internals,
	item: T,
): Promise<T> {
	if (!hasTracksField(item)) return item;

	const transformer = self._authConfig?.transformUrl;
	const base = self._baseUrl;

	const resolved = await Promise.all(
		item.tracks.map(async (sidecarTrack: SidecarTrack): Promise<SidecarTrack> => {
			if (!sidecarTrack.file) return sidecarTrack;
			const transformed = transformer ? await transformer(sidecarTrack.file) : sidecarTrack.file;
			return { ...sidecarTrack, file: buildResolvedUrl(sidecarTrack.file, transformed, base).href };
		}),
	);

	const withTracks: T & ItemWithTracks = { ...item, tracks: resolved };

	// If no inline chapters are present, try to populate them from a sidecar
	// `tracks[{ kind: 'chapters', file }]` VTT. Runs after URL resolution so
	// the file href is already absolute + auth-transformed.
	const existingChapters = withTracks.chapters;
	if (!Array.isArray(existingChapters) || existingChapters.length === 0) {
		const chapterTrack = resolved.find((sidecarTrack: SidecarTrack) => sidecarTrack.kind === 'chapters' && sidecarTrack.file);
		if (chapterTrack?.file) {
			const chapters = await fetchChaptersVtt(chapterTrack.file);
			if (chapters.length > 0) {
				return { ...withTracks, chapters };
			}
		}
	}

	return withTracks;
}

/** Fetch a WebVTT chapters file and convert its cues into `Chapter[]`. */
export async function fetchChaptersVtt(url: string): Promise<Chapter[]> {
	try {
		const r = await fetch(url);
		if (!r.ok) return [];
		const text = await r.text();
		return parseVtt(text).cues.map((cue, i) => ({
			index: i,
			start: cue.start,
			end: cue.end,
			title: cue.payload,
		}));
	}
	catch {
		return [];
	}
}

/**
 * Ensure the currently-selected item has its chapters populated, then emit
 * `'chapters'` so subscribers can repaint chapter markers.
 *
 * Called fire-and-forget from the `_wireQueue` cursor-change handler and
 * from `load()` after the cursor is moved. A monotonic `_chapterEpoch` field
 * on the player instance guards against stale completions when the user
 * switches items rapidly.
 */
export async function resolveAndEmitChapters(self: Internals, itemId: string | number | undefined): Promise<void> {
	const epoch = (self._chapterEpoch ?? 0) + 1;
	self._chapterEpoch = epoch;
	const isLatest = (): boolean => self._chapterEpoch === epoch;

	const foundItem = self._queueList.get().find(queued => queued.id === itemId);
	if (!foundItem) return;
	const item = foundItem as ItemWithTracks;

	if (Array.isArray(item.chapters) && item.chapters.length > 0) {
		// Already resolved — just announce.
		self.emit('chapters', { chapters: item.chapters });
		return;
	}

	const resolved = await resolveItemTrackUrls(self, item);

	if (!isLatest()) return;

	const chapters = resolved.chapters;
	if (!Array.isArray(chapters) || chapters.length === 0) return;

	self._queueList.replaceItem(resolved);

	self.emit('chapters', { chapters });
}
