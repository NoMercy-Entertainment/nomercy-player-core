/**
 * Compose mixin objects onto a class prototype. Used to glue per-feature
 * mixin modules onto a Player subclass.
 *
 * Usage:
 *
 * ```ts
 * import { coreMethods } from './player/core';
 * import { playbackMethods } from './player/playback';
 *
 * composeMixins(MyPlayer.prototype, coreMethods, playbackMethods);
 * ```
 *
 * Same semantics as `Object.assign`: later mixins override earlier ones on key
 * collision. Getters/setters are copied via descriptors rather than triggered.
 */
export function composeMixins<T extends object>(prototype: T, ...modules: object[]): void {
	for (const module of modules) {
		// Use Object.getOwnPropertyDescriptors so we copy getters/setters as-is
		// rather than triggering them during the assign.
		const descriptors = Object.getOwnPropertyDescriptors(module);
		for (const [key, descriptor] of Object.entries(descriptors)) {
			Object.defineProperty(prototype, key, descriptor);
		}
	}
}
