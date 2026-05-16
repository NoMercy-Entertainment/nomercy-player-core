[![npm](https://img.shields.io/npm/v/@nomercy-entertainment/nomercy-player-core/beta?label=beta)](https://www.npmjs.com/package/@nomercy-entertainment/nomercy-player-core)
[![license](https://img.shields.io/npm/l/@nomercy-entertainment/nomercy-player-core)](./LICENSE)
[![bundlephobia](https://img.shields.io/bundlephobia/minzip/@nomercy-entertainment/nomercy-player-core)](https://bundlephobia.com/package/@nomercy-entertainment/nomercy-player-core)

Full documentation: https://docs.nomercy.tv/player/

# nomercy-player-core

The headless contract substrate for self-hosted media players. 28 adapter ports. Pluggable everything.

```
npm install @nomercy-entertainment/nomercy-player-core
```

---

## Quick start

```ts
import { nmplayer } from '@nomercy-entertainment/nomercy-video-player';
import { LocalStorageBackend, browserPlatform } from '@nomercy-entertainment/nomercy-player-core';

const player = nmplayer('player-1').setup({
  container: document.getElementById('player')!,
  accessToken: () => myAuth.getToken(),
  storage: new LocalStorageBackend(),
  platform: browserPlatform,
  queue: [{ id: '1', url: 'https://cdn.example.com/video.m3u8', title: 'My Video' }],
});

await player.ready();
await player.play();
```

---

## Adapter catalog

The kit ships 28 named ports. Each port is an interface you can swap end-to-end. Default implementations ship alongside — tree-shake via subpath imports.

| Port | Interface | Default adapters | Description | Subpath import |
|------|-----------|-----------------|-------------|----------------|
| storage | `IStorage` | `LocalStorageBackend`, `MemoryStorageBackend`, `IndexedDBBackend` | Key-value persistence for plugin state and preferences | `@nomercy-entertainment/nomercy-player-core/adapters/storage` |
| stream | `IStreamSource`, `IStreamRegistry` | HLS.js-backed, native MediaSource-passthrough | Streaming protocol abstraction — swap HLS.js for Shaka, dash.js, or a custom source | `@nomercy-entertainment/nomercy-player-core/adapters/stream` |
| platform | `IPlatform` | `browserPlatform` (full bundle) | Bundles 6 sub-ports; swap individual controllers without replacing the whole bundle | `@nomercy-entertainment/nomercy-player-core/adapters/platform` |
| platform/wake-lock | `IWakeLock` | included in `browserPlatform` | Prevents display sleep while media is playing | `@nomercy-entertainment/nomercy-player-core/adapters/platform/wake-lock` |
| platform/network | `INetworkMonitor` | included in `browserPlatform` | Reports connection type and online/offline state | `@nomercy-entertainment/nomercy-player-core/adapters/platform/network` |
| platform/visibility | `IVisibilityMonitor` | included in `browserPlatform` | Reports page/tab visibility state | `@nomercy-entertainment/nomercy-player-core/adapters/platform/visibility` |
| platform/capabilities | `ICapabilitiesProbe` | included in `browserPlatform` | Queries `MediaCapabilities` / `isTypeSupported` for codec decisions | `@nomercy-entertainment/nomercy-player-core/adapters/platform/capabilities` |
| platform/fullscreen | `IFullscreenController` | included in `browserPlatform` | Requests and exits fullscreen; video player only | `@nomercy-entertainment/nomercy-player-core/adapters/platform/fullscreen` |
| platform/pip | `IPipController` | included in `browserPlatform` | Requests and exits Picture-in-Picture; video player only | `@nomercy-entertainment/nomercy-player-core/adapters/platform/pip` |
| realtime | `IRealtimeChannel` | `nativeWebSocketAdapter` | WebSocket / SignalR / Socket.IO abstraction for sync and group features | `@nomercy-entertainment/nomercy-player-core/adapters/realtime` |
| translator | `ITranslator`, `ITranslationLoader` | `DefaultTranslator`, `createNetworkTranslationLoader`, `translationsFromGlob` | i18n engine — swap for i18next, FormatJS, or a custom backend | `@nomercy-entertainment/nomercy-player-core/adapters/translator` |
| language-matcher | `ILanguageMatcher` | `bcp47FallbackChain` | BCP-47 locale matching and fallback chain resolution | `@nomercy-entertainment/nomercy-player-core/adapters/language-matcher` |
| preload | `IPreloadStrategy`, `ITransitionStrategy` | `DefaultPreloadStrategy`, `GaplessTransitionStrategy`, `CrossfadeTransitionStrategy` | Next-item preload timing and inter-item transition behaviour | `@nomercy-entertainment/nomercy-player-core/adapters/preload` |
| cue-parser | `ICueParser`, `ICueParserRegistry` | `CueParserRegistry`, VTT and LRC built-ins | Pluggable subtitle and lyric cue parsing — register custom formats | `@nomercy-entertainment/nomercy-player-core/adapters/cue-parser` |
| subtitle-renderer | `ISubtitleRenderer` | DOM renderer (`buildSubtitleFragment`), canvas-octopus-bridge | Renders cues to DOM or canvas; swap for ASS/VOBSUB renderers | `@nomercy-entertainment/nomercy-player-core/adapters/subtitle-renderer` |
| logger | `ILogger` | `Logger` (console with level and scope filtering) | Structured logging — swap for Sentry, Datadog, or a silent no-op | `@nomercy-entertainment/nomercy-player-core/adapters/logger` |
| retry-policy | `IRetryPolicy` | `DEFAULT_RETRY_POLICY` (exponential back-off) | Network retry logic for fetch and stream requests | `@nomercy-entertainment/nomercy-player-core/adapters/retry-policy` |
| event-bus | `IEventBus` | `EventEmitter` | Typed event emitter; swap for a shared bus across player instances | `@nomercy-entertainment/nomercy-player-core/adapters/event-bus` |
| media-list | `IMediaList` | `MediaList` (cursor-aware list) | Queue data structure with cursor, shuffle, and backlog — underlies every queue method | `@nomercy-entertainment/nomercy-player-core/adapters/media-list` |
| lifecycle-registry | `ILifecycleRegistry` | `LifecycleRegistry` | Tracks setup and dispose hooks for plugins and platform adapters | `@nomercy-entertainment/nomercy-player-core/adapters/lifecycle-registry` |
| fetch | `IFetch` | `authFetch` (auth-aware, retry-backed) | HTTP fetch with auth headers, scope, and retry — plugins use this, never raw `globalThis.fetch` | `@nomercy-entertainment/nomercy-player-core/adapters/fetch` |
| clock | `IClock` | system (`performance.now` / `Date.now`) | Monotonic clock — swap for a server-synced clock in group-sync scenarios | `@nomercy-entertainment/nomercy-player-core/adapters/clock` |
| id-generator | `IIdGenerator` | default (`crypto.randomUUID` with fallback) | Unique ID generation for player instances and events | `@nomercy-entertainment/nomercy-player-core/adapters/id-generator` |
| element-factory | `IElementFactory` | dom (`document.createElement`) | DOM element creation — swap for SSR stubs or native-shell equivalents | `@nomercy-entertainment/nomercy-player-core/adapters/element-factory` |
| class-manager | `IClassManager` | dom (classList operations) | CSS class management on the player container | `@nomercy-entertainment/nomercy-player-core/adapters/class-manager` |
| auth | `IAuthConfig` | port only — consumer required | Token delivery contract; no default because auth is always app-specific | `@nomercy-entertainment/nomercy-player-core/adapters/auth` |
| drm | `IDrmConfig` | port only — consumer required | DRM key-system and license server config; no default | `@nomercy-entertainment/nomercy-player-core/adapters/drm` |
| url-resolver | `IUrlResolver` | port only — consumer required | URL rewriting for CDN signing, auth params, or proxy routing | `@nomercy-entertainment/nomercy-player-core/adapters/url-resolver` |

---

## Writing a custom adapter

Any class that satisfies the interface is a valid adapter. Inject it through `setup()`.

**Example — remote-API storage backend:**

```ts
import type { IStorage } from '@nomercy-entertainment/nomercy-player-core/adapters/storage';

class RemoteStorageBackend implements IStorage {
  async get(key: string): Promise<string | null> {
    const response = await fetch(`/api/prefs/${key}`);
    if (!response.ok) return null;
    return response.text();
  }

  async set(key: string, value: string): Promise<void> {
    await fetch(`/api/prefs/${key}`, { method: 'PUT', body: value });
  }

  async remove(key: string): Promise<void> {
    await fetch(`/api/prefs/${key}`, { method: 'DELETE' });
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    try { return JSON.parse(raw) as T; }
    catch { return null; }
  }

  async setJSON<T>(key: string, value: T): Promise<void> {
    await this.set(key, JSON.stringify(value));
  }
}

// Inject via setup():
player.setup({ storage: new RemoteStorageBackend() });
```

The same pattern applies to every port — implement the interface, pass the instance to `setup()`.

---

## Built-in plugins

The kit ships 12 optional plugins. All are opt-in — none allocate resources until registered.

| Plugin | Class | Description | Subpath import |
|--------|-------|-------------|----------------|
| audio-graph | `AudioGraphPlugin` | Web Audio API routing graph — prerequisite for EQ, mixer, and spectrum | `@nomercy-entertainment/nomercy-player-core/plugins/audio-graph` |
| canvas | `CanvasPlugin` | Shared canvas surface for visualization plugins | `@nomercy-entertainment/nomercy-player-core/plugins/canvas` |
| cast-sender | `CastSenderPlugin` | Google Cast sender integration for Chromecast handoff | `@nomercy-entertainment/nomercy-player-core/plugins/cast-sender` |
| embed | `EmbedPlugin` | postMessage bridge for iframe-embedded players | `@nomercy-entertainment/nomercy-player-core/plugins/embed` |
| equalizer | `EqualizerPlugin` | Parametric EQ with presets (requires `AudioGraphPlugin`) | `@nomercy-entertainment/nomercy-player-core/plugins/equalizer` |
| key-handler | `KeyHandlerPlugin` | Keyboard shortcut routing | `@nomercy-entertainment/nomercy-player-core/plugins/key-handler` |
| media-session | `MediaSessionPlugin` | Media Session API integration (lock screen, notification controls) | `@nomercy-entertainment/nomercy-player-core/plugins/media-session` |
| message | `MessagePlugin` | Cross-window event bridge | `@nomercy-entertainment/nomercy-player-core/plugins/message` |
| mixer | `MixerPlugin` | Per-track gain control (requires `AudioGraphPlugin`) | `@nomercy-entertainment/nomercy-player-core/plugins/mixer` |
| spectrum | `SpectrumPlugin` | Frequency-domain analyser node (requires `AudioGraphPlugin`) | `@nomercy-entertainment/nomercy-player-core/plugins/spectrum` |
| tab-leader | `TabLeaderPlugin` | Single-tab audio leadership across multiple open tabs | `@nomercy-entertainment/nomercy-player-core/plugins/tab-leader` |
| visualization | `VisualizationPlugin` | rAF-driven rendering callbacks for canvas visualizers | `@nomercy-entertainment/nomercy-player-core/plugins/visualization` |

---

## Subpath exports

Every adapter and plugin has a dedicated subpath export. Import only what you use — bundlers drop the rest.

```ts
// Barrel import (still works):
import { LocalStorageBackend, AudioGraphPlugin } from '@nomercy-entertainment/nomercy-player-core';

// Subpath imports (tree-shakeable, preferred for production bundles):
import { LocalStorageBackend } from '@nomercy-entertainment/nomercy-player-core/adapters/storage';
import { AudioGraphPlugin } from '@nomercy-entertainment/nomercy-player-core/plugins/audio-graph';
import { parseVtt } from '@nomercy-entertainment/nomercy-player-core/cues/parsers/vtt';
import { parseLrc } from '@nomercy-entertainment/nomercy-player-core/cues/parsers/lrc';
```

Testing utilities live in their own subpath and never land in production bundles:

```ts
import { } from '@nomercy-entertainment/nomercy-player-core/testing';
```

---

## Architecture

The kit occupies layer 2 of a 5-layer stack:

| Layer | Owner | Knows about |
|-------|-------|-------------|
| 1. Backend | `IVideoBackend` / `IAudioBackend` impls | `<video>` / `<audio>` / MediaSource / AudioContext / MediaKeys |
| 2. Kit | `@nomercy-entertainment/nomercy-player-core` | Generic contracts only — zero NoMercy specifics |
| 3. Per-library | `nomercy-video-player` / `nomercy-music-player` | Generic video and music behaviour — zero NoMercy specifics |
| 4. Built-in plugin | Plugins inside kit and library packages | Domain-generic UI and features |
| 5. Consumer plugin | App code / `nomercy-plugins/` | All NoMercy-specific glue — server endpoints, sync protocols, radio |

The kit has zero knowledge of NoMercy server endpoints, Fillz plugins, or NoMercy Connect protocols. That code lives at layer 5, in consumer plugins.

---

## Versioning

v2.0.0 is the contract-substrate version. The public API surface (all named exports from the root `index.ts`) is stable — existing `import` statements continue to work without changes. Internal structure may evolve between minor versions.

---

## License

Apache-2.0

Repository: [github.com/NoMercy-Entertainment/nomercy-player-kit](https://github.com/NoMercy-Entertainment/nomercy-player-kit)
