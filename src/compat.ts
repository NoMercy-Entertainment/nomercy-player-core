// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * @module @nomercy-entertainment/nomercy-player-core/compat
 *
 * v1 compatibility shim for `BasePlayerConfig`. All deprecated fields live
 * here, each annotated with `@deprecated` pointing to the v2 replacement.
 * A runtime normalizer (`applyKitV1Compat`) maps legacy fields onto the
 * canonical v2 shape before the config is passed to `setup()`.
 *
 * v1 consumers import from `./compat` and pass their config through
 * `applyKitV1Compat` once:
 *
 * ```ts
 * import { applyKitV1Compat } from '@nomercy-entertainment/nomercy-player-core/compat';
 * player.setup(applyKitV1Compat({ accessToken: () => store.token, debug: true, ... }));
 * ```
 */

import type { AuthHeaderValue, BasePlayerConfig } from './types';
import type { LogLevel } from './types/log';

/**
 * Deprecated top-level config fields from v1. Only consumed here in the compat
 * shim — they do not appear on `BasePlayerConfig`.
 */
export interface BasePlayerConfigV1Compat extends BasePlayerConfig {
	/**
	 * @deprecated Use `auth.bearerToken` instead.
	 * Maps to `auth.bearerToken` at setup time. When both are set, `auth.bearerToken` wins.
	 */
	accessToken?: AuthHeaderValue;

	/**
	 * @deprecated Use `logLevel: 'debug'` instead.
	 * Maps to `logLevel: 'debug'` when `true` and `logLevel` is not already set.
	 */
	debug?: boolean;
}

/**
 * Normalise a v1 config object to the canonical v2 `BasePlayerConfig` shape.
 * Safe to call on a config that is already v2-clean — all mappings are
 * additive and conditional (existing v2 values always win).
 *
 * Mutates a shallow copy; the original is untouched.
 */
export function applyKitV1Compat<T extends BasePlayerConfigV1Compat>(config: T): Omit<T, 'debug' | 'accessToken'> & BasePlayerConfig {
	// Cast through unknown to get a mutable record we can delete from without
	// fighting the index-signature constraint on BasePlayerConfig.
	const result = { ...config } as unknown as BasePlayerConfig & Record<string, unknown>;

	// debug → logLevel
	if (config.debug === true) {
		if (result.logLevel === undefined) {
			result.logLevel = 'debug' satisfies LogLevel;
		}
	}

	// accessToken → auth.bearerToken
	const legacyToken = config.accessToken;
	if (legacyToken !== undefined) {
		const existing = result.auth ?? {};
		if (existing.bearerToken === undefined) {
			result.auth = {
				...existing,
				bearerToken: legacyToken,
			};
		}
	}

	// Strip the deprecated fields from the output so they don't bleed into
	// the player's normalizer a second time.
	delete result['debug'];
	delete result['accessToken'];

	return result as Omit<T, 'debug' | 'accessToken'> & BasePlayerConfig;
}
