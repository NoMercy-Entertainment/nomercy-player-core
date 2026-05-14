import type { PlayerExperimental } from '../../types';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: experimental override surface (descriptor with a getter)
// ──────────────────────────────────────────────────────────────────────────

export const experimentalDescriptor = {
	/**
	 * Tier-4 runtime override surface. Returns an object whose `override` /
	 * `restore` / `overrides` methods let consumers (and plugins) monkey-patch
	 * player methods without replacing the prototype. See `PlayerExperimental`
	 * for the full contract.
	 */
	get experimental(): PlayerExperimental {
		const self = this as unknown as Internals;
		const overrides = self._overrides;
		const player: Record<string, unknown> = self as unknown as Record<string, unknown>;
		const getOriginals = (): Map<string, ((...args: unknown[]) => unknown) | undefined> => {
			let originals = self._overrideOriginals;
			if (!originals) {
				originals = new Map<string, ((...args: unknown[]) => unknown) | undefined>();
				self._overrideOriginals = originals;
			}
			return originals;
		};
		const restoreInstanceMethod = (method: string): void => {
			const originals = getOriginals();
			const orig = originals.get(method);
			if (orig) {
				Object.defineProperty(player, method, {
					value: orig,
					writable: true,
					configurable: true,
				});
			}
			else {
				delete player[method];
			}
			originals.delete(method);
		};
		return {
			/**
			 * Temporarily replace a player method with a custom implementation.
			 * The original (mixin-installed) method is captured on first call and
			 * restored automatically when the returned disposer is invoked. Multiple
			 * overrides of the same method overwrite each other — the last writer
			 * wins. Calling the disposer removes the override and restores the
			 * captured original without affecting any other overrides.
			 *
			 * Returns a zero-arg disposer. Call it to undo the override.
			 */
			override: <K extends string>(method: K, fn: (...args: unknown[]) => unknown): (() => void) => {
				const originals = getOriginals();
				if (!originals.has(method)) {
					// Resolve original via the prototype chain so we capture the
					// mixin-installed method. If the instance already owns the
					// property (unlikely for kit-composed methods), we still capture
					// whatever `player[method]` resolves to today.
					const raw: unknown = player[method];
					const typed: ((...args: unknown[]) => unknown) | undefined = typeof raw === 'function' ? raw as (...args: unknown[]) => unknown : undefined;
					originals.set(method, typed);
				}
				overrides.set(method, {
					fn,
					by: 'consumer',
				});
				Object.defineProperty(player, method, {
					value: (...args: unknown[]) => {
						const entry = overrides.get(method);
						if (entry)
							return entry.fn.apply(self, args);
						const orig = getOriginals().get(method);
						return orig?.apply(self, args);
					},
					writable: true,
					configurable: true,
				});
				return () => {
					if (overrides.get(method)?.fn === fn) {
						overrides.delete(method);
						restoreInstanceMethod(method);
					}
				};
			},
			/**
			 * Remove the active override for `method` and restore the original
			 * implementation. No-op when the method has no active override.
			 */
			restore: (method: string): void => {
				if (!overrides.has(method))
					return;
				overrides.delete(method);
				restoreInstanceMethod(method);
			},
			/** Snapshot of all active overrides. Each entry names the method and which layer installed it. */
			overrides: (): Array<{ method: string; by: string | 'consumer' }> => {
				return Array.from(overrides.entries()).map(([method, { by }]) => ({
					method,
					by,
				}));
			},
		};
	},
};
