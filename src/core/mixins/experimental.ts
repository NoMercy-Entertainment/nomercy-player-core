import type { PlayerExperimental } from '../../types';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: experimental override surface (descriptor with a getter)
// ──────────────────────────────────────────────────────────────────────────

export const experimentalDescriptor = {
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
			restore: (method: string): void => {
				if (!overrides.has(method))
					return;
				overrides.delete(method);
				restoreInstanceMethod(method);
			},
			overrides: (): Array<{ method: string; by: string | 'consumer' }> => {
				return Array.from(overrides.entries()).map(([method, { by }]) => ({
					method,
					by,
				}));
			},
		};
	},
};
