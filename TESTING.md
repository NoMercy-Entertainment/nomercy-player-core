# Testing your own plugin

The kit ships a conformance helper that handles the boilerplate every plugin test needs — fresh setup per test, automatic teardown, and a listener-leak assertion. You write behavior assertions; the kit handles the rest.

## Install

```
npm install --save-dev @nomercy-entertainment/nomercy-player-core
```

You need [Vitest](https://vitest.dev/) with `test.globals: true` in the config:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'happy-dom',
	},
});
```

## Writing the test

Import `describePlugin` from the `/testing` subpath:

```ts
import { describePlugin } from '@nomercy-entertainment/nomercy-player-core/testing';
import { PlaybackTrackerPlugin } from './playback-tracker';

describePlugin(PlaybackTrackerPlugin, (ctx) => {
	it('starts with zero events recorded', () => {
		expect(ctx.plugin.playCount()).toBe(0);
	});

	it('increments count when play fires', () => {
		ctx.player.emit('play', undefined);
		expect(ctx.plugin.playCount()).toBe(1);
	});
});
```

`ctx.player` is a `StubPlayer` — a full `IPlayer`-compliant test double with a real event bus but no media element. `ctx.plugin` is your plugin instance, already past `initialize()` and `use()`.

## What the kit asserts automatically

For every `it` block inside `describePlugin`:

| Assertion | What it checks |
|---|---|
| `use()` completes | No throw during setup |
| `dispose()` completes | No throw during teardown |
| Zero listener leak | Listener count returns to baseline after `dispose()` |

These three always run. You do not write them yourself.

## Adding behavior assertions

Everything inside the `describePlugin` callback is yours. Use standard Vitest APIs — `describe`, `it`, `expect`, `vi.fn()`. The plugin and player are reset between every test.

```ts
describePlugin(PlaybackTrackerPlugin, (ctx) => {
	describe('maxEvents cap', () => {
		it('stops tracking after maxEvents play events', () => {
			ctx.plugin.options({ maxEvents: 2 });

			ctx.player.emit('play', undefined);
			ctx.player.emit('play', undefined);
			ctx.player.emit('play', undefined); // over the cap

			expect(ctx.plugin.playCount()).toBe(2);
			expect(ctx.plugin.isCapped()).toBe(true);
		});
	});
});
```

## Options: `skipLeakAssertion` and `createPlayer`

```ts
describePlugin(PlaybackTrackerPlugin, (ctx) => {
	// ...
}, {
	// Pass pre-set plugin options.
	opts: { maxEvents: 5 },

	// Skip the automatic leak assertion. Only use this when you are
	// deliberately testing leak behavior itself.
	skipLeakAssertion: true,

	// Provide a custom player — useful when your plugin needs a specific
	// phase, seeded translations, or injected auth.
	createPlayer: () => new StubPlayer({ id: 'my-app-player' }),
});
```

## Asserting your plugin's own events

Plugin events are namespaced under `plugin:<id>:`. Listen via `ctx.player.on` and remove the handler before the end of the test body. The kit's leak assertion runs in `afterEach` — any listener still on the bus at that point will fail the leak check.

```ts
describePlugin(PlaybackTrackerPlugin, (ctx) => {
	it('emits plugin:playback-tracker:tracked on each play', () => {
		const received: Array<{ count: number }> = [];
		const handler = (data: { count: number }): void => {
			received.push(data);
		};
		ctx.player.on('plugin:playback-tracker:tracked', handler);

		ctx.player.emit('play', undefined);
		ctx.player.emit('play', undefined);

		ctx.player.off('plugin:playback-tracker:tracked', handler);

		expect(received).toEqual([{ count: 1 }, { count: 2 }]);
	});
});
```

## Driving the player's phase

Plugins that react to phase transitions use `ctx.player.setPhase()`:

```ts
it('stops tracking when player enters disposed phase', () => {
	ctx.player.setPhase('disposed');
	ctx.player.emit('play', undefined);
	expect(ctx.plugin.playCount()).toBe(0);
});
```

## Standalone leak harness

The leak assertion that `describePlugin` runs automatically is also exported standalone for one-off checks outside the DSL:

```ts
import { LifecycleRegistry }
	from '@nomercy-entertainment/nomercy-player-core/adapters/lifecycle-registry';
import { assertNoListenerLeak, StubPlayer }
	from '@nomercy-entertainment/nomercy-player-core/testing';

it('my plugin cleans up cleanly', async () => {
	const player = new StubPlayer();
	const lifecycle = new LifecycleRegistry();
	const plugin = new PlaybackTrackerPlugin();

	await assertNoListenerLeak({
		subjectId: 'playback-tracker',
		player,
		setup: () => {
			plugin.initialize(player, {}, lifecycle);
			plugin.use();
		},
		teardown: () => {
			plugin.dispose();
			lifecycle.dispose();
		},
	});
});
```

## Full example

`packages/nomercy-player-core/src/__tests__/testing/consumer-plugin.example.test.ts` in this repository is a complete worked example. It defines a realistic plugin (`PlaybackTrackerPlugin`) and runs it through the full suite pattern shown above. Copy it as the starting point for your own plugin's test file.

The example runs as part of the core test suite (`npx vitest run`) so it proves the documented consumer path works end-to-end in CI.
