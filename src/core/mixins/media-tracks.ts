import type { ActionOptions, AudioTrack, BasePlaylistItem, Chapter, CurrentAudioTrackSelection, CurrentQualitySelection, CurrentSubtitleSelection, QualityLevel, SubtitleCue as SubtitleCuePayload, SubtitleStyle, SubtitleTrack } from '../../types';
import { AudioTrackState, QualityState } from '../../types';
import { CueTracker } from '../../cues/tracker';
import { parseVttSubtitles, parseVtt } from '../../adapters/cue-parser/vtt';
import type { VTTSubtitlePayload } from '../../adapters/cue-parser/vtt';
import type { Cue } from '../../cues/cue';
import { buildResolvedUrl } from '../resolved-url';

import type { Internals, SidecarSubtitleContext } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Sidecar track types — structural interfaces for item track fields.
// Items carry inline tracks under `tracks: [{ kind, file, language, ... }]`.
// ──────────────────────────────────────────────────────────────────────────

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

/** Narrows an item to one carrying a non-empty `tracks` array. Items with an
 *  empty array or no field at all fall through to the no-tracks path. */
function hasTracksField(item: BasePlaylistItem): item is ItemWithDefinedTracks {
	return 'tracks' in item 
		&& Array.isArray((item as ItemWithTracks).tracks) 
		&& (item as ItemWithTracks).tracks!.length > 0;
}

/**
 * Fetch a sidecar VTT chapter file and convert its cues into the kit's
 * `Chapter[]` shape. Network or parse failures resolve to an empty list —
 * chapters are an enhancement; a failed fetch should never prevent playback.
 */
async function fetchChaptersVtt(url: string): Promise<Chapter[]> {
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


// ──────────────────────────────────────────────────────────────────────────
// Narrow backend interfaces — local to this mixin
// ──────────────────────────────────────────────────────────────────────────

interface _BackendWithSubtitleTracks {
	setSubtitleTrack?: (idx: number | null) => void;
	subtitleTracks?: () => SubtitleTrack[];
}
interface _BackendWithAudioTrack { setAudioTrack?: (idx: number) => void }
interface _BackendWithQualityLevels { qualityLevels?: (opts?: { includeUnsupported?: true }) => QualityLevel[] }
interface _BackendWithSetQualityLevel { setQuality?: (idx: number | 'auto') => void }
interface _BackendWithAudioTracks { audioTracks?: () => AudioTrack[] }


// ──────────────────────────────────────────────────────────────────────────
// Sidecar VTT helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Find the sidecar subtitle track at a given (sidecar-list-relative) index on
 * the active playlist item. Returns the minimal info `_startSidecarSubtitle`
 * needs to fetch + parse the VTT; `undefined` when no item is active or the
 * index is out of range.
 */
function _resolveSidecarSubtitle(
	self: Internals,
	sidecarIdx: number,
): { url?: string; language?: string; label?: string; type?: string } | undefined {
	const rawCur = self.current?.();
	const cur: ItemWithDefinedTracks | undefined = rawCur && hasTracksField(rawCur) ? rawCur : undefined;
	const list = (cur?.tracks ?? []).filter((sidecarTrack: SidecarTrack) => sidecarTrack.kind === 'subtitles');
	const sidecarTrack = list[sidecarIdx];
	if (!sidecarTrack) return undefined;
	return {
		url: sidecarTrack.file,
		language: sidecarTrack.language,
		label: sidecarTrack.label,
		type: sidecarTrack.type,
	};
}

/**
 * Fetch + parse a sidecar VTT and start a `CueTracker` whose `enter` /
 * `exit` events feed the player-level `subtitleCue` channel. Active cue
 * set is mirrored locally so each event carries the full simultaneous
 * cue list (matches the backend's `subtitleCue` shape — every renderer
 * sees one stream regardless of source).
 */
async function _startSidecarSubtitle(
	self: Internals,
	track: { url?: string; language?: string },
): Promise<void> {
	if (!track.url) return;

	let raw: string;
	try {
		const r = await fetch(track.url);
		if (!r.ok) {
			self.emit('subtitleCue', {
				cues: [],
				language: track.language,
			});
			return;
		}
		raw = await r.text();
	}
	catch {
		self.emit('subtitleCue', {
			cues: [],
			language: track.language,
		});
		return;
	}

	// User may have switched tracks mid-fetch; bail if the slot was
	// (re)populated by a later `currentSubtitle` while we were waiting.
	if (self._sidecarSubtitle) return;

	const cueList = parseVttSubtitles(raw);
	const tracker = new CueTracker<VTTSubtitlePayload>(cueList, { trackerId: 'subtitle-sidecar' });
	const ctx: SidecarSubtitleContext = {
		tracker,
		active: new Set<Cue<VTTSubtitlePayload>>(),
		language: track.language,
	};
	self._sidecarSubtitle = ctx;

	const emitChange = (): void => {
		const cues: SubtitleCuePayload[] = [...ctx.active].map(cue => _toSubtitleCue(cue.payload));
		self.emit('subtitleCue', {
			cues,
			language: ctx.language,
		});
	};

	tracker.on('enter', (cue) => {
		ctx.active.add(cue);
		emitChange();
	});
	tracker.on('exit', (cue) => {
		ctx.active.delete(cue);
		emitChange();
	});
	tracker.attach(self);
}

/**
 * Translate a parsed sidecar `VTTSubtitlePayload` into the unified
 * `SubtitleCue` event shape — same fields the backend emits for native
 * tracks. Renderers see a single payload type and never branch on origin.
 */
function _toSubtitleCue(p: VTTSubtitlePayload): SubtitleCuePayload {
	return {
		text: p.markup ?? p.text,
		plainText: p.text,
		line: p.linePosition,
		align: p.alignment ?? 'center',
		size: typeof p.size === 'number' ? p.size : 100,
	};
}


// ──────────────────────────────────────────────────────────────────────────
// Mixin: media tracks — subtitles / audio tracks / quality levels / chapters.
// Reads delegate to the active backend (when present); no-ops when the
// backend doesn't expose the surface (audio-only / pre-load). Setters emit
// the corresponding `subtitle` / `audioTrack` event so plugins (octopus,
// playlist UI, etc.) can react regardless of backend support.
// ──────────────────────────────────────────────────────────────────────────

export const mediaTracksMethods = {
	/**
	 * Tear down the active sidecar subtitle tracker (if any) and clear the
	 * `_sidecarSubtitle` slot. Called on `currentSubtitle(null)` or when
	 * switching tracks so the prior cue stream stops emitting.
	 */
	_disposeSidecarSubtitle(this: Internals): void {
		const ctx = this._sidecarSubtitle;
		if (!ctx) return;
		try { ctx.tracker.dispose(); }
		catch { /* defensive */ }
		this._sidecarSubtitle = undefined;
	},

	/**
	 * Resolve every relative sidecar track URL on an item against the
	 * configured `baseUrl` and `auth.transformUrl`. Items pass through
	 * unchanged when they carry no tracks.
	 *
	 * Also populates `chapters` from a sidecar `tracks: [{ kind: 'chapters',
	 * file }]` VTT when the item didn't ship inline chapters — handy for
	 * playlists that store chapter data alongside subtitles instead of
	 * inlining the markers.
	 */
	async resolveItemTrackUrls<T extends BasePlaylistItem>(this: Internals, item: T): Promise<T> {
		if (!hasTracksField(item)) return item;

		const transformer = this._authConfig?.transformUrl;
		const base = this._baseUrl;

		const resolved = await Promise.all(
			item.tracks.map(async (sidecarTrack: SidecarTrack): Promise<SidecarTrack> => {
				if (!sidecarTrack.file) return sidecarTrack;
				const transformed = transformer ? await transformer(sidecarTrack.file) : sidecarTrack.file;
				return { ...sidecarTrack, file: buildResolvedUrl(sidecarTrack.file, transformed, base).href };
			}),
		);

		const withTracks: T & ItemWithTracks = { ...item, tracks: resolved };

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
	},

	/**
	 * Resolve chapters for the given item (fetching sidecar VTT when needed),
	 * write the resolved chapters back onto the queue entry, and emit
	 * `chapters`. Guarded by a monotonic `_chapterEpoch` so a slow fetch
	 * for the previous cursor change can't overwrite the active item's
	 * chapters when it finally lands.
	 */
	async _resolveAndEmitChapters(this: Internals, itemId: string | number | undefined): Promise<void> {
		const epoch = (this._chapterEpoch ?? 0) + 1;
		this._chapterEpoch = epoch;
		const isLatest = (): boolean => this._chapterEpoch === epoch;

		const foundItem = this._queueList.get().find(queued => queued.id === itemId);
		if (!foundItem) return;
		const item = foundItem as ItemWithTracks;

		if (Array.isArray(item.chapters) && item.chapters.length > 0) {
			this.emit('chapters', { chapters: item.chapters });
			return;
		}

		const resolved = await this.resolveItemTrackUrls(item);

		if (!isLatest()) return;

		const chapters = resolved.chapters;
		if (!Array.isArray(chapters) || chapters.length === 0) return;

		this._queueList.replaceItem(resolved);

		this.emit('chapters', { chapters });
	},

	/**
	 * The full subtitle track list — backend-managed tracks first, sidecar
	 * VTT tracks appended after. Consumers render one flat list and use the
	 * returned index with `currentSubtitle(idx)` regardless of origin.
	 *
	 * Backend-managed tracks come from HLS-in-manifest text tracks (via the
	 * active backend's `subtitleTracks()`). Sidecar tracks come from the
	 * active playlist item's `tracks: [{ kind: 'subtitles', ... }]`. Sidecar
	 * entries with no `file` URL are dropped — they couldn't load anyway.
	 *
	 * Returns an empty list before a backend is mounted or when no item is
	 * active.
	 */
	subtitles(this: Internals): ReadonlyArray<SubtitleTrack> {
		const fromBackend: SubtitleTrack[] = (() => {
			const backend = this._peekBackendTyped<_BackendWithSubtitleTracks>();
			if (typeof backend?.subtitleTracks === 'function') {
				try {
					return backend.subtitleTracks() ?? [];
				}
				catch { return []; }
			}
			return [];
		})();

		const fromItem: SubtitleTrack[] = (() => {
			const rawCur = this.current?.();
			const cur: ItemWithDefinedTracks | undefined = rawCur && hasTracksField(rawCur) ? rawCur : undefined;
			const tracks = cur?.tracks ?? [];
			return tracks
				.filter((sidecarTrack): sidecarTrack is SidecarTrack & { file: string } =>
					sidecarTrack?.kind === 'subtitles' && typeof sidecarTrack.file === 'string' && sidecarTrack.file.length > 0,
				)
				.map((sidecarTrack, idx): SubtitleTrack => ({
					id: sidecarTrack.id ?? `subtitle-sidecar-${idx}`,
					language: sidecarTrack.language,
					label: sidecarTrack.label ?? sidecarTrack.language ?? `Subtitle ${idx + 1}`,
					kind: 'subtitles',
					type: sidecarTrack.type,
					url: sidecarTrack.file,
					default: false,
				}));
		})();

		// Backend tracks first so their array positions match the indexes
		// `currentSubtitle(idx)` writes to `hls.subtitleTrack`; sidecars trail.
		return [...fromBackend, ...fromItem];
	},

	/**
	 * Read or write the active subtitle track.
	 *
	 * `currentSubtitle()` — returns `{ index, track }` for the currently-selected
	 * subtitle track, or `null` when subtitles are off.
	 *
	 * `currentSubtitle(idx)` — select subtitle track at `idx`. Pass `null`
	 * (or a negative number) to disable subtitles. Fires the `subtitle` event
	 * with `{ track: idx | null }`.
	 */
	currentSubtitle(this: Internals, idx?: number | null): CurrentSubtitleSelection | null | void {
		if (idx === undefined) {
			const storedIdx = this._currentSubtitleIdx;
			if (storedIdx === null) return null;
			const trackList = mediaTracksMethods.subtitles.call(this);
			const track = trackList[storedIdx];
			if (!track) return null;
			return { index: storedIdx, track };
		}

		// Tear down any in-flight sidecar tracker first; switching tracks
		// (or to null) must release the prior cue stream so it doesn't
		// keep emitting active cues from the old track.
		this._disposeSidecarSubtitle();

		const b = this._peekBackendTyped<_BackendWithSubtitleTracks>();
		const backendCount = (typeof b?.subtitleTracks === 'function')
			? (b.subtitleTracks() ?? []).length
			: 0;

		// "Off" — clear backend selection AND emit an empty cue list so
		// renderers wipe their overlays.
		if (idx === null || idx < 0) {
			this._currentSubtitleIdx = null;
			b?.setSubtitleTrack?.(null);
			this.emit('subtitle', { track: null });
			this.emit('subtitleCue', {
				cues: [],
				language: undefined,
			});
			return;
		}

		// Backend-managed: index falls within the backend's track count.
		// Backend will emit `subtitleCue` itself via its cuechange hook.
		if (idx < backendCount) {
			this._currentSubtitleIdx = idx;
			b?.setSubtitleTrack?.(idx);
			this.emit('subtitle', { track: idx });
			return;
		}

		// Sidecar VTT: index past the backend's tracks points into the
		// active item's `tracks: [{ kind: 'subtitles', file, language }]`.
		// Disable any backend track first so the two streams don't both
		// fire `subtitleCue`.
		this._currentSubtitleIdx = idx;
		b?.setSubtitleTrack?.(null);
		const sidecar = _resolveSidecarSubtitle(this, idx - backendCount);
		this.emit('subtitle', { track: idx });
		if (!sidecar?.url) {
			this.emit('subtitleCue', {
				cues: [],
				language: undefined,
			});
			return;
		}
		void _startSidecarSubtitle(this, sidecar);
	},

	/**
	 * Read or write the subtitle style. Settings menus and overlay plugins
	 * talk through this one surface so they never have to maintain their own
	 * ad-hoc cache.
	 *
	 * Reading: `player.subtitleStyle()` → full current style.
	 * Writing: `player.subtitleStyle({ fontSize: 120 })` merges the patch
	 * onto the active style and emits `subtitleStyle` with the merged result
	 * so subscribers (overlay renderer, settings menu subtext, etc.) react.
	 */
	subtitleStyle(this: Internals, patch?: Partial<SubtitleStyle>): SubtitleStyle | void {
		// Lazily seed defaults the first time this is read so menus pre-populate
		// with sensible values without the consumer wiring an init step.
		const seed = (): SubtitleStyle => ({
			fontSize: 100,
			fontFamily: 'ReithSans, sans-serif',
			textColor: 'white',
			textOpacity: 100,
			backgroundColor: 'black',
			backgroundOpacity: 0,
			edgeStyle: 'textShadow',
			areaColor: 'black',
			windowOpacity: 0,
		});

		if (!this._subtitleStyle) this._subtitleStyle = seed();

		if (patch === undefined) return { ...this._subtitleStyle };

		this._subtitleStyle = { ...this._subtitleStyle, ...patch };
		this.emit('subtitleStyle', { ...this._subtitleStyle });
		return undefined;
	},

	/**
	 * The active backend's audio tracks. Returns an empty list when no
	 * backend is mounted or the backend doesn't expose multi-track audio
	 * (audio-only, single-track sources). Use the returned indexes with
	 * `currentAudioTrack(idx)`.
	 */
	audioTracks(this: Internals): ReadonlyArray<AudioTrack> {
		const backend = this._peekBackendTyped<_BackendWithAudioTracks>();
		if (typeof backend?.audioTracks === 'function') {
			try {
				return backend.audioTracks() ?? [];
			}
			catch { return []; }
		}
		return [];
	},

	/**
	 * Read or write the active audio track.
	 *
	 * `currentAudioTrack()` — returns `{ index, track }` for the currently-selected
	 * audio track, or `null` when no explicit selection has been made.
	 *
	 * `currentAudioTrack(idx)` — select the audio track at `idx`. Fires the
	 * `audioTrack` event with `{ id: idx }`.
	 */
	currentAudioTrack(this: Internals, idx?: number): CurrentAudioTrackSelection | null | void {
		if (idx === undefined) {
			const storedIdx = this._currentAudioTrackIdx;
			if (storedIdx === null) return null;
			const trackList = mediaTracksMethods.audioTracks.call(this);
			const track = trackList[storedIdx];
			if (!track) return null;
			return { index: storedIdx, track };
		}

		this._currentAudioTrackIdx = idx;

		// Keep the audio-track-state token in sync so audioTrackState() always
		// reflects that a manual selection is active.
		this._audioTrackState = AudioTrackState.MANUAL;
		this.emit('audioTrackState', { state: this._audioTrackState });

		const backend = this._peekBackendTyped<_BackendWithAudioTrack>();
		if (typeof backend?.setAudioTrack === 'function') {
			backend.setAudioTrack(idx);
		}
		this.emit('audioTrack', { id: idx });
	},

	/**
	 * The active backend's quality levels. Returns an empty list for
	 * single-rendition sources (no ABR) or when no backend is mounted.
	 *
	 * `opts.includeUnsupported: true` returns every level the manifest
	 * declares, with each entry's `supported` flag set by the codec capability
	 * probe. The default filters to supported levels only so consumers don't
	 * have to.
	 */
	qualityLevels(this: Internals, opts?: { includeUnsupported?: true }): ReadonlyArray<QualityLevel> {
		const backend = this._peekBackendTyped<_BackendWithQualityLevels>();
		if (typeof backend?.qualityLevels === 'function') {
			try {
				return backend.qualityLevels(opts) ?? [];
			}
			catch { return []; }
		}
		return [];
	},

	/**
	 * Read or write the active quality level.
	 *
	 * `currentQuality()` — returns `{ index, track }` for the currently-selected
	 * quality level, or `'auto'` when adaptive bitrate selection is active.
	 *
	 * `currentQuality(idx)` — lock to a specific quality level. Pass
	 * `'auto'` to restore adaptive selection.
	 */
	currentQuality(this: Internals, idx?: number | 'auto'): CurrentQualitySelection | 'auto' | void {
		if (idx === undefined) {
			const storedIdx = this._currentQualityIdx;
			if (storedIdx === 'auto') return 'auto';
			const levelList = mediaTracksMethods.qualityLevels.call(this);
			const track = levelList[storedIdx];
			if (!track) return 'auto';
			return { index: storedIdx, track };
		}

		this._currentQualityIdx = idx;

		// Keep the quality-state token in sync so qualityState() always reflects
		// whether manual or auto selection is active.
		this._qualityState = idx === 'auto' ? QualityState.AUTO : QualityState.MANUAL;
		this.emit('qualityState', { state: this._qualityState });

		const backend = this._peekBackendTyped<_BackendWithSetQualityLevel>();
		if (typeof backend?.setQuality === 'function') {
			backend.setQuality(idx);
		}
		// No HLS variants on audio backend — no-op.
	},

	/**
	 * Chapters for the active playlist item. Items carry inline `chapters` once
	 * the kit resolves the sidecar VTT (during `load()` or on cursor change).
	 * Returns `[]` until the async fetch settles — subscribe to the `chapters`
	 * event for the ready signal.
	 */
	chapters(this: Internals): ReadonlyArray<Chapter> {
		const rawCurrent = this.current?.();
		const current: ItemWithDefinedTracks | undefined = rawCurrent && hasTracksField(rawCurrent) ? rawCurrent : undefined;
		return current?.chapters ?? [];
	},

	/**
	 * Seek to the start of the chapter at `idx`. Out-of-range indexes no-op.
	 * Emits `chapter` with the resolved index and title after the seek is
	 * dispatched. The underlying `currentTime` call is fire-and-forget — its
	 * `seeked` event fires on the correct path regardless of any wired
	 * `beforeSeek` handler.
	 */
	seekToChapter(this: Internals, idx: number, opts?: ActionOptions): void {
		const list = this.chapters();
		const chapter = list[idx];
		if (!chapter)
			return;

		const ret = this.currentTime(chapter.start, opts);
		if (ret instanceof Promise)
			void ret;

		this.emit('chapter', {
			index: idx,
			title: chapter.title,
		});
	},

	/**
	 * Seek to the chapter immediately after the current playback time. No-op
	 * when the chapter list is empty or playback is already in/after the last
	 * chapter.
	 */
	nextChapter(this: Internals, opts?: ActionOptions): void {
		const list = this.chapters();
		if (list.length === 0)
			return;

		const t = this._internalCurrentTime;
		const nextIdx = list.findIndex(c => c.start > t);
		if (nextIdx < 0)
			return;

		this.seekToChapter(nextIdx, opts);
	},

	/**
	 * Seek to the previous chapter. UX rule: if more than 10 seconds into the
	 * current chapter, jumps to that chapter's start instead of the previous
	 * one (the common "restart this chapter" behaviour of media remotes).
	 * No-op when the chapter list is empty or before the first chapter.
	 */
	previousChapter(this: Internals, opts?: ActionOptions): void {
		const list = this.chapters();
		if (list.length === 0)
			return;

		const t = this._internalCurrentTime;
		let currentIdx = -1;
		for (let i = list.length - 1; i >= 0; i--) {
			if (list[i]!.start <= t) { currentIdx = i; break; }
		}
		if (currentIdx < 0)
			return;

		const intoChapter = t - list[currentIdx]!.start;
		const targetIdx = (intoChapter > 10 || currentIdx === 0) ? currentIdx : currentIdx - 1;
		this.seekToChapter(targetIdx, opts);
	},

	/**
	 * Read or seek by chapter.
	 *
	 * `currentChapter()` — returns the `Chapter` whose time range contains
	 * `currentTime`, or `null` when no chapter is active (before the first,
	 * between chapters, or the chapter list is empty).
	 *
	 * `currentChapter(idx)` — jump to the chapter at `idx` (same as
	 * `seekToChapter(idx)`). No-op when `idx` is out of range.
	 */
	currentChapter(this: Internals, idx?: number): Chapter | null | void {
		if (idx === undefined) {
			const list = this.chapters();
			if (list.length === 0)
				return null;

			const t = this._internalCurrentTime;
			for (let i = list.length - 1; i >= 0; i--) {
				const ch = list[i]!;
				if (t >= ch.start && t < ch.end)
					return ch;
			}
			return null;
		}
		this.seekToChapter(idx);
	},
} as const;
