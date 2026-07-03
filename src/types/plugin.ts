// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { PlayerPhase } from './player';
import type { Translations } from './translations';

/**
 * A plugin constructor carrying the static fields the kit reads at
 * registration time. Pass a class (not an instance) to `player.use()`,
 * `player.getPlugin()`, and `RequireSpec`.
 *
 * The constructor signature is `new (...args: never[]) => unknown` rather than
 * `new () => unknown` so that plugins with required constructor arguments (rare
 * but permitted) satisfy the constraint without widening the instance type.
 */
export type PluginCtorWithId = (new (...args: never[]) => unknown) & {
	readonly id: string;
	readonly version?: string;
	readonly description?: string;
	readonly minCoreVersion?: string;
	readonly requires?: ReadonlyArray<RequireSpec>;
	readonly replaces?: string;
	readonly priority?: number;
	readonly onError?: Readonly<Record<string, string>>;
	readonly advisories?: ReadonlyArray<PluginAdvisory>;
	readonly translations?: Translations;
};

/**
 * Plugin dependency declaration used in `static requires`. Class refs are the
 * canonical form — type-safe, refactor-safe, and consistent with the typed
 * `getPlugin(PluginClass)` API.
 *
 * Plain class ref means the dep is required:
 *
 * ```ts
 * static readonly requires = [AudioGraphPlugin, CanvasPlugin];
 * ```
 *
 * Object form lets a plugin mark a dep optional or pin a minimum version:
 *
 * ```ts
 * static readonly requires = [
 *   AudioGraphPlugin,
 *   { plugin: MediaSessionPlugin, optional: true },
 *   { plugin: SpectrumPlugin, minVersion: '2.1.0' },
 * ];
 * ```
 *
 * At registration, required-missing throws `core:plugin/missing-dep`;
 * optional-missing logs a debug warning and the dependent plugin runs anyway.
 * Version mismatch throws `core:plugin/version-mismatch`.
 */
export type RequireSpec
	= | PluginCtorWithId
		| { plugin: PluginCtorWithId; optional?: boolean; minVersion?: string };

/**
 * Declarative plugin registration used in `BasePlayerConfig.plugins`. Same
 * class-ref-or-object shape as `RequireSpec` — a plain class ref registers
 * with no constructor options, the object form pairs the class with `opts`.
 *
 * ```ts
 * nmplayer('player').setup({
 *   plugins: [
 *     DesktopUiPlugin,
 *     { plugin: SubtitleOverlayPlugin, opts: { fontScale: 1.2 } },
 *   ],
 *   playlist: [...],
 * });
 * ```
 *
 * Registered in array order through the exact same `addPlugin()` path a
 * consumer calling it manually before `setup()` would use — same
 * `core:plugin/duplicate-id` / `core:plugin/missing-dep` /
 * `core:plugin/version-mismatch` / `core:plugin/incompatible-core-version`
 * validation, same pre-setup `pluginsRegistering` timing. This is sugar over
 * that call, not a second registration path — `requires`/`replaces` between a
 * config-declared plugin and a manually-`addPlugin`'d one resolve identically
 * regardless of which route added which.
 */
export type PluginSpec
	= | PluginCtorWithId
		| { plugin: PluginCtorWithId; opts?: unknown };

/**
 * Declarative advisory — `static advisories` on a Plugin class. Lets plugins
 * declare invariants ("this method during this context is risky") without
 * writing handler code. At registration, the player merges every plugin's
 * advisories into a lookup; matching advisories auto-fire their severity
 * event when the corresponding mutation happens.
 *
 * A match requires every specified condition to hold:
 *  - `duringPhase` (if set) must include the current `player.phase()`
 *  - `duringEvent` (if set) must include the currently-dispatching event name
 *
 * If neither is set, the advisory matches any time the method is called.
 */
export interface PluginAdvisory {
	/** The mutating method this advisory watches (e.g. `'setCurrent'`, `'volume'`). */
	method: string;
	/** Coarse playback phase(s) that trigger the advisory. Optional — omit to match any phase. */
	duringPhase?: PlayerPhase | ReadonlyArray<PlayerPhase>;
	/**
	 * Event name(s) whose dispatch must be in flight for the advisory to match.
	 * Use this to advise specifically inside a `before*` handler — works for
	 * core events AND plugin-defined custom events.
	 *
	 * Example: `duringEvent: 'beforePlay'` matches mutations inside a beforePlay
	 * handler. `duringEvent: 'plugin:my-plugin:beforeFoo'` matches mutations
	 * inside another plugin's custom before-event handler.
	 */
	duringEvent?: string | ReadonlyArray<string>;
	/** Severity tier — controls which event channel the advisory fires on. */
	severity: 'info' | 'warning' | 'error';
	/** Short slug for the error code suffix. Final code: `plugin:<plugin-id>/<reason>`. */
	reason: string;
	/** Human-readable message shown to consumers / devtools. */
	message: string;
}
