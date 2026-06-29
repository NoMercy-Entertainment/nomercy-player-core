[![npm](https://img.shields.io/npm/v/@nomercy-entertainment/nomercy-player-core/rc?label=rc)](https://www.npmjs.com/package/@nomercy-entertainment/nomercy-player-core)
[![license](https://img.shields.io/npm/l/@nomercy-entertainment/nomercy-player-core)](./LICENSE)
[![bundlephobia](https://img.shields.io/bundlephobia/minzip/@nomercy-entertainment/nomercy-player-core)](https://bundlephobia.com/package/@nomercy-entertainment/nomercy-player-core)

Full documentation: https://docs.nomercy.tv/nomercy-player-core/

# nomercy-player-core

The shared, headless engine that the video and music players are built on. It carries everything that is not specific to video or audio: the queue, the auth pipeline, the plugin system, the typed event bus, i18n, storage, and an adapter port for every cross-cutting concern. Swapping a default is a matter of passing a different implementation to `setup()`, no subclassing.

You rarely install this package directly. Pull in [`nomercy-video-player`](https://www.npmjs.com/package/@nomercy-entertainment/nomercy-video-player) or [`nomercy-music-player`](https://www.npmjs.com/package/@nomercy-entertainment/nomercy-music-player) and the core is installed automatically as a hard dependency. Install it on its own only when you are writing a library-level plugin or a new player package on top of the core.

```
npm install @nomercy-entertainment/nomercy-player-core
```

## Quick start

The core is the player engine. Compose its method mixins onto a class and you have a working player: the queue, transport, loading pipeline, time and volume, the typed event bus, auth, and the plugin system are all there. A library on top of the core adds only the medium-specific piece, the backend that turns a source into sound or picture.

```ts
import {
  composeMixins,
  initPlayerCoreState,
  lifecycleMethods,
  playerCoreMethods,
  queueMethods,
  timeMethods,
  transportMethods,
  volumeMethods,
} from '@nomercy-entertainment/nomercy-player-core';

class MyPlayer {
  constructor(id: string) {
    initPlayerCoreState(this, { className: 'MyPlayer' });
    this.setup({ playlist: [{ id, url: '...' }] });
  }
}

composeMixins(
  MyPlayer.prototype,
  playerCoreMethods,
  lifecycleMethods,
  queueMethods,
  transportMethods,
  timeMethods,
  volumeMethods,
);

const player = new MyPlayer('intro');
player.on('ready', () => player.play());
player.queue();
player.time(30);
```

That player drives the full core surface. The only thing it does not do on its own is render a medium, which is what `nomercy-video-player` and `nomercy-music-player` add. Reach for the core directly when you are building a new player package like those, not when you just want to play video or audio.

Two extension points carry the rest of the surface. Adapters swap any cross-cutting concern through `setup()`, no subclassing:

```ts
import { LocalStorageBackend } from '@nomercy-entertainment/nomercy-player-core';

player.setup({ storage: new LocalStorageBackend() });
```

Plugins extend behavior and ride the same typed event bus. They read through `this.on`, emit their own events, and clean up on `dispose()`:

```ts
import { Plugin } from '@nomercy-entertainment/nomercy-player-core';

export class PlayCountPlugin extends Plugin {
  static override readonly id = 'play-count';

  override use(): void {
    this.on('play', () => this.emit('play-count:changed', undefined));
  }
}

player.addPlugin(PlayCountPlugin);
```

## Documentation

The [docs site](https://docs.nomercy.tv/nomercy-player-core/) is the full reference:

- [Quick Start](https://docs.nomercy.tv/nomercy-player-core/quickstart) and the [adapter ports](https://docs.nomercy.tv/nomercy-player-core/adapters)
- [Event system](https://docs.nomercy.tv/nomercy-player-core/event-system), [lifecycle](https://docs.nomercy.tv/nomercy-player-core/lifecycle), and [auth and fetch](https://docs.nomercy.tv/nomercy-player-core/auth-fetch)
- [Built-in plugins](https://docs.nomercy.tv/nomercy-player-core/plugins), [plugin authoring](https://docs.nomercy.tv/nomercy-player-core/plugin-authoring), and the full type reference
- [Testing your plugins](./TESTING.md) with the `describePlugin` conformance helper the kit ships

## License

Apache-2.0

Repository: [github.com/NoMercy-Entertainment/nomercy-player-core](https://github.com/NoMercy-Entertainment/nomercy-player-core)
