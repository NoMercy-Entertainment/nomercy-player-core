// Barrel — re-exports every public name from the plugin concern split.
// Internal consumers that import `from './plugin'` or `from '../plugin'` resolve
// here; the public `src/index.ts` re-exports from here so the kit's external API
// surface stays identical.

export type { AnyPluginCtor, PlayerEventMap, PluginEventMap } from './base';
export { Plugin, PluginThrow } from './base';

export type { BeforeDispatchResult, DispatchBeforeOptions } from './dispatch';

export type { FetchOptions } from './fetch';

export type { PluginState } from './lifecycle';

export type { PluginRecoveryAction, ThrowPayload } from './throw';
