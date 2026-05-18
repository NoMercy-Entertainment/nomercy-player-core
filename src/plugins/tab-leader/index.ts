import type { BaseEventMap, IPlayer } from '../../types';
import { Plugin } from '../../plugin';

/** Options for {@link TabLeaderPlugin}. */
export interface TabLeaderOptions {
	/**
	 * What to do when this tab loses leadership (another tab takes over).
	 *
	 * - `'pause'` — calls `player.pause()`. Default.
	 * - `'mute'` — calls `player.mute()` so audio is silenced but playback
	 *   continues (useful for background tabs that should keep buffering).
	 */
	onLost?: 'pause' | 'mute';

	/**
	 * When `true`, the tab attempts to reclaim leadership whenever it becomes
	 * visible (via `document.visibilitychange`). Default `true`.
	 */
	handoffOnVisible?: boolean;

	/**
	 * Override the lock key used for the Web Locks API election. The default
	 * key (`'nomercy-player-leader'`) is shared across all instances on the
	 * same origin — one tab plays at a time globally.
	 *
	 * Provide a function that returns a per-player or per-session key to scope
	 * leadership to a specific player or content item.
	 */
	getLockKey?: () => string;
}

/** Events emitted by {@link TabLeaderPlugin}. */
export interface TabLeaderEvents {
	/**
	 * Fired when this tab successfully acquires the leader lock and is now the
	 * only tab allowed to play.
	 */
	'leader-acquired': void;

	/**
	 * Fired when this tab voluntarily releases the lock — either via
	 * `releaseLock()` or when the plugin disposes.
	 */
	'leader-released': void;

	/**
	 * Fired when leadership is lost involuntarily.
	 *
	 * - `'visibility'` — a `visibilitychange` event triggered a handoff.
	 * - `'request'` — another tab called `requestLock()` while this tab held it.
	 * - `'browser'` — the browser released the lock (tab closed, navigated away,
	 *   or crashed).
	 */
	'leader-lost': { reason: 'visibility' | 'request' | 'browser' };

	/** Fired when `requestLock()` is called and a lock-acquire attempt begins. */
	'leader-requested': void;

	/**
	 * Fired when the Web Locks API is not available in the current environment.
	 * The plugin is a no-op in those environments — it does not enforce
	 * single-tab playback.
	 */
	'unsupported': void;

	[key: string]: unknown;
}

const DEFAULT_LOCK_KEY = 'nomercy-player-leader';

/**
 * Single-tab playback enforcer using the Web Locks API. Only one tab on the
 * same origin holds the named lock at a time. When a second tab calls
 * `requestLock()`, it queues behind the current holder; the browser hands the
 * lock over the moment the first tab releases it or is closed.
 *
 * **How it works:**
 * 1. On `use()`, the plugin calls `navigator.locks.request(key, callback)`.
 * 2. The browser gives the lock to the first requester. The callback resolves a
 *    manually-controlled promise so the plugin can release on demand.
 * 3. Non-leader tabs wait. When the leader tab closes or calls `releaseLock()`,
 *    the next queued tab's callback fires and it emits `leader-acquired`.
 *
 * **Environment support:** Web Locks (Safari 15.4+, Chrome 69+, Firefox 96+).
 * In environments without `navigator.locks` the plugin emits `unsupported` and
 * becomes a no-op — playback is unaffected.
 *
 * **Lock key scoping:** the default lock key is global to the origin. Pass
 * `opts.getLockKey` to scope it to a specific player, content item, or session:
 * ```ts
 * player.addPlugin(TabLeaderPlugin, {
 *   getLockKey: () => `nomercy-leader-${serverId}`,
 * });
 * ```
 *
 * **Typical usage:**
 * ```ts
 * const leader = player.getPlugin(TabLeaderPlugin);
 * if (leader.isLeader()) {
 *   // safe to play
 * }
 * player.on('plugin:tab-leader:leader-lost', () => player.pause());
 * ```
 */
export class TabLeaderPlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, TabLeaderOptions, TabLeaderEvents> {
	static override readonly id: string = 'tab-leader';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'Web Locks-based cross-tab leader election so only one tab plays at a time';

	private _isLeader: boolean = false;
	/** Resolves the held-lock callback so the lock auto-releases when called. */
	private _release: (() => void) | null = null;
	/** Outstanding acquire promise — guards against duplicate election calls. */
	private _pending: Promise<void> | null = null;

	/**
	 * Checks for Web Locks support and initiates the leader-lock request.
	 * Emits `plugin:tab-leader:unsupported` and returns silently in environments
	 * that do not support `navigator.locks`.
	 */
	override use(): void {
		if (!this._supported()) {
			this.emit('unsupported' as keyof TabLeaderEvents);
			return;
		}

		this.on(TabLeaderPlugin, 'leader-lost', (_data) => {
			const action = this.opts?.onLost ?? 'pause';
			const surface = this.player as unknown as { pause?: () => unknown; mute?: () => void };
			if (action === 'mute') {
				surface.mute?.();
			}
			else {
				void surface.pause?.();
			}
		});

		if (typeof document !== 'undefined') {
			this.listen(document, 'visibilitychange', () => {
				if (document.visibilityState === 'visible' && (this.opts?.handoffOnVisible !== false)) {
					void this.requestLock();
				}
			});
		}

		void this.requestLock();
	}

	/**
	 * Voluntarily releases the leader lock so another waiting tab can take over.
	 * Web Locks auto-release on page close, so this is a courtesy call — useful
	 * when you want to hand off immediately (e.g. the user navigates away within
	 * a SPA without unloading the page).
	 */
	override dispose(): void {
		this.releaseLock();
	}

	/** Returns `true` when this tab currently holds the leader lock. */
	isLeader(): boolean {
		return this._isLeader;
	}

	/**
	 * Request the leader lock. Resolves once the lock-acquire callback fires
	 * (which may be immediately if no other tab holds the lock, or after an
	 * unknown wait if another tab is the current leader).
	 *
	 * Calling `requestLock()` while an election is already in progress returns
	 * the existing pending promise rather than starting a second election.
	 *
	 * Emits `plugin:tab-leader:leader-acquired` when the lock is granted.
	 * No-ops and resolves immediately in environments without Web Locks support.
	 */
	requestLock(): Promise<void> {
		if (!this._supported()) {
			this.emit('unsupported' as keyof TabLeaderEvents);
			return Promise.resolve();
		}
		if (this._pending)
			return this._pending;

		const key = this.getLockKey();
		const locks = navigator.locks!;

		this._pending = locks.request(key, () => {
			this._isLeader = true;
			this.emit('leader-acquired' as keyof TabLeaderEvents);
			return new Promise<void>((resolve) => {
				this._release = resolve;
			});
		}).then(
			() => {
				this._pending = null;
			},
			(_err) => {
				this._pending = null;
			},
		);

		return this._pending;
	}

	/**
	 * Backwards-compatible alias. Returns `true` when leadership is held after
	 * the attempt resolves, `false` otherwise.
	 */
	requestLeadership(): Promise<boolean> {
		return this.requestLock().then(() => this._isLeader);
	}

	/**
	 * Voluntarily release the leader lock. Any tab waiting in the queue will
	 * receive the lock next.
	 *
	 * Emits `plugin:tab-leader:leader-released` when this tab was the leader.
	 * No-ops if this tab is not currently the leader.
	 */
	releaseLock(): void {
		if (!this._isLeader && !this._release)
			return;

		const wasLeader = this._isLeader;
		this._isLeader = false;
		const release = this._release;
		this._release = null;

		if (release) {
			try {
				release();
			}
			catch {
				// Resolver throws are harmless — swallow.
			}
		}

		if (wasLeader) {
			this.emit('leader-released' as keyof TabLeaderEvents);
		}
	}

	/** Backwards-compatible alias for `releaseLock()`. */
	releaseLeadership(): void {
		this.releaseLock();
	}

	/**
	 * Returns the lock key to use for the election. Calls `opts.getLockKey()`
	 * when provided; otherwise returns the default shared key
	 * `'nomercy-player-leader'`.
	 *
	 * Override in a subclass to derive the key from player configuration without
	 * requiring callers to pass a function.
	 */
	protected getLockKey(): string {
		const optHook = this.opts?.getLockKey;
		if (typeof optHook === 'function')
			return optHook();
		return DEFAULT_LOCK_KEY;
	}

	private _supported(): boolean {
		return typeof navigator !== 'undefined'
			&& 'locks' in navigator
			&& typeof navigator.locks?.request === 'function';
	}
}

/** Plugin alias for {@link TabLeaderPlugin}. Pass to `addPlugin(tabLeaderPlugin)`. */
export const tabLeaderPlugin = TabLeaderPlugin;
