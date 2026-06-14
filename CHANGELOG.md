# Changelog — @nomercy-entertainment/nomercy-player-core

## [2.0.0-rc.1] — 2026-06-14

### Changed

- API-unification consolidation. `url` is now a field on the `BasePlaylistItem`
  base type as the canonical media source, so `load()` no longer needs an
  intersection constraint and call sites no longer cast to read it.
- The base event map is generic over the item type; the queue-item selection
  event is shared across both player libraries.

### Added

- Perceptual volume curve, the `play-queue` and `shuffle-strategy` adapters, and
  the auth-token URL helper.

### Fixed

- The audio-graph reconciles a single shared `AudioContext`; the analyser tap is
  wired correctly across backends.

## [2.0.0-beta.1] — 2026-05-30

### Breaking

- `currentSubtitle()`, `currentAudioTrack()`, and `currentQuality()` no longer
  return a bare index number. The getter forms now return `CurrentSubtitleSelection |
  null`, `CurrentAudioTrackSelection | null`, and `CurrentQualitySelection | 'auto'`
  respectively. Read `.index` for the number and `.track` for the full metadata.
  Setter overloads (`currentSubtitle(idx)` etc.) are unchanged.

### Added

- `player.t(PluginClass, key, vars?)` — class-typed overload. Prepends
  `plugin.<id>.` automatically so plugin code never hand-rolls the namespace.
- `CurrentSubtitleSelection`, `CurrentAudioTrackSelection`, `CurrentQualitySelection`
  interfaces exported from the main entry.
- `ICapabilitiesProbe.supportedCodecs()` implemented in `browserPlatform` via a
  `MediaSource.isTypeSupported` sweep (H.264 baseline/main/high, H.265, VP8, VP9,
  AV1, AAC, Opus, Vorbis, FLAC).
- `./plugins/cast-sender` added to the `exports` map (was built but not exported).

### Fixed

- `KIT_VERSION` bumped to `2.0.0-beta.1` to reflect the breaking change above.
- `hls.js` dependency pinned to `^1.6.0` (was `>=1.6.0` — would have accepted a future 2.x).
- README subpath examples corrected: `cues/parsers/vtt` → `adapters/cue-parser/vtt`;
  platform sub-port subpaths that do not exist as individual exports removed from the table;
  empty `testing` import example replaced with real named exports.
- `contributors` email updated to GitHub noreply address.

---

## [2.0.0-beta.0] — 2026-05-16

First public pre-release of the shared player core extracted from the monolithic v1 players.

### Added

- Plugin runtime with full lifecycle (`use`, `dispose`, `enable`, `disable`, event forwarding)
- Event system (`EventEmitter`) with typed `EventMap` generic, `on`/`once`/`off`/`emit`
- 28 named adapter ports replacing all hardcoded concrete dependencies in v1:
  `auth`, `class-manager`, `clock`, `cue-parser`, `drm`, `element-factory`, `event-bus`,
  `fetch`, `id-generator`, `language-matcher`, `lifecycle-registry`, `logger`, `media-list`,
  `platform` (+ capabilities / fullscreen / network / pip / visibility / wake-lock),
  `preload`, `realtime`, `retry-policy`, `storage`, `stream`, `subtitle-renderer`,
  `translator`, `url-resolver`
- 11 built-in plugins: `audio-graph`, `canvas`, `embed`, `equalizer`, `key-handler`,
  `media-session`, `message`, `mixer`, `spectrum`, `tab-leader`, `visualization`
- Subpath exports for all adapters and plugins — consumers who import subpaths get
  tree-shaken bundles; barrel imports still work unchanged
- `composeMixins` / `playerCoreMethods` — mixin system that composes shared player
  logic onto `NMVideoPlayer` and `NMMusicPlayer` prototypes without inheritance
- `CrossfadeTransitionStrategy`, `GaplessTransitionStrategy`, `DefaultPreloadStrategy`
- `authFetch` — auth-aware fetch wrapper shared by `Plugin.fetch` and setup-time loads
- VTT and LRC cue parsers
- `nomercyTranslationsPlugin` — Vite plugin for i18n glob bundling
- Full TypeScript declaration + declaration-map output (every subpath has `.d.ts`)
- `testing` subpath with stub player for unit tests

### Architecture

The 12-wave restructure (W1–W12, 2026-05-15) extracted all adapter implementations from
the original monolithic root files into `src/adapters/` and `src/plugins/` folders, each
with their own `index.ts` barrel. Breaking changes relative to the v1 monolithic model are
limited to internal imports — the public `index.ts` barrel export surface is unchanged.

---

See `MIGRATION.md` for the full v1→v2 migration guide.
