# Migration Guide — v1 to v2

## beta.0 → beta.1 breaking change

### `currentSubtitle()`, `currentAudioTrack()`, `currentQuality()` return shape changed

These three getters previously returned a bare number (or `null` / `'auto'`).
They now return a selection object so callers don't need to index into the track
list separately.

```ts
// beta.0
const idx = player.currentSubtitle(); // number | null

// beta.1
const sel = player.currentSubtitle(); // CurrentSubtitleSelection | null
const idx = sel?.index; // number | undefined
const track = sel?.track; // SubtitleTrack | undefined
```

The **setter** overloads are unchanged:

```ts
player.currentSubtitle(2); // still takes a number
player.currentSubtitle(null); // still takes null to turn subtitles off
```

Same pattern for `currentAudioTrack()` → `CurrentAudioTrackSelection | null` and
`currentQuality()` → `CurrentQualitySelection | 'auto'`.

---

Covers all three packages: `nomercy-player-core`, `nomercy-video-player` (v2), and `nomercy-music-player` (v2).

This guide covers kit-level changes: subpath imports, the five-layer architecture, and the 38 named adapter ports. For consumer-facing breaking changes (renamed methods, event payload shapes, playlist item fields), see the per-package migration guides:

- **Video player:** [`packages/nomercy-video-player-v2/MIGRATION.md`](../nomercy-video-player-v2/MIGRATION.md)
- **Music player:** [`packages/nomercy-music-player-v2/MIGRATION.md`](../nomercy-music-player-v2/MIGRATION.md)

---

## TL;DR

Public API is stable. Import names did not change. If your code does:

```ts
import { nmplayer, NMMusicPlayer } from '@nomercy-entertainment/nomercy-music-player';
import { IPlayer, LocalStorageBackend, Plugin } from '@nomercy-entertainment/nomercy-player-core';
import { nmplayer, NMVideoPlayer } from '@nomercy-entertainment/nomercy-video-player';
```

no changes are required. All named exports from the root `index.ts` of each package resolve to the same names they always did.

---

## What's new for adopters

### Subpath imports enable tree-shaking

The kit now publishes 28 adapter subpaths and 12 plugin subpaths. Existing barrel imports still work. Subpath imports are opt-in and let bundlers eliminate the adapters you don't use.

### Cross-plugin event type inference works correctly

The internal `__events__` type parameter on `Plugin` now propagates through `getPlugin()` correctly. TypeScript consumers who call `player.getPlugin(MyPlugin)` now get back a fully-typed instance without a cast.

### HDR-aware ABR auto-switch (video-v2)

The `Html5VideoBackend` automatically constrains HLS.js ABR to respect the active display's dynamic-range capability. On SDR displays, PQ/HLG level variants are excluded from ABR selection. When the user moves the browser window to a different monitor, the constraint updates live. No configuration is needed. See the video player README for details.

### 38 named adapter ports replace the previous monolithic class model

The `v1` `NMVideoPlayer` and `NMMusicPlayer` classes hardcoded every concrete dependency (storage, platform, logger, etc.). In v2, each dependency is an injected port. The player classes still work with zero configuration — all ports have sensible defaults — but every one of them can be swapped independently.

---

## Optional opt-ins — subpath imports

```ts
// Before (still works, no change required):
import { LocalStorageBackend } from '@nomercy-entertainment/nomercy-player-core';

// After (tree-shakeable — bundler drops unused adapters):
import { LocalStorageBackend } from '@nomercy-entertainment/nomercy-player-core/adapters/storage';
```

Full subpath table:

| Subpath | What it exports |
|---------|----------------|
| `@nomercy-entertainment/nomercy-player-core/adapters/storage` | `IStorage`, `LocalStorageBackend`, `MemoryStorageBackend`, `IndexedDBBackend` |
| `@nomercy-entertainment/nomercy-player-core/adapters/stream` | `IStreamSource`, `IStreamRegistry`, `StreamRegistry` |
| `@nomercy-entertainment/nomercy-player-core/adapters/platform` | `IPlatform`, `browserPlatform` |
| `@nomercy-entertainment/nomercy-player-core/adapters/platform/wake-lock` | `IWakeLock` |
| `@nomercy-entertainment/nomercy-player-core/adapters/platform/network` | `INetworkMonitor` |
| `@nomercy-entertainment/nomercy-player-core/adapters/platform/visibility` | `IVisibilityMonitor` |
| `@nomercy-entertainment/nomercy-player-core/adapters/platform/capabilities` | `ICapabilitiesProbe` |
| `@nomercy-entertainment/nomercy-player-core/adapters/platform/fullscreen` | `IFullscreenController` |
| `@nomercy-entertainment/nomercy-player-core/adapters/platform/pip` | `IPipController` |
| `@nomercy-entertainment/nomercy-player-core/adapters/realtime` | `IRealtimeChannel`, `nativeWebSocketAdapter` |
| `@nomercy-entertainment/nomercy-player-core/adapters/translator` | `ITranslator`, `DefaultTranslator`, `createNetworkTranslationLoader`, `translationsFromGlob` |
| `@nomercy-entertainment/nomercy-player-core/adapters/language-matcher` | `ILanguageMatcher`, `bcp47FallbackChain` |
| `@nomercy-entertainment/nomercy-player-core/adapters/preload` | `IPreloadStrategy`, `ITransitionStrategy`, `DefaultPreloadStrategy`, `GaplessTransitionStrategy`, `CrossfadeTransitionStrategy` |
| `@nomercy-entertainment/nomercy-player-core/adapters/cue-parser` | `ICueParser`, `CueParserRegistry` |
| `@nomercy-entertainment/nomercy-player-core/adapters/subtitle-renderer` | `ISubtitleRenderer`, `buildSubtitleFragment` |
| `@nomercy-entertainment/nomercy-player-core/adapters/logger` | `ILogger`, `Logger` |
| `@nomercy-entertainment/nomercy-player-core/adapters/retry-policy` | `IRetryPolicy`, `DEFAULT_RETRY_POLICY` |
| `@nomercy-entertainment/nomercy-player-core/adapters/event-bus` | `IEventBus`, `EventEmitter` |
| `@nomercy-entertainment/nomercy-player-core/adapters/media-list` | `IMediaList`, `MediaList` |
| `@nomercy-entertainment/nomercy-player-core/adapters/lifecycle-registry` | `ILifecycleRegistry`, `LifecycleRegistry` |
| `@nomercy-entertainment/nomercy-player-core/adapters/fetch` | `IFetch`, `authFetch` |
| `@nomercy-entertainment/nomercy-player-core/adapters/clock` | `IClock` |
| `@nomercy-entertainment/nomercy-player-core/adapters/id-generator` | `IIdGenerator` |
| `@nomercy-entertainment/nomercy-player-core/adapters/element-factory` | `createElement`, `createButton`, `createSVG`, `addClasses`, `removeClasses`, `AddClasses`, `AppendTo`, `CreateElement` |
| `@nomercy-entertainment/nomercy-player-core/adapters/url-resolver` | `IUrlResolver` |
| `@nomercy-entertainment/nomercy-player-core/plugins/audio-graph` | `AudioGraphPlugin`, `audioGraphPlugin` |
| `@nomercy-entertainment/nomercy-player-core/plugins/canvas` | `CanvasPlugin`, `canvasPlugin` |
| `@nomercy-entertainment/nomercy-player-core/plugins/cast-sender` | `CastSenderPlugin`, `castSenderPlugin` |
| `@nomercy-entertainment/nomercy-player-core/plugins/embed` | `EmbedPlugin`, `embedPlugin` |
| `@nomercy-entertainment/nomercy-player-core/plugins/equalizer` | `EqualizerPlugin`, `equalizerPlugin` |
| `@nomercy-entertainment/nomercy-player-core/plugins/key-handler` | `KeyHandlerPlugin`, `keyHandlerPlugin` |
| `@nomercy-entertainment/nomercy-player-core/plugins/media-session` | `MediaSessionPlugin`, `mediaSessionPlugin` |
| `@nomercy-entertainment/nomercy-player-core/plugins/message` | `MessagePlugin`, `messagePlugin` |
| `@nomercy-entertainment/nomercy-player-core/plugins/mixer` | `MixerPlugin`, `mixerPlugin` |
| `@nomercy-entertainment/nomercy-player-core/plugins/spectrum` | `SpectrumPlugin`, `spectrumPlugin` |
| `@nomercy-entertainment/nomercy-player-core/plugins/tab-leader` | `TabLeaderPlugin`, `tabLeaderPlugin` |
| `@nomercy-entertainment/nomercy-player-core/plugins/visualization` | `VisualizationPlugin` |
| `@nomercy-entertainment/nomercy-player-core/cues/parsers/vtt` | `parseVtt`, `parseVttSprite`, `parseVttSubtitles` |
| `@nomercy-entertainment/nomercy-player-core/cues/parsers/lrc` | `parseLrc` |
| `@nomercy-entertainment/nomercy-player-core/streams/hls` | HLS stream source |
| `@nomercy-entertainment/nomercy-player-core/streams/native` | Native stream source |
| `@nomercy-entertainment/nomercy-player-core/testing` | Test helpers and mock adapters |
| `@nomercy-entertainment/nomercy-player-core/vite-plugin` | Vite build plugin |

---

## Removed APIs

No APIs were removed. Every named export present in the v1 packages continues to resolve in v2. The goal of the 12-wave restructure was zero consumer breakage.

---

## New extension points

The 38 named ports are the primary extension surface. Each port is an interface you implement and inject via `setup()`.

| Port group | What you can customize |
|------------|----------------------|
| `IStorage` | Where plugin state is persisted — localStorage, IndexedDB, remote API, memory |
| `IPlatform` and sub-ports | Platform behaviour for native shells — Capacitor, Tauri, Electron — or custom fullscreen and PiP controllers |
| `IRealtimeChannel` | WebSocket transport — swap for SignalR, Socket.IO, or a mock |
| `ITranslator` / `ITranslationLoader` | i18n engine and where translation files come from |
| `IPreloadStrategy` / `ITransitionStrategy` | When the next item preloads and how transitions between items play out |
| `ICueParser` | Custom subtitle or lyric formats registered via `player.registerCueParser()` |
| `ISubtitleRenderer` | How cues are rendered — DOM text, canvas, or a custom renderer |
| `ILogger` | Log destination and filtering |
| `IRetryPolicy` | Network retry timing and max-attempts |
| `IClock` | Monotonic time source — swap for a server-synced clock in group-sync scenarios |
| `IUrlResolver` | URL rewriting — CDN signing, auth params, proxy routing |
| `IAudioBackend` (music-v2) | Audio element behaviour — web-audio or html5-audio, or a custom WS-backed backend |
| `IPlaylistGenerator` (music-v2) | Queue ordering — linear, tag-aware shuffle, or server-driven |
| `ISimilarityEngine` (music-v2) | "More like this" playlist extension — consumer-required, server-specific |
| `IScrobbler` (music-v2) | Playback reporting — Last.fm, ListenBrainz, or custom |
| `ILyricSource` (music-v2) | Lyric data delivery — LRC file, server API, or embedded metadata |
| `INowPlayingArt` (music-v2) | Album art resolution — Media Session, server API, or local cache |
| `IVideoBackend` (video-v2) | Video element behaviour — Html5VideoBackend or a custom MSE/WebCodecs backend |
| `IThumbnailSource` (video-v2) | Seek thumbnail frames — VTT sprite or a server-generated endpoint |
| `IChapterSource` (video-v2) | Chapter markers — VTT file or a server metadata endpoint |
| `ISubtitleStyleStore` (video-v2) | Subtitle style persistence — storage-backed or custom |

---

## Five-layer architecture

Understanding where code lives makes extension points obvious.

| Layer | Package | Knows about |
|-------|---------|-------------|
| 1. Backend | `IVideoBackend` / `IAudioBackend` impls | `<video>` / `<audio>` / MediaSource / AudioContext / MediaKeys |
| 2. Kit | `@nomercy-entertainment/nomercy-player-core` | Generic contracts only — zero NoMercy specifics |
| 3. Per-library | `nomercy-video-player` / `nomercy-music-player` | Generic video and music behaviour — zero NoMercy specifics |
| 4. Built-in plugin | Plugins inside kit and library packages | Domain-generic UI and features |
| 5. Consumer plugin | App code / `nomercy-plugins/` | All NoMercy-specific glue — server endpoints, sync protocols, radio |

Layers 1–4 have zero knowledge of NoMercy server endpoints, the Fillz plugin system, or NoMercy Connect protocols. All of that lives at layer 5 in consumer plugins. This boundary is what makes it possible to use layers 2–4 independently of any NoMercy infrastructure.
