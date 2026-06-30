// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { Severity } from './severity';

import { PlayerError } from './player';

/**
 * Thrown when a plugin operation fails — registration errors, missing deps,
 * version mismatches, or plugin-internal faults surfaced through `this.throw()`.
 * Scope is `{ kind: 'plugin', id: '<plugin-id>' }` when the plugin id is known.
 * Use `pluginError()` to construct.
 */
export class PluginError extends PlayerError {
	override readonly name = 'PluginError';
}

/**
 * Construct a `PluginError` with an explicit `pluginId` scope.
 *
 * When `opts.pluginId` is supplied the scope becomes
 * `{ kind: 'plugin', id: opts.pluginId }`; otherwise it falls back to
 * `{ kind: 'core' }` for kit-internal plugin-system errors (e.g. missing dep,
 * duplicate id). Severity defaults to `'error'` but can be lowered to `'warning'`
 * or `'info'` for non-fatal advisory conditions.
 *
 * Code convention: `<pluginId>:<area>/<reason>` — e.g. `lyrics:parse/bad-lrc`.
 */
export function pluginError(
	code: string,
	message: string,
	opts?: {
		severity?: Severity;
		pluginId?: string;
		context?: Record<string, unknown>;
	},
): PluginError {
	return new PluginError({
		code,
		severity: opts?.severity ?? 'error',
		scope: opts?.pluginId
			? {
					kind: 'plugin',
					id: opts.pluginId,
				}
			: { kind: 'core' },
		message: `${code}: ${message}`,
		context: opts?.context,
	});
}
