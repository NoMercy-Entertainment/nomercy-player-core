# Changelog — @nomercy-entertainment/nomercy-player-core

## [2.0.0-rc.21] — 2026-07-02

> This entry was corrected after publish to disclose the M1 change below — the original rc.21 release notes only covered the `baseUrl` fix. The published rc.21 tarball is unchanged; this is a documentation correction so the history is accurate.

### Breaking

- `volume()`, `mute()`, `unmute()`, `subtitle()`, `audioTrack()`, `playbackRate()`, `repeatState()`, `shuffleState()`, and `dispose()` setters now return `Promise<void>` instead of `void`. Each dispatches its own dedicated `before*` hook (see Added) ahead of the mutation. Code that read state synchronously right after calling one of these must now `await` the call first. Callers that never inspected the return value are unaffected. `nomercy-video-player` and `nomercy-music-player` need a matching release to stay structurally compatible with `IPlayer` — see their rc.22 changelogs.

### Added

- Ten cancellable `before*` hooks on `BaseEventMap`, the M1 Connect-plugin slice: `beforeVolume`, `beforeMute`, `beforeRepeat`, `beforeShuffle`, `beforePlaybackRate`, `beforeLanguage`, `beforeSubtitle`, `beforeAudioTrack`, `beforeDispose`, `beforeTransfer`. Each fires before its action applies; a listener may call `preventDefault()` to cancel (the matching `<action>Prevented` event fires instead) or hand `delay()` a promise the dispatch awaits before proceeding. `beforeVolume` and `beforePlaybackRate` fire unconditionally, independent of `setup({ mutationGuards })`, so a Connect plugin can rely on them without opting the whole player into the generic mutation-guard surface.

### Fixed

- `baseUrl` now prepends to relative media paths as a raw string prefix, keeping its own path segment, the same way `baseImageUrl` already did. Previously media resolution used `new URL(path, baseUrl)`, which dropped the base path when the path started with a slash (the shape the media server sends), so `baseUrl` plus a root-relative item path resolved to a 404. Setting `baseUrl` and giving items relative paths now works as intended.

## [2.0.0-rc.20] — 2026-07-02

### Changed

- Backend layer de-duplicated. The hls.js `xhrSetup` Authorization closure (previously copy-pasted across every backend) is now `createAuthorizationXhrSetup` in core; the DOM play-state bridge (previously reimplemented per library and drifted) is now `bridgeBackendPlayState`; `destroyHlsInstance` is the single HLS teardown path. Internal only; no public export, signature, or event-shape change.

## [2.0.0-rc.15] — 2026-06-29

### Security

- `auth()` now returns a **redacted** frozen snapshot: `bearerToken` and
  `accessToken` are stripped before the object leaves the player. The raw auth
  config is only reachable via the internal `_rawAuth()` path used by the fetch
  pipeline. Consumer code and custom URL resolvers receive the redacted view.
  The encapsulation guarantee is proven by tests in `base-player-auth-lock.test.ts`.

### Changed

- `setup()` now self-applies the `.nomercyplayer` CSS class to the container
  element. Consumers no longer need to add `class="nomercyplayer"` manually,
  though leaving it in place is harmless.

### Added

- `describePlugin` conformance kit exported via the `./testing` subpath. Wraps
  every plugin test with a fresh `StubPlayer` + plugin pair, automatic
  teardown, and a zero-listener-leak assertion. See `TESTING.md` for the guide
  and the worked example at
  `src/__tests__/testing/consumer-plugin.example.test.ts`.
- `playbackRate` event added to `BaseEventMap`. Fires on every playback-rate
  change with payload `{ rate: number }`.

## [2.0.0-rc.14] — 2026-06-28

### Security

- `auth()` and the URL-resolver context now redact bearer and access tokens
  before the object is visible to consumer or plugin code. `_rawAuth()` is the
  internal-only token path used by the fetch pipeline.

### Changed

- `setup()` self-applies the `.nomercyplayer` CSS class to the container
  element so consumers no longer need to add it manually.

### Added

- `describePlugin` conformance kit exported via the `./testing` subpath, with a
  consumer `TESTING.md` guide and a worked example.
- `playbackRate` event added to `BaseEventMap`, firing on every playback-rate
  change with payload `{ rate: number }`.
- Mixin test coverage added.

## [2.0.0-rc.13] — 2026-06-28

Version aligned with the player trio (no core code change).

## [2.0.0-rc.12] — 2026-06-28

Version aligned with the player trio (no core code change).

## [2.0.0-rc.11] — 2026-06-28

Version aligned with the player trio (no core code change).

## [2.0.0-rc.10] — 2026-06-28

Version aligned with the player trio for the video autohide fix (no core code
change).

## [2.0.0-rc.9] — 2026-06-28

### Changed

- `hls.js` is now a real `dependency` of core. The HLS engine lives here;
  `nomercy-music-player` and `nomercy-video-player` receive it transitively.

## [2.0.0-rc.8] — 2026-06-28

### Fixed

- The published ESM dist now carries explicit `.js` extensions on every
  relative import via a `tsc-alias` post-build pass, making the package
  importable by a raw Node ESM consumer.

## [2.0.0-rc.7] — 2026-06-28

### Fixed

- `KIT_VERSION` is inlined at build time instead of read from a JSON import,
  so the package loads cleanly under Node ESM.
- `KIT_VERSION` is single-sourced from `package.json`; the semver prerelease
  comparator is also corrected.

## [2.0.0-rc.6] — 2026-06-28

### Fixed

- Cast play/pause inversion corrected; equalizer-restore no-op resolved.
- `time()` setter is now guarded against out-of-range values.
- `playbackRate` is clamped to the `[0.25, 2]` range.

## [2.0.0-rc.5] — 2026-06-14

### Changed

- The cast-sender plugin's translations use a typesafe key schema: `en.ts`
  exports the canonical `CastSenderTranslationKey`, and every language file is
  `satisfies Record<CastSenderTranslationKey, string>` for full coverage,
  replacing the loose `Record<string, string>`. All supported languages ship.

### Fixed

- The README and the package `homepage` point at the live docs route
  (`docs.nomercy.tv/nomercy-player-core/`) instead of the dead `/player/` path.

## [2.0.0-rc.4] — 2026-06-14

### Changed

- The GitHub repository was renamed from `nomercy-player-kit` to
  `nomercy-player-core` to match the published package name. Repository URLs,
  contributing/releasing docs, and the README point at the new location.

### Fixed

- Every source file now carries the correct `Apache-2.0` license header. One
  file previously declared `GPL-3.0-only`, which contradicted the package
  license; the header tool gained Apache-2.0 support to stamp the house header.

## [2.0.0-rc.3] — 2026-06-14

### Fixed

- The published `dist` now carries explicit `.js` extensions on every relative
  import and export. `tsc` under `moduleResolution: Bundler` emitted
  extensionless specifiers, which resolve in bundlers but break Node's ESM
  loader for consumers that pull the package from `node_modules`. A `tsc-alias`
  post-build pass rewrites both `.js` and `.d.ts` specifiers.

### Added

- The build scripts (`resolve-translation-globs`, `copy-dist-assets`,
  `inline-css-assets`) ship in the package so the music and video libraries can
  run the shared post-build steps from the installed core instead of a sibling
  checkout.

## [2.0.0-rc.2] — 2026-06-14

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
