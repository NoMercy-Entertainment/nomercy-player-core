# NoMercy Player Core

Headless, plugin-driven engine shared by `nomercy-music-player` and `nomercy-video-player`. Carries everything not specific to audio or video: queue, transport, auth, i18n, storage, the plugin system, the typed event bus.

## Tech stack

- TypeScript (ES2022), outputs ESM via `tsc`
- Testing: Vitest (unit)
- Linting: `@antfu/eslint-config` (ESLint 9 flat config) + `@nomercy-entertainment/eslint-plugin-player`
- Formatting: Prettier — tabs, width 4, single quotes, semis, printWidth 150

## Structure

```
src/
  core/            # mixins composed onto per-library player prototypes (queue, transport, time, volume, auth, etc.)
  adapters/         # swappable interfaces + defaults (storage, logger, fetch, realtime, preload, url-resolver, shuffle, ...)
  plugins/          # cross-library plugins (cast-sender, media-session, key-handler, embed, ...)
  types/            # BasePlaylistItem, BasePlayerConfig, BaseEventMap, IPlayer, ...
  testing/          # describePlugin conformance harness
  errors/           # PlayerError hierarchy
  i18n/             # kit's own English bundle
  base-player.ts    # shared base-player composition helper
  index.ts          # public API entry point
```

## Conventions

- npm scope: `@nomercy-entertainment/nomercy-player-core`
- Module type: ESM (`"type": "module"`)
- Subpath exports for adapters, plugins, streams, testing — tree-shakable

## Rules

- Every method here must be identical in behavior for music and video, no domain twist. A branch on "is this music or video" means the method belongs in a per-library player class, not here — pull it back down.
- **Config fields identical across music + video live on `BasePlayerConfig`, never duplicated per-library.** Example precedent: `controls?: boolean` (native `<audio controls>` / `<video controls>`) moved here from `VideoPlayerConfig` once music needed the same flag — video now inherits it instead of redeclaring it. Per-library config (`VideoPlayerConfig`, `MusicPlayerConfig`) is for genuinely domain-specific fields only (`crossfadeDefaults`, `octopus`, `stretching`).
- Adapters are interfaces with a default impl, swappable via `setup()`. No subclassing to override cross-cutting concerns.
- Plugins ride the same typed event bus as the per-library packages — `plugin:<id>:<event>`, never a bare core event name.
- Run `npm run typecheck` and `npm test` before committing changes.
