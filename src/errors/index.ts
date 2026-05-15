/**
 * Error framework — typed hierarchy, severity tiers, scoped events, retry
 * policy, structured plugin throws, code helpers.
 *
 * String codes (`core:auth/forbidden`, `fillz:viz/canvas-init-failed`) are the
 * universal identifier and always work. Numeric ids built via `makeCode({...})`
 * are supplementary and opt-in.
 */

export type { Severity } from './severity';
export { SEVERITY, SEVERITY_LEVEL } from './severity';

export type { ErrorScope, CodeFields } from './code';
export { makeCode, parseCode, formatCode, VENDOR } from './code';

export type { PlayerErrorInit, PlayerErrorEvent } from './player';
export { PlayerError, StateError, makePlayerErrorEvent, stateError } from './player';

export { NetworkError } from './network';

export { AuthError } from './auth';

export { MediaFormatError, StreamError, ResourceError, mediaFormatError, resourceError } from './media';

export { DrmError } from './drm';

export { BrowserPolicyError, browserPolicyError } from './policy';

export { PluginError, pluginError } from './plugin';

export type { RetryConfig, RetryPolicy } from './retry-policy';
export { DEFAULT_RETRY_POLICY } from './retry-policy';
