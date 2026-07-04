# Changelog — @nomercy-entertainment/nomercy-player-core

## [2.0.0-rc.25] — 2026-07-04

### Added

- The kit's own translation bundle is now wired into the default translator. `core.*` keys (network, auth, browser-policy, media, DRM, state, and accessibility announcements) resolve out of the box in 79 locales — previously the bundle shipped but was never loaded, so `t('core.network.timeout')` returned the raw key for any consumer who did not manually pass `enTranslations`. English is seeded eagerly as the synchronous fallback; other kit languages lazy-load on demand (the active BCP-47 chain only, never all 79 at once). Consumer-supplied `translations` and `loadTranslations` still win on same-key collisions.

### Changed

- **Breaking vs rc.24 (types only):** `subtitle()`, `subtitles()`, and `subtitleStyle()` are no longer declared on the shared `IPlayer` interface — they are video-only capability members on `IVideoPlayer` in `nomercy-video-player`. They were meaningless for audio and always threw `NotImplementedError` on the music player, so the shared type promised an API that never worked there. Runtime behavior is unchanged for video consumers; the shared mixin still carries the implementation. Music code that referenced these members could never have worked and now fails at compile time instead of at runtime.
- Visualization and canvas render failures now surface through the structured plugin error contract instead of `console.error`. A throwing visualization renderer reports `visualization:render/failed` and the plugin instance disables itself on first failure (no error storm from the rAF loop); a throwing canvas renderer reports `canvas:render/renderer-failed` and only that renderer is dropped — other renderers on the shared canvas keep running.

### Fixed

- `addPlugin(X).ready()` no longer resolves before a post-setup plugin registration has actually finished. Plugins that carry lazy translation bundles added awaited work inside registration that `ready()` did not track, so `getPluginById()` could return `undefined` immediately after the await. Registration promises are now drained by `ready()`, and a throwing lazy translation loader surfaces as `plugin:failed` instead of vanishing silently (it previously sat outside the failure-handling try/catch).
- The plugin conformance harness (`testing/describePlugin`) now loads a plugin's static translations with the same prototype-chain-walk and lazy-load semantics as the real registration pipeline, so `this.t()` resolves under conformance tests instead of returning the raw key.
- MIGRATION.md corrections: the per-package guide links pointed at directories that no longer exist, the "no APIs were removed" claim contradicted the music package's documented port removals, and the extension-points table listed ports (`ISimilarityEngine`, `ILyricSource`, `INowPlayingArt`) that are not part of the public surface. The table now reflects the real exported subpaths.
- Stopped shipping the embedded `./eslint-plugin` subpath export. The lint rules are dev tooling, not part of the player runtime contract; freezing them into the package's public surface for the whole 2.x line would have made their removal a semver-major change. They move to the standalone `@nomercy-entertainment/eslint-plugin-player` package (see RELEASING.md for the publish-day sequencing).

## [2.0.0-rc.24] — 2026-07-04

### Fixed

- `perceptualGain()` — the shared position→gain volume curve — replaced the −60 dB…0 dB broadcast fader law with the consumer power taper `gain = position²`. The old law put the 50% slider at −30 dB (gain 0.0316), leaving everything below ~70% barely audible. Now 50% → 0.25 (−12 dB), 60% → 0.36 (−8.9 dB), endpoints exact (0 → silence, 1 → unity), and the sub-1% hard-floor snap is gone. Both libraries inherit the fix (`MediaElementBackend` + the music WebAudio/HTML5 backends); crossfade ramps read already-curved live gains and are unaffected.

## [2.0.0-rc.23] — 2026-07-03

### Added

- `plugins?: ReadonlyArray<PluginSpec>` on `BasePlayerConfig` — declarative plugin registration via `setup({ plugins: [...] })`. Each entry is a bare class ref or `{ plugin, opts }`. Sugar over calling `addPlugin()` before `setup()`, not a second registration path: same `pluginsRegistering` pipeline stage, same `core:plugin/duplicate-id` / `-missing-dep` / `-version-mismatch` / `-incompatible-core-version` validation, same timing. Fixes the pre-setup addPlugin() window being easy to miss (a re-render or late framework lifecycle hook silently no-ops registration). `nomercy-video-player` and `nomercy-music-player` inherit this for free — both already spread the full config through their `setup()` wrappers, no changes needed in either package.

### Fixed

- `EventEmitter.on()` (and `.once()`) now `console.warn`s when a consumer subscribes to a renamed-away event name (currently `'current'`, renamed to `'item'`), naming the replacement. The bare-`string` overload needed for `plugin:<id>:<event>` namespaced events can't be narrowed to reject only known-stale names without breaking `Plugin.on()`'s internal implementation, so this is a runtime backstop, not a type fix. Diagnostic only — a listener on the renamed event still never fires, same as before.

## [2.0.0-rc.22] — 2026-07-03

### Added

- `controls?: boolean` on `BasePlayerConfig`. Renders the browser's native
  media controls on the backing element (`<audio controls>` / `<video
  controls>`) — useful when no UI plugin is loaded. Default `false`. Previously
  declared only on video's own config type; now shared so both libraries in
  the trio honor it identically. `nomercy-video-player` drops its duplicate
  declaration (inherits this one) and `nomercy-music-player` now reads it too
  — see their rc.22 changelogs. Additive, non-breaking.

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
