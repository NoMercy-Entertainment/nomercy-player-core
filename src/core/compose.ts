// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Stamp mixin objects onto a class prototype, composing per-feature method
 * modules into a single player subclass without deep inheritance chains.
 *
 * Typical call site at the bottom of a player module:
 *
 * ```ts
 * import { coreMethods } from './player/core';
 * import { playbackMethods } from './player/playback';
 *
 * composeMixins(MyPlayer.prototype, coreMethods, playbackMethods);
 * ```
 *
 * **Collision order.** Later modules override earlier ones when two modules
 * export the same key, matching the left-to-right precedence of
 * `Object.assign`. List more specific modules after more general ones.
 *
 * **Getter / setter safety.** Properties are copied via
 * `Object.getOwnPropertyDescriptors` + `Object.defineProperty`, so accessors
 * land as accessors rather than being triggered during the copy.
 *
 * **Idempotency.** Calling `composeMixins` twice with the same module is safe —
 * the second call simply overwrites the first with identical descriptors.
 *
 * @param prototype  The class prototype to extend, e.g. `MyPlayer.prototype`.
 * @param modules    One or more plain objects whose own enumerable and
 *                   non-enumerable properties (including getters/setters) will
 *                   be copied onto `prototype`.
 */
export function composeMixins<T extends object>(prototype: T, ...modules: object[]): void {
	for (const module of modules) {
		const descriptors = Object.getOwnPropertyDescriptors(module);
		for (const [key, descriptor] of Object.entries(descriptors)) {
			Object.defineProperty(prototype, key, descriptor);
		}
	}
}
