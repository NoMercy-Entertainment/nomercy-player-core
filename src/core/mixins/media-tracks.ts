// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { VTTSubtitlePayload } from '../../adapters/cue-parser/vtt';
import type {
	ActionOptions,
	AudioTrack,
	BasePlaylistItem,
	Chapter,
	CurrentAudioTrackSelection,
	CurrentQualitySelection,
	CurrentSubtitleSelection,
	QualityLevel,
	SidecarSubtitleInput,
	SubtitleCue as SubtitleCuePayload,
	SubtitleStyle,
	SubtitleTrack,
} from '../../types';
import type { Cue } from '../cues/cue';
import type { Internals } from '../state';
import type {
	ItemWithDefinedTracks,
	ItemWithSidecarSubtitles,
	ItemWithTracks,
	SidecarTrack,
} from './sidecar-util';
import { parseVtt, parseVttSubtitles } from '../../adapters/cue-parser/vtt';
import { defaultIdGenerator } from '../../adapters/id-generator/default';
import { stateError } from '../../errors';
import { AudioTrackState, QualityState } from '../../types';

import { authFetch } from '../auth-fetch';
import { fillChapterGaps } from '../chapters/fill-gaps';

import { CueTracker } from '../cues/tracker';
import { buildResolvedUrl } from '../resolved-url';

import { hasSubtitlesField, hasTracksField, normalizeLanguage } from './sidecar-util';

/**
 * Runtime state for one active sidecar VTT subtitle track.
 *
 * Lives on `PlayerCoreState._sidecarSubtitle`. The `mediaTracksMethods` mixin
 * is the sole writer; the subtitle renderer reads `active` on each cue event.
 * Torn down and replaced whenever the track selection changes or the queue
 * moves to a new item.
 */
export interface SidecarSubtitleContext {
	tracker: CueTracker<VTTSubtitlePayload>;
	active: Set<Cue<VTTSubtitlePayload>>;
	language?: string;
}

/**
 * The media-tracks mixin's slice of player state — composed into
 * `PlayerCoreState`. Declared here, beside the methods that write these track
 * selections, the sidecar subtitle context, and the subtitle style cache.
 */
export interface MediaTracksState {
	/** Currently-selected subtitle index, or null when off. Written by `subtitle(idx)`. */
	_currentSubtitleIdx: number | null;

	/** Currently-selected audio track index, or null when no explicit selection. Written by `audioTrack(idx)`. */
	_currentAudioTrackIdx: number | null;

	/** Currently-selected quality index or 'auto'. Written by `quality(idx)`. */
	_currentQualityIdx: number | 'auto';

	/** Monotonic counter bumped on each `_resolveAndEmitChapters` call. Stale chapter fetches bail when epoch differs. */
	_chapterEpoch?: number;

	/** Active sidecar VTT subtitle context. One per player. Torn down on track change or item change. */
	_sidecarSubtitle?: SidecarSubtitleContext;

	/** Subtitle style patch cache. Seeded on first read; mutated by `subtitleStyle(patch)`. */
	_subtitleStyle?: SubtitleStyle;
}

export { hasTracksField, normalizeLanguage } from './sidecar-util';
export type { ItemWithDefinedTracks, ItemWithTracks, SidecarTrack } from './sidecar-util';

/**
 * Fetch a sidecar VTT chapter file and convert its cues into the kit's
 * `Chapter[]` shape. Network or parse failures resolve to an empty list —
 * chapters are an enhancement; a failed fetch should never prevent playback.
 */
async function fetchChaptersVtt(url: string, self: Internals): Promise<Chapter[]> {
	const ctrl = new AbortController();
	try {
		const text = await authFetch<string>({
			url,
			auth: self._authConfig,
			signal: ctrl.signal,
			responseType: 'text',
		});
		return parseVtt(text).cues.map((cue, index) => ({
			index,
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
 * the active playlist item. Indexes into the same deduped sidecar list that
 * `subtitles()` appends after the backend tracks, so `subtitle(idx)` and the
 * public track list can never disagree about which file an index means.
 * Returns the minimal info `_startSidecarSubtitle` needs to fetch + parse the
 * VTT; `undefined` when no item is active or the index is out of range.
 */
function _resolveSidecarSubtitle(
	self: Internals,
	sidecarIdx: number,
): { url?: string; language?: string; label?: string; type?: string } | undefined {
	const track = _dedupedSidecarSubtitles(self)[sidecarIdx];
	if (!track)
		return undefined;
	return {
		url: track.url,
		language: track.language,
		label: track.label,
		type: track.type,
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
	if (!track.url)
		return;

	const ctrl = new AbortController();
	let raw: string;
	try {
		raw = await authFetch<string>({
			url: track.url,
			auth: self._authConfig,
			signal: ctrl.signal,
			responseType: 'text',
		});
	}
	catch {
		ctrl.abort();
		self.emit('subtitleCue', {
			cues: [],
			language: track.language,
		});
		return;
	}

	// User may have switched tracks mid-fetch; bail if the slot was
	// (re)populated by a later `subtitle` while we were waiting.
	if (self._sidecarSubtitle)
		return;

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
function _toSubtitleCue(payload: VTTSubtitlePayload): SubtitleCuePayload {
	return {
		text: payload.markup ?? payload.text,
		plainText: payload.text,
		line: payload.linePosition,
		align: payload.alignment ?? 'center',
		size: typeof payload.size === 'number' ? payload.size : 100,
	};
}

/** Default subtitle style. Spread into `_subtitleStyle` on first read. */
const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
	fontSize: 100,
	fontFamily: 'ReithSans, sans-serif',
	textColor: 'white',
	textOpacity: 100,
	backgroundColor: 'black',
	backgroundOpacity: 0,
	edgeStyle: 'textShadow',
	areaColor: 'black',
	windowOpacity: 0,
};

/**
 * Return subtitle tracks reported by the active backend, or an empty list
 * when no backend is mounted or the backend does not expose the surface.
 */
function _backendSubtitleTracks(self: Internals): SubtitleTrack[] {
	const backend = self._peekBackendTyped<_BackendWithSubtitleTracks>();
	if (typeof backend?.subtitleTracks === 'function') {
		try {
			return backend.subtitleTracks() ?? [];
		}
		catch { return []; }
	}
	return [];
}

/**
 * Return sidecar subtitle tracks declared on the active playlist item.
 * Two shapes are read, typed field first: the canonical `subtitles:
 * [{ url, label, language, ... }]` (already in `SubtitleTrack` form), then
 * the v1/server wire format `tracks: [{ kind: 'subtitles', file, ... }]`.
 * Entries without a URL are dropped. Returns an empty list when no item is
 * active or the item declares no subtitle tracks.
 */
function _sidecarSubtitleTracks(self: Internals): SubtitleTrack[] {
	const rawCur = self.item?.();

	const typedField = (rawCur as { subtitles?: unknown } | undefined | null)?.subtitles;
	const fromTypedField: SubtitleTrack[] = (Array.isArray(typedField) ? typedField as Array<Partial<SubtitleTrack>> : [])
		.filter((track): track is Partial<SubtitleTrack> & { url: string } =>
			typeof track?.url === 'string' && track.url.length > 0)
		.map((track, idx): SubtitleTrack => ({
			id: track.id ?? `subtitle-item-${idx}`,
			language: track.language,
			label: track.label ?? track.language ?? `Subtitle ${idx + 1}`,
			kind: 'subtitles',
			type: track.type,
			url: track.url,
			default: track.default ?? false,
		}));

	const cur: ItemWithDefinedTracks | undefined = rawCur && hasTracksField(rawCur) ? rawCur : undefined;
	const tracks = cur?.tracks ?? [];
	const fromWireTracks = tracks
		.filter((sidecarTrack): sidecarTrack is SidecarTrack & { file: string } =>
			sidecarTrack?.kind === 'subtitles' && typeof sidecarTrack.file === 'string' && sidecarTrack.file.length > 0)
		.map((sidecarTrack, idx): SubtitleTrack => ({
			id: sidecarTrack.id ?? `subtitle-sidecar-${idx}`,
			language: sidecarTrack.language,
			label: sidecarTrack.label ?? sidecarTrack.language ?? `Subtitle ${idx + 1}`,
			kind: 'subtitles',
			type: sidecarTrack.type,
			url: sidecarTrack.file,
			default: false,
		}));

	return [...fromTypedField, ...fromWireTracks];
}

/**
 * Key used to compare tracks across sources. Language codes are normalised
 * to ISO 639-1 before building keys so that ISO 639-2/B ("ger"), 639-2/T
 * ("deu"), and 639-1 ("de") all compare equal.
 */
function _subtitleTrackKey(lang: string | undefined, kind: string | undefined): string {
	return `${normalizeLanguage(lang) ?? ''}:${kind ?? 'subtitles'}`;
}

/**
 * The backend-origin subtitle tracks exactly as `subtitles()` presents them:
 * the backend's tracks filtered to drop any displaced by a same-language +
 * kind sidecar. Shared by `subtitles()` and the `subtitle(idx)` setter so
 * their backend/sidecar boundary can NEVER diverge — the setter used to
 * compare `idx` against the backend's RAW `subtitleTracks().length` while the
 * list used this deduped count, desyncing every index whenever a backend
 * track was displaced (a sidecar VTT sharing language + kind with a
 * manifest-embedded track). One computation, two readers.
 */
function _dedupedBackendSubtitles(self: Internals): SubtitleTrack[] {
	const fromBackend = _backendSubtitleTracks(self);
	const dedupedSidecar = _dedupedSidecarSubtitles(self);
	const sidecarLangKeys = new Set<string>(
		dedupedSidecar.map(track => _subtitleTrackKey(track.language, track.kind)),
	);
	return fromBackend.filter(
		track => !sidecarLangKeys.has(_subtitleTrackKey(track.language, track.kind)),
	);
}

/**
 * Resolve a deduped backend-origin track back to its position in the
 * backend's own RAW `subtitleTracks()` array — the index `setSubtitleTrack`
 * actually expects (it maps to the Nth native text track / HLS rendition,
 * not to any position in the deduped, sidecar-merged list `subtitles()`
 * returns). Matched by `id` first — the stable identity a well-behaved
 * backend preserves across separate `subtitleTracks()` calls — falling back
 * to language + label + url for backends that hand back fresh objects each
 * call. Returns `-1` when no raw entry matches.
 */
function _rawBackendSubtitleIndex(rawTracks: ReadonlyArray<SubtitleTrack>, chosen: SubtitleTrack): number {
	if (chosen.id) {
		const byId = rawTracks.findIndex(track => track.id === chosen.id);
		if (byId >= 0)
			return byId;
	}
	return rawTracks.findIndex(track =>
		track.language === chosen.language
		&& track.label === chosen.label
		&& track.url === chosen.url);
}

/**
 * The item-declared subtitle list exactly as `subtitles()` appends it after
 * the backend tracks: URL-deduped only. Two sidecars sharing language + kind
 * but pointing at different files are distinct variants (e.g. `type: 'full'`
 * vs `type: 'sign'`) and both survive — collapsing them by language would
 * silently drop every variant after the first. `subtitle(idx)` resolves
 * sidecar-relative indexes through this same list.
 */
function _dedupedSidecarSubtitles(self: Internals): SubtitleTrack[] {
	const seenUrls = new Set<string>();
	return _sidecarSubtitleTracks(self).filter((track) => {
		if (seenUrls.has(track.url))
			return false;
		seenUrls.add(track.url);
		return true;
	});
}

/**
 * The raw typed `subtitles` field on an item, unreshaped — the append target
 * for `addSubtitleTrack()` and the removal target for `removeSubtitleTrack()`.
 * Returns `[]` when the item carries no such field yet.
 */
function _itemSidecarSubtitles(item: BasePlaylistItem): SubtitleTrack[] {
	return hasSubtitlesField(item) ? item.subtitles : [];
}

/**
 * Resolve `id` against the current merged `subtitles()` list and select it
 * through the existing `subtitle(idx)` path — reused by `addSubtitleTrack`'s
 * `default: true` branch so runtime-added tracks go through the same
 * cancellable `beforeSubtitle` cycle as any other selection. No-op when `id`
 * no longer resolves to an index (e.g. a concurrent removal).
 */
function _selectSidecarSubtitleById(self: Internals, id: string): void {
	const idx = mediaTracksMethods.subtitles.call(self).findIndex(track => track.id === id);
	if (idx >= 0)
		void self.subtitle(idx);
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
	 * `_sidecarSubtitle` slot. Called on `subtitle(null)` or when
	 * switching tracks so the prior cue stream stops emitting.
	 */
	_disposeSidecarSubtitle(this: Internals): void {
		const ctx = this._sidecarSubtitle;
		if (!ctx)
			return;
		try {
			ctx.tracker.dispose();
		}
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
		if (!hasTracksField(item))
			return item;

		const transformer = this._authConfig?.transformUrl;
		const base = this._baseUrl;

		const resolved = await Promise.all(
			item.tracks.map(async (sidecarTrack: SidecarTrack): Promise<SidecarTrack> => {
				if (!sidecarTrack.file)
					return sidecarTrack;
				const transformed = transformer ? await transformer(sidecarTrack.file) : sidecarTrack.file;
				return {
					...sidecarTrack,
					file: buildResolvedUrl(sidecarTrack.file, transformed, base).href,
				};
			}),
		);

		const withTracks: T & ItemWithTracks = {
			...item,
			tracks: resolved,
		};

		const existingChapters = withTracks.chapters;
		if (!Array.isArray(existingChapters) || existingChapters.length === 0) {
			const chapterTrack = resolved.find((sidecarTrack: SidecarTrack) => sidecarTrack.kind === 'chapters' && sidecarTrack.file);
			if (chapterTrack?.file) {
				const chapters = await fetchChaptersVtt(chapterTrack.file, this);
				if (chapters.length > 0) {
					return {
						...withTracks,
						chapters,
					};
				}
			}
		}

		return withTracks;
	},

	/**
	 * Resolve chapters for the given item (fetching sidecar VTT when needed),
	 * run the result through the malformed-chapter safety net
	 * (`_applyChapterGapFill`), write the normalized chapters back onto the
	 * queue entry, and emit `chapters`. Guarded by a monotonic `_chapterEpoch`
	 * so a slow fetch for the previous cursor change can't overwrite the
	 * active item's chapters when it finally lands.
	 */
	async _resolveAndEmitChapters(this: Internals, itemId: string | number | undefined): Promise<void> {
		const epoch = (this._chapterEpoch ?? 0) + 1;
		this._chapterEpoch = epoch;
		const isLatest = (): boolean => this._chapterEpoch === epoch;

		if (itemId === undefined)
			return;

		const foundItem = this._queueList.get().find(queued => queued.id === itemId);
		if (!foundItem)
			return;
		const item = foundItem as ItemWithTracks;

		if (Array.isArray(item.chapters) && item.chapters.length > 0) {
			this._applyChapterGapFill(itemId, item.chapters, { alwaysEmit: true });
			return;
		}

		const resolved = await this.resolveItemTrackUrls(item);

		if (!isLatest())
			return;

		const chapters = resolved.chapters;
		if (!Array.isArray(chapters) || chapters.length === 0)
			return;

		// Re-read the item fresh rather than writing back the snapshot this
		// function started with — another writer (e.g. `addSubtitleTrack`)
		// may have mutated the queue entry while this fetch was in flight.
		// Writing only `tracks` here (the field THIS step owns) avoids
		// clobbering that concurrent change; `_applyChapterGapFill` below
		// does its own fresh read before writing `chapters`.
		const latestItem = this._queueList.get().find(queued => queued.id === itemId) as ItemWithTracks | undefined;
		if (!latestItem)
			return;

		const merged: BasePlaylistItem & ItemWithTracks = {
			...latestItem,
			tracks: resolved.tracks,
		};
		this._queueList.replaceItem(merged);

		this._applyChapterGapFill(itemId, chapters, { alwaysEmit: true });
	},

	/**
	 * The single seam every chapter ingest path (inline item chapters,
	 * sidecar VTT, a runtime `chapters` write) and every consumer
	 * (`chapters()`, `chapter()`, `nextChapter()`, `seekToChapter()`, the
	 * `chapters` event, desktop-ui progress markers) funnels through. Runs
	 * `fillChapterGaps` against the player's live `duration()`, writes the
	 * result back onto the matching queue entry, and emits `chapters`.
	 *
	 * `opts.alwaysEmit: true` — emit whenever a non-empty list resolves,
	 * matching the "chapters just became available" contract used by
	 * `_resolveAndEmitChapters` on cursor change and sidecar fetch.
	 *
	 * `opts.alwaysEmit: false` — only write back + emit when gap-filling
	 * actually changed the list. Used by the `duration`-change re-application
	 * (`lifecycle.ts`) — chapters may already have been emitted once with the
	 * pre-duration raw list, so a duration tick that changes nothing must not
	 * spam a duplicate event.
	 */
	_applyChapterGapFill(this: Internals, itemId: string | number, chapters: ReadonlyArray<Chapter>, opts: { alwaysEmit: boolean }): void {
		const result = fillChapterGaps(chapters, this.duration(), () => this.t('core.chapters.untitled'));

		if (result.changed) {
			const latestItem = this._queueList.get().find(queued => queued.id === itemId) as ItemWithTracks | undefined;
			if (latestItem) {
				const merged: BasePlaylistItem & ItemWithTracks = {
					...latestItem,
					chapters: [...result.chapters],
				};
				this._queueList.replaceItem(merged);
			}
		}

		if (opts.alwaysEmit || result.changed) {
			this.emit('chapters', { chapters: result.chapters });
		}
	},

	/**
	 * The full subtitle track list — backend-managed tracks first, sidecar
	 * VTT tracks appended after. Consumers render one flat list and use the
	 * returned index with `subtitle(idx)` regardless of origin.
	 *
	 * Backend-managed tracks come from HLS-in-manifest text tracks (via the
	 * active backend's `subtitleTracks()`). Sidecar tracks come from the
	 * active playlist item — the typed `subtitles: [{ url, label, ... }]`
	 * field first, then the v1/server wire format
	 * `tracks: [{ kind: 'subtitles', file, ... }]`. Sidecar entries with no
	 * URL are dropped — they couldn't load anyway.
	 *
	 * De-duplication: when a backend track and a sidecar track share the same
	 * language + kind, the sidecar (consumer-supplied) wins. The backend entry
	 * is dropped and the sidecar takes its natural position in the trailing
	 * sidecar block. This means a deduped backend track's position in THIS
	 * list is not necessarily its position in the backend's own raw
	 * `subtitleTracks()` array — `subtitle(idx)` resolves through
	 * `_dedupedBackendSubtitles()` (the exact same computation this method
	 * uses) and remaps a backend-origin pick back to its raw backend index
	 * before calling `setSubtitleTrack`.
	 *
	 * Returns an empty list before a backend is mounted or when no item is
	 * active.
	 */
	subtitles(this: Internals): ReadonlyArray<SubtitleTrack> {
		return [..._dedupedBackendSubtitles(this), ..._dedupedSidecarSubtitles(this)];
	},

	/**
	 * Read or write the active subtitle track.
	 *
	 * `subtitle()` — returns `{ index, track }` for the currently-selected
	 * subtitle track, or `null` when subtitles are off.
	 *
	 * `subtitle(idx)` — dispatches `beforeSubtitle` with the requested index.
	 * A listener may `preventDefault()` to cancel, in which case
	 * `subtitlePrevented` fires and the selection is unchanged. Otherwise
	 * selects the subtitle track at `idx` (pass `null`, or a negative number,
	 * to disable subtitles) and fires the `subtitle` event with
	 * `{ track: idx | null }`. Returns a `Promise<void>` so callers can await
	 * the full cancellable cycle.
	 */
	subtitle(this: Internals, idx?: number | null): CurrentSubtitleSelection | null | Promise<void> {
		if (idx === undefined) {
			const storedIdx = this._currentSubtitleIdx;
			if (storedIdx === null)
				return null;
			const trackList = mediaTracksMethods.subtitles.call(this);
			const track = trackList[storedIdx];
			if (!track)
				return null;
			return {
				index: storedIdx,
				track,
			};
		}

		return (async () => {
			const result = await this._dispatchBefore<{ track: number | null }>('beforeSubtitle', { track: idx });
			if (result.prevented) {
				this.emit('subtitlePrevented', {
					reason: result.reason ?? 'listener-prevented',
					cause: result.cause,
				});
				return;
			}
			const targetIdx = result.data.track;

			// Tear down any in-flight sidecar tracker first; switching tracks
			// (or to null) must release the prior cue stream so it doesn't
			// keep emitting active cues from the old track.
			this._disposeSidecarSubtitle();

			const backend = this._peekBackendTyped<_BackendWithSubtitleTracks>();

			// "Off" — clear backend selection AND emit an empty cue list so
			// renderers wipe their overlays.
			if (targetIdx === null || targetIdx < 0) {
				this._currentSubtitleIdx = null;
				backend?.setSubtitleTrack?.(null);
				this.emit('subtitle', { track: null });
				this.emit('subtitleCue', {
					cues: [],
					language: undefined,
				});
				return;
			}

			// Resolve against the SAME deduped backend block `subtitles()`
			// builds — never the backend's raw track count — so this boundary
			// can never desync from the list the caller picked `targetIdx` from.
			const dedupedBackend = _dedupedBackendSubtitles(this);

			// Backend-managed: index falls within the deduped backend block.
			// The list position is NOT the backend's own index once any track
			// was displaced, so map `chosen` back to its position in the raw
			// `subtitleTracks()` array (by id, falling back to language + label
			// + url) before calling `setSubtitleTrack`. Backend will emit
			// `subtitleCue` itself via its cuechange hook.
			if (targetIdx < dedupedBackend.length) {
				const chosen = dedupedBackend[targetIdx]!;
				const rawIdx = _rawBackendSubtitleIndex(_backendSubtitleTracks(this), chosen);
				this._currentSubtitleIdx = targetIdx;
				backend?.setSubtitleTrack?.(rawIdx >= 0 ? rawIdx : targetIdx);
				this.emit('subtitle', { track: targetIdx });
				return;
			}

			// Sidecar VTT: index past the deduped backend block points into the
			// item-declared list (`subtitles: [...]` / wire `tracks: [...]`).
			// Disable any backend track first so the two streams don't both
			// fire `subtitleCue`.
			this._currentSubtitleIdx = targetIdx;
			backend?.setSubtitleTrack?.(null);
			const sidecar = _resolveSidecarSubtitle(this, targetIdx - dedupedBackend.length);
			this.emit('subtitle', { track: targetIdx });
			if (!sidecar?.url) {
				this.emit('subtitleCue', {
					cues: [],
					language: undefined,
				});
				return;
			}
			void _startSidecarSubtitle(this, sidecar);
		})();
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
		if (!this._subtitleStyle)
			this._subtitleStyle = { ...DEFAULT_SUBTITLE_STYLE };

		if (patch === undefined)
			return { ...this._subtitleStyle };

		this._subtitleStyle = {
			...this._subtitleStyle,
			...patch,
		};
		this.emit('subtitleStyle', { ...this._subtitleStyle });
		return undefined;
	},

	/**
	 * Inject a sidecar subtitle track into the CURRENTLY-PLAYING item at
	 * runtime — no reload. The very next `subtitles()` call (and the
	 * `'subtitles'` event fired here) include it.
	 *
	 * Idempotent: a track already present at the same `url` + normalised
	 * `language` is returned unchanged instead of duplicated. Pass
	 * `default: true` to select it immediately through the same cancellable
	 * `beforeSubtitle` path as `subtitle(idx)`.
	 *
	 * Video-only surface — sidecar subtitles have no meaning on an audio
	 * backend, so `NMMusicPlayer` does not declare this method even though
	 * the kit composes it onto both prototypes.
	 *
	 * @throws {StateError} `core:media-tracks/no-active-item` when no item is loaded.
	 */
	addSubtitleTrack(this: Internals, input: SidecarSubtitleInput, _opts?: ActionOptions): SubtitleTrack {
		const currentItem = this.item?.();
		if (!currentItem) {
			throw stateError('core:media-tracks/no-active-item', 'addSubtitleTrack() called with no active item.');
		}

		const wantedLanguage = normalizeLanguage(input.language);
		const existing = mediaTracksMethods.subtitles.call(this).find(track =>
			track.url === input.url && normalizeLanguage(track.language) === wantedLanguage);

		if (existing) {
			if (input.default)
				_selectSidecarSubtitleById(this, existing.id);
			return existing;
		}

		const track: SubtitleTrack = {
			id: `subtitle-runtime-${defaultIdGenerator.next()}`,
			language: input.language,
			label: input.label ?? input.language,
			kind: 'subtitles',
			type: input.type,
			url: input.url,
			default: input.default ?? false,
		};

		const updatedItem: BasePlaylistItem & ItemWithSidecarSubtitles = {
			...currentItem,
			subtitles: [..._itemSidecarSubtitles(currentItem), track],
		};
		this._queueList.replaceItem(updatedItem);

		this.emit('subtitles', { tracks: mediaTracksMethods.subtitles.call(this) });

		if (track.default)
			_selectSidecarSubtitleById(this, track.id);

		return track;
	},

	/**
	 * Remove a sidecar subtitle track previously added via
	 * `addSubtitleTrack()` (or declared on the item's typed `subtitles`
	 * field) by id. No-op when `id` is not found there — backend-managed
	 * (HLS-manifest) tracks are out of scope, they have no sidecar entry to
	 * remove. Emits `'subtitles'` with the refreshed list on removal. If the
	 * removed track was the active selection, subtitles are turned off via
	 * the same `subtitle(null)` path `subtitle()` already exposes.
	 */
	removeSubtitleTrack(this: Internals, id: string, _opts?: ActionOptions): void {
		const currentItem = this.item?.();
		if (!currentItem)
			return;

		const existingField = _itemSidecarSubtitles(currentItem);
		const remaining = existingField.filter(track => track.id !== id);
		if (remaining.length === existingField.length)
			return;

		const tracksBefore = mediaTracksMethods.subtitles.call(this);
		const activeIdx = this._currentSubtitleIdx;
		const wasActive = activeIdx !== null && tracksBefore[activeIdx]?.id === id;

		const updatedItem: BasePlaylistItem & ItemWithSidecarSubtitles = {
			...currentItem,
			subtitles: remaining,
		};
		this._queueList.replaceItem(updatedItem);

		this.emit('subtitles', { tracks: mediaTracksMethods.subtitles.call(this) });

		if (wasActive)
			void this.subtitle(null);
	},

	/**
	 * The active backend's audio tracks. Returns an empty list when no
	 * backend is mounted or the backend doesn't expose multi-track audio
	 * (audio-only, single-track sources). Use the returned indexes with
	 * `audioTrack(idx)`.
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
	 * `audioTrack()` — returns `{ index, track }` for the currently-selected
	 * audio track, or `null` when no explicit selection has been made.
	 *
	 * `audioTrack(idx)` — dispatches `beforeAudioTrack` with the requested
	 * index. A listener may `preventDefault()` to cancel, in which case
	 * `audioTrackPrevented` fires and the selection is unchanged. Otherwise
	 * selects the audio track at `idx` and fires the `audioTrack` event with
	 * `{ id: idx }`. Returns a `Promise<void>` so callers can await the full
	 * cancellable cycle.
	 */
	audioTrack(this: Internals, idx?: number): CurrentAudioTrackSelection | null | Promise<void> {
		if (idx === undefined) {
			const storedIdx = this._currentAudioTrackIdx;
			if (storedIdx === null)
				return null;
			const trackList = mediaTracksMethods.audioTracks.call(this);
			const track = trackList[storedIdx];
			if (!track)
				return null;
			return {
				index: storedIdx,
				track,
			};
		}

		return (async () => {
			const result = await this._dispatchBefore<{ id: number }>('beforeAudioTrack', { id: idx });
			if (result.prevented) {
				this.emit('audioTrackPrevented', {
					reason: result.reason ?? 'listener-prevented',
					cause: result.cause,
				});
				return;
			}
			const targetIdx = result.data.id;

			this._currentAudioTrackIdx = targetIdx;

			// Keep the audio-track-state token in sync so audioTrackState() always
			// reflects that a manual selection is active.
			this._audioTrackState = AudioTrackState.MANUAL;
			this.emit('audioTrackState', { state: this._audioTrackState });

			const backend = this._peekBackendTyped<_BackendWithAudioTrack>();
			if (typeof backend?.setAudioTrack === 'function') {
				backend.setAudioTrack(targetIdx);
			}
			this.emit('audioTrack', { id: targetIdx });
		})();
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
	 * `quality()` — returns `{ index, track }` for the currently-selected
	 * quality level, or `'auto'` when adaptive bitrate selection is active.
	 *
	 * `quality(idx)` — lock to a specific quality level. Pass
	 * `'auto'` to restore adaptive selection.
	 */
	quality(this: Internals, idx?: number | 'auto'): CurrentQualitySelection | 'auto' | void {
		if (idx === undefined) {
			const storedIdx = this._currentQualityIdx;
			if (storedIdx === 'auto')
				return 'auto';
			const levelList = mediaTracksMethods.qualityLevels.call(this);
			const track = levelList[storedIdx];
			if (!track)
				return 'auto';
			return {
				index: storedIdx,
				track,
			};
		}

		this._currentQualityIdx = idx;

		// Keep the quality-state token in sync so qualityMode() always reflects
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
		const current = this.item?.() as { chapters?: ReadonlyArray<Chapter> } | undefined | null;
		return Array.isArray(current?.chapters) ? current.chapters : [];
	},

	/**
	 * Seek to the start of the chapter at `idx`. Out-of-range indexes no-op.
	 * Emits `chapter` with the resolved index and title after the seek is
	 * dispatched. The underlying `time` call is fire-and-forget — its
	 * `seeked` event fires on the correct path regardless of any wired
	 * `beforeSeek` handler.
	 */
	seekToChapter(this: Internals, idx: number, opts?: ActionOptions): void {
		const list = this.chapters();
		const chapter = list[idx];
		if (!chapter)
			return;

		const ret = this.time(chapter.start, opts);
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

		const currentTime = this._internalCurrentTime;
		const nextIdx = list.findIndex(chapter => chapter.start > currentTime);
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

		const currentTime = this._internalCurrentTime;
		let currentIdx = -1;
		for (let i = list.length - 1; i >= 0; i--) {
			if (list[i]!.start <= currentTime) {
				currentIdx = i;
				break;
			}
		}
		if (currentIdx < 0)
			return;

		const intoChapter = currentTime - list[currentIdx]!.start;
		const targetIdx = (intoChapter > 10 || currentIdx === 0) ? currentIdx : currentIdx - 1;
		this.seekToChapter(targetIdx, opts);
	},

	/**
	 * Read or seek by chapter.
	 *
	 * `chapter()` — returns the `Chapter` whose time range contains
	 * the current playback time, or `null` when no chapter is active (before
	 * the first, between chapters, or the chapter list is empty).
	 *
	 * `chapter(idx)` — jump to the chapter at `idx` (same as
	 * `seekToChapter(idx)`). No-op when `idx` is out of range.
	 */
	chapter(this: Internals, idx?: number): Chapter | null | void {
		if (idx === undefined) {
			const list = this.chapters();
			if (list.length === 0)
				return null;

			const currentTime = this._internalCurrentTime;
			for (let i = list.length - 1; i >= 0; i--) {
				const ch = list[i]!;
				if (currentTime >= ch.start && currentTime < ch.end)
					return ch;
			}
			return null;
		}
		this.seekToChapter(idx);
	},
} as const;
