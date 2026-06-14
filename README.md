[![npm](https://img.shields.io/npm/v/@nomercy-entertainment/nomercy-player-core/beta?label=beta)](https://www.npmjs.com/package/@nomercy-entertainment/nomercy-player-core)
[![license](https://img.shields.io/npm/l/@nomercy-entertainment/nomercy-player-core)](./LICENSE)
[![bundlephobia](https://img.shields.io/bundlephobia/minzip/@nomercy-entertainment/nomercy-player-core)](https://bundlephobia.com/package/@nomercy-entertainment/nomercy-player-core)

Full documentation: https://docs.nomercy.tv/player/

# nomercy-player-core

The shared, headless engine that the video and music players are built on. It carries everything that is not specific to video or audio: the queue, the auth pipeline, the plugin system, the typed event bus, i18n, storage, and an adapter port for every cross-cutting concern. Swapping a default is a matter of passing a different implementation to `setup()`, no subclassing.

You rarely install this package directly. Pull in [`nomercy-video-player`](https://www.npmjs.com/package/@nomercy-entertainment/nomercy-video-player) or [`nomercy-music-player`](https://www.npmjs.com/package/@nomercy-entertainment/nomercy-music-player) and the core comes along as a peer dependency. Install it on its own only when you are writing a library-level plugin or a new player package on top of the core.

```
npm install @nomercy-entertainment/nomercy-player-core
```

## Quick start

You drive the core through a library. The core's adapters and plugins are configured in the same `setup()` call:

```ts
import nmplayer from '@nomercy-entertainment/nomercy-video-player';
import { LocalStorageBackend } from '@nomercy-entertainment/nomercy-player-core';

const player = nmplayer('player')
  .setup({
    baseUrl: 'https://raw.githubusercontent.com/NoMercy-Entertainment/nomercy-media/master/Films',
    storage: new LocalStorageBackend(),
    playlist: [
      {
        id: 'sintel',
        title: 'Sintel',
        url: '/Sintel.(2010)/Sintel.(2010).NoMercy.m3u8',
        duration: 888,
      },
    ],
  });

player.on('ready', () => {
  player.item(0, { autoplay: true });
});
```

## Documentation

The [docs site](https://docs.nomercy.tv/player/) is the full reference and the home for everything that used to live in the wiki:

- [Quick Start](https://docs.nomercy.tv/player/quickstart) and the [adapter ports](https://docs.nomercy.tv/player/kit/adapters)
- [Event system](https://docs.nomercy.tv/player/kit/event-system), [lifecycle](https://docs.nomercy.tv/player/kit/lifecycle), and [auth and fetch](https://docs.nomercy.tv/player/kit/auth-fetch)
- [Built-in plugins](https://docs.nomercy.tv/player/kit/plugins), [plugin authoring](https://docs.nomercy.tv/player/plugin-authoring), and the full type reference

## License

Apache-2.0

Repository: [github.com/NoMercy-Entertainment/nomercy-player-kit](https://github.com/NoMercy-Entertainment/nomercy-player-kit)
