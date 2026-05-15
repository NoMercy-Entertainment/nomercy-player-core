/**
 * Tier-4 override namespace — last-resort surface for behaviour overrides not
 * covered by `before*` events, `static replaces`, or subclass hooks.
 *
 * The lint rule `nmplayer/no-experimental` flags any call from inside plugin
 * code. Authors must add `eslint-disable-next-line nmplayer/no-experimental`
 * with a written reason. Consumer (app) code is free to use it without lint
 * friction.
 *
 * Auto-restore: every override registers its caller (a plugin id, or
 * `'consumer'` if called from app code); when that plugin disposes, the
 * original method is restored automatically. Manual restore via the returned
 * unbinder or `experimental.restore`.
 *
 * Discoverable via `experimental.overrides()` so devtools / debug UIs can
 * surface which methods have been monkey-patched and by whom.
 */
export interface PlayerExperimental {
	override<K extends string>(method: K, fn: (...args: unknown[]) => unknown): () => void;
	restore(method: string): void;
	overrides(): Array<{ method: string; by: string | 'consumer' }>;
}
