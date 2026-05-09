import type { BaseEventMap, IPlayer } from '../types';
import { Plugin } from '../plugin';

/** Options for {@link TabLeaderPlugin}. */
export interface TabLeaderOptions {
	/** Action to take when this tab loses leadership. Default: 'pause'. */
	onLost?: 'pause' | 'mute';
	/** When the tab becomes visible, request leader handoff. Default: true. */
	handoffOnVisible?: boolean;
	/** Override the lock-key generation (default: per-player config + serverId). */
	getLockKey?: () => string;
}

/** Events emitted by {@link TabLeaderPlugin}. */
export interface TabLeaderEvents {
	'leader-acquired': void;
	'leader-released': void;
	'leader-lost': { reason: 'visibility' | 'request' | 'browser' };
	'leader-requested': void;
	'unsupported': void;
	[key: string]: unknown;
}

const DEFAULT_LOCK_KEY = 'nomercy-player-leader';

/**
 * Cross-tab leader election via the Web Locks API. Only one tab on the same
 * origin holds the lock for a given key — non-leader tabs pause/mute themselves
 * on `play()`. Closing or reloading the leader tab releases the lock immediately.
 */
export class TabLeaderPlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, TabLeaderOptions, TabLeaderEvents> {
	static override readonly id: string = 'tab-leader';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'Web Locks-based cross-tab leader election so only one tab plays at a time';

	private _isLeader: boolean = false;
	/** Resolves the held-lock callback so the lock auto-releases. */
	private _release: (() => void) | null = null;
	/** Outstanding acquire promise — used to detect the active election. */
	private _pending: Promise<void> | null = null;

	/** Checks Web Locks support and initiates the leader-lock request. */
	override use(): void {
		if (!this._supported()) {
			this.emit('unsupported' as keyof TabLeaderEvents);
			return;
		}
		void this.requestLock();
	}

	/** Voluntarily releases the leader lock so another tab may take over. */
	override dispose(): void {
		// Manual release on dispose is a courtesy — Web Locks auto-release on
		// page close. Lifecycle registry handles other cleanup.
		this.releaseLock();
	}

	/** True if this tab currently holds the leader lock. */
	isLeader(): boolean {
		return this._isLeader;
	}

	/**
	 * Attempt to acquire the leader lock now. Resolves once the lock-acquire
	 *  callback has fired (or immediately if Web Locks aren't supported).
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
		// The acquire callback holds the lock until its returned promise resolves;
		// we wire that promise to a manual `_release` resolver so `releaseLock()`
		// can let go without ending the election callback chain.
		this._pending = locks.request(key, () => {
			this._isLeader = true;
			this.emit('leader-acquired' as keyof TabLeaderEvents);
			return new Promise<void>((resolve) => {
				this._release = resolve;
			});
		}).then(
			() => {
				// Lock callback finished → we are no longer leader.
				this._pending = null;
			},
			(_err) => {
				this._pending = null;
			},
		);

		return this._pending;
	}

	/**
	 * Backwards-compatible alias matching the original stub. Returns true when
	 * leadership is held after the attempt.
	 */
	requestLeadership(): Promise<boolean> {
		return this.requestLock().then(() => this._isLeader);
	}

	/** Release the leader lock voluntarily — other tabs may take over. */
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

	/** Backwards-compatible alias matching the original stub. */
	releaseLeadership(): void {
		this.releaseLock();
	}

	/** Subclass override hook — return the per-player lock key. */
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
