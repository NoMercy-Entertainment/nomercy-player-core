import type { ActionOptions, Chapter, SubtitleCue as SubtitleCuePayload, SubtitleTrack } from '../../types';
import { CueTracker } from '../../cues/tracker';
import { parseVttSubtitles } from '../../cues/parsers/vtt';
import type { VTTSubtitlePayload } from '../../cues/parsers/vtt';
import type { Cue } from '../../cues/cue';

import type { Internals, SidecarSubtitleContext } from '../state';
import { peekBackendTyped } from '../util/backend';
import { disposeSidecarSubtitle } from '../util/sidecar';
import { hasTracksField, resolveItemTrackUrls } from '../util/tracks';
import type { ItemWithDefinedTracks, ItemWithTracks, SidecarTrack } from '../util/tracks';


// ──────────────────────────────────────────────────────────────────────────
// Narrow backend interfaces — local to this mixin
// ──────────────────────────────────────────────────────────────────────────

interface _BackendWithSubtitleTracks {
	setSubtitleTrack?: (idx: number | null) => void;
	subtitleTracks?: () => SubtitleTrack[];
}
interface _BackendWithAudioTrack { setAudioTrack?: (idx: number) => void }
interface _BackendWithQualityLevels { qualityLevels?: (opts?: { includeUnsupported?: true }) => unknown }
interface _BackendWithSetQualityLevel { setQuality?: (idx: number | 'auto') => void }
interface _BackendWithAudioTracks { audioTracks?: () => unknown }


// ──────────────────────────────────────────────────────────────────────────
// Sidecar VTT helpers
// ──────────────────────────────────────────────────────────────────────────

function _resolveSidecarSubtitle(
	self: Internals,
	sidecarIdx: number,
): { url?: string; language?: string; label?: string; type?: string } | undefined {
	const rawCur = self.current?.();
	const cur: ItemWithDefinedTracks | undefined = rawCur && hasTracksField(rawCur) ? rawCur : undefined;
	const list = (cur?.tracks ?? []).filter((sidecarTrack: SidecarTrack) => sidecarTrack.kind === 'subtitles');
	const sidecarTrack = list[sidecarIdx];
	if (!sidecarTrack) return undefined;
	return { url: sidecarTrack.file, language: sidecarTrack.language, label: sidecarTrack.label, type: sidecarTrack.type };
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
			self.emit('subtitleCue', { cues: [], language: track.language });
			return;
		}
		raw = await r.text();
	}
	catch {
		self.emit('subtitleCue', { cues: [], language: track.language });
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
		self.emit('subtitleCue', { cues, language: ctx.language });
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
	subtitles(this: Internals): unknown {
		// Subtitles are the union of:
		//   1. tracks the backend exposes (HLS-managed in-manifest subtitles
		//      via `b.subtitleTracks()`)
		//   2. sidecar VTTs declared on the active playlist item under
		//      `tracks: [{ kind: 'subtitles', ... }]`
		// Consumers should not have to know which side a track came from —
		// they get one flat list to render and a stable index per entry.
		const fromBackend: SubtitleTrack[] = (() => {
			const backend = peekBackendTyped<_BackendWithSubtitleTracks>(this);
			if (typeof backend?.subtitleTracks === 'function') {
				try {
					return backend.subtitleTracks() ?? [];
				}
				catch { return []; }
			}
			return [];
		})();

		const fromItem: Array<{ id: string; language?: string; label?: string; kind: 'subtitles'; type?: string; url?: string; default: boolean }> = (() => {
			const rawCur = this.current?.();
			const cur: ItemWithDefinedTracks | undefined = rawCur && hasTracksField(rawCur) ? rawCur : undefined;
			const tracks = cur?.tracks ?? [];
			return tracks
				.filter(sidecarTrack => sidecarTrack?.kind === 'subtitles')
				.map((sidecarTrack, idx) => ({
					id: sidecarTrack.id ?? `subtitle-sidecar-${idx}`,
					language: sidecarTrack.language,
					label: sidecarTrack.label,
					kind: 'subtitles' as const,
					type: sidecarTrack.type,
					url: sidecarTrack.file,
					default: false,
				}));
		})();

		// HLS-managed first (their indexes are what `currentSubtitle(idx)` writes
		// to `hls.subtitleTrack`); sidecar VTTs trail the list.
		return [...fromBackend, ...fromItem];
	},
	/**
	 * Read or write the active subtitle track.
	 *
	 * `currentSubtitle()` — returns the index of the currently-selected
	 * subtitle track, or `null` when subtitles are off.
	 *
	 * `currentSubtitle(idx)` — select subtitle track at `idx`. Pass `null`
	 * (or a negative number) to disable subtitles. Fires the `subtitle` event
	 * with `{ track: idx | null }`.
	 */
	currentSubtitle(this: Internals, idx?: number | null): number | null | void {
		if (idx === undefined) {
			return this._currentSubtitleIdx;
		}

		// Tear down any in-flight sidecar tracker first; switching tracks
		// (or to null) must release the prior cue stream so it doesn't
		// keep emitting active cues from the old track.
		disposeSidecarSubtitle(this);

		const b = peekBackendTyped<_BackendWithSubtitleTracks>(this);
		const backendCount = (typeof b?.subtitleTracks === 'function')
			? (b.subtitleTracks() ?? []).length
			: 0;

		// "Off" — clear backend selection AND emit an empty cue list so
		// renderers wipe their overlays.
		if (idx === null || idx < 0) {
			this._currentSubtitleIdx = null;
			b?.setSubtitleTrack?.(null);
			this.emit('subtitle', { track: null });
			this.emit('subtitleCue', { cues: [], language: undefined });
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
			this.emit('subtitleCue', { cues: [], language: undefined });
			return;
		}
		void _startSidecarSubtitle(this, sidecar);
	},
	/**
	 * Read or write the subtitle style. Mirrors the v1 player API so
	 * settings menus and overlay plugins talk through one surface and
	 * never have to maintain their own ad-hoc cache.
	 *
	 * Reading: `player.subtitleStyle()` → full current style.
	 * Writing: `player.subtitleStyle({ fontSize: 120 })` merges the
	 * patch onto the active style and emits `subtitleStyle` with the
	 * merged result so subscribers (the overlay plugin, settings menu
	 * subtext, etc.) can react.
	 */
	subtitleStyle(this: Internals, patch?: Record<string, unknown>): Record<string, unknown> | void {
		// Lazily seed defaults the first time this is read. Defaults match
		// the v1 player's `defaultSubtitleStyles` so menus pre-populate
		// with sensible values without the consumer wiring an init step.
		const seed = (): Record<string, unknown> => ({
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
	audioTracks(this: Internals): unknown {
		const backend = peekBackendTyped<_BackendWithAudioTracks>(this);
		if (typeof backend?.audioTracks === 'function') {
			try {
				return backend.audioTracks();
			}
			catch { return []; }
		}
		return [];
	},
	/**
	 * Read or write the active audio track.
	 *
	 * `currentAudioTrack()` — returns the index of the currently-selected
	 * audio track, or `null` when no explicit selection has been made.
	 *
	 * `currentAudioTrack(idx)` — select the audio track at `idx`. Fires the
	 * `audioTrack` event with `{ id: idx }`.
	 */
	currentAudioTrack(this: Internals, idx?: number): number | null | void {
		if (idx === undefined) {
			return this._currentAudioTrackIdx;
		}
		this._currentAudioTrackIdx = idx;
		const backend = peekBackendTyped<_BackendWithAudioTrack>(this);
		if (typeof backend?.setAudioTrack === 'function') {
			backend.setAudioTrack(idx);
		}
		// No backend track support — emit for symmetry.
		this.emit('audioTrack', { id: idx });
	},
	qualityLevels(this: Internals, opts?: { includeUnsupported?: true }): unknown {
		const backend = peekBackendTyped<_BackendWithQualityLevels>(this);
		if (typeof backend?.qualityLevels === 'function') {
			try {
				return backend.qualityLevels(opts);
			}
			catch { return []; }
		}
		return [];
	},
	/**
	 * Read or write the active quality level.
	 *
	 * `currentQuality()` — returns the currently-selected quality index, or
	 * `'auto'` when adaptive bitrate selection is active.
	 *
	 * `currentQuality(idx)` — lock to a specific quality level. Pass
	 * `'auto'` to restore adaptive selection.
	 */
	currentQuality(this: Internals, idx?: number | 'auto'): number | 'auto' | void {
		if (idx === undefined) {
			return this._currentQualityIdx;
		}
		this._currentQualityIdx = idx;
		const backend = peekBackendTyped<_BackendWithSetQualityLevel>(this);
		if (typeof backend?.setQuality === 'function') {
			backend.setQuality(idx);
		}
		// No HLS variants on audio backend — no-op.
	},
	chapters(this: Internals): ReadonlyArray<Chapter> {
		// Chapter list comes from the active playlist item. Items carry an
		// inline `chapters: Chapter[]` field once the kit resolves the sidecar
		// VTT (either during `load()` or on cursor change). Returns [] until
		// the async fetch settles — subscribe to 'chapters' for the ready signal.
		const rawCurrent = this.current?.();
		const current: ItemWithDefinedTracks | undefined = rawCurrent && hasTracksField(rawCurrent) ? rawCurrent : undefined;
		return current?.chapters ?? [];
	},
	seekToChapter(this: Internals, idx: number, opts?: ActionOptions): void {
		const list = this.chapters();
		const chapter = list[idx];
		if (!chapter)
			return; // out-of-range → no-op

		// `currentTime` is async when a beforeSeek handler is wired. Fire-and-
		// forget here — `seeked` is emitted inside `currentTime` after the
		// phase round-trip, so consumers still see it on the correct path.
		const ret = this.currentTime(chapter.start, opts);
		if (ret instanceof Promise)
			void ret;

		this.emit('chapter', {
			index: idx,
			title: chapter.title,
		});
	},
	nextChapter(this: Internals, opts?: ActionOptions): void {
		const list = this.chapters();
		if (list.length === 0)
			return;

		const t = this._internalCurrentTime;
		const nextIdx = list.findIndex(c => c.start > t);
		if (nextIdx < 0)
			return; // already in/after the last chapter

		this.seekToChapter(nextIdx, opts);
	},
	previousChapter(this: Internals, opts?: ActionOptions): void {
		const list = this.chapters();
		if (list.length === 0)
			return;

		const t = this._internalCurrentTime;
		// v1 UX: if more than 10s into the current chapter, jump to its start
		// instead of the previous chapter. Otherwise, walk back one.
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


// Export the resolveItemTrackUrls helper so loadingMethods can use it.
// (It's in util/tracks.ts — this is just a re-export for mixin co-location.)
export { resolveItemTrackUrls } from '../util/tracks';
