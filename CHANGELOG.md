# Changelog — @nomercy-entertainment/nomercy-player-core

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
