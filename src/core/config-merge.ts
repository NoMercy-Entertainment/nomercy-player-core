// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Deep-merges user config into defaults.
 *
 * Rules (in priority order):
 *   - `undefined` user value → fall through to default.
 *   - `null` user value → overwrite default (explicit null means the consumer chose null).
 *   - Plain object (not Array, not class instance, not Map/Set/Date) → recurse.
 *   - Array → replace (user wins; `[]` is an intentional empty array).
 *   - Function / class instance / Map / Set / Date → pass through (user wins).
 *   - Primitive → user wins.
 *
 * Return type is `T` — no `& Partial<T>` drift. Extra keys on `user` that are
 * not in `defaults` are preserved in the result.
 */
export function mergeConfig<T>(defaults: T, user?: Partial<T> | undefined): T {
	if (user === undefined || user === null) {
		return defaults;
	}

	if (!isPlainObject(defaults) || !isPlainObject(user)) {
		return (user as unknown as T) ?? defaults;
	}

	const result: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };

	for (const key of Object.keys(user as Record<string, unknown>)) {
		const userValue = (user as Record<string, unknown>)[key];
		const defaultValue = (defaults as Record<string, unknown>)[key];

		if (userValue === undefined) {
			continue;
		}

		if (userValue === null) {
			result[key] = null;
			continue;
		}

		if (isPlainObject(userValue) && isPlainObject(defaultValue)) {
			result[key] = mergeConfig(defaultValue, userValue as Partial<typeof defaultValue>);
			continue;
		}

		result[key] = userValue;
	}

	return result as T;
}

/** Returns true only for `{}` / `Object.create(null)` style objects — not Arrays, Dates, Maps, or class instances. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object') {
		return false;
	}

	if (Array.isArray(value)) {
		return false;
	}

	const proto = Object.getPrototypeOf(value);
	return proto === null || proto === Object.prototype;
}
