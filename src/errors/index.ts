// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Error framework — typed hierarchy, severity tiers, scoped events, retry
 * policy, structured plugin throws, code helpers.
 *
 * String codes (`core:auth/forbidden`, `fillz:viz/canvas-init-failed`) are the
 * universal identifier and always work. Numeric ids built via `makeCode({...})`
 * are supplementary and opt-in.
 */

export { DEFAULT_RETRY_POLICY } from '../adapters/retry-policy/default';
export type { IRetryPolicy, RetryConfig } from '../adapters/retry-policy/IRetryPolicy';

export { AuthError } from './auth';
export type { CodeFields, ErrorScope } from './code';

export {
	formatCode,
	makeCode,
	parseCode,
	VENDOR,
} from './code';
export { DrmError } from './drm';

export {
	MediaFormatError,
	mediaFormatError,
	ResourceError,
	resourceError,
	StreamError,
} from './media';

export { NetworkError } from './network';

export { NotImplementedError } from './not-implemented';

export type { PlayerErrorEvent, PlayerErrorInit } from './player';

export {
	makePlayerErrorEvent,
	PlayerError,
	StateError,
	stateError,
} from './player';

export { PluginError, pluginError } from './plugin';

export { BrowserPolicyError, browserPolicyError } from './policy';

export type { Severity } from './severity';
export { SEVERITY, SEVERITY_LEVEL } from './severity';
