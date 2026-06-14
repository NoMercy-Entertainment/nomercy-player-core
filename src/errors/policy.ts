// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { PlayerError } from './player';

/**
 * Thrown when the browser's autoplay policy, permissions API, or a similar
 * browser-enforced restriction blocks an action. The `suggestion` field carries
 * a user-readable hint (e.g. "Tap anywhere to start playback.").
 * Codes follow `core:policy/<reason>`. Use `browserPolicyError()` to construct.
 */
export class BrowserPolicyError extends PlayerError {
	override readonly name = 'BrowserPolicyError';
}

/**
 * Construct a `BrowserPolicyError` scoped to the core with `severity: 'error'`.
 *
 * Use when the browser's autoplay policy, Permissions API, or a similar
 * browser-enforced restriction blocks an action. Pass `opts.suggestion` with a
 * present-tense user-facing hint — the UI layer is expected to display it.
 *
 * Code convention: `core:policy/<reason>` — e.g. `core:policy/autoplay-blocked`.
 */
export function browserPolicyError(
	code: string,
	message: string,
	opts?: {
		suggestion?: string;
		context?: Record<string, unknown>;
	},
): BrowserPolicyError {
	return new BrowserPolicyError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		suggestion: opts?.suggestion,
		context: opts?.context,
	});
}
