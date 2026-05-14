import type { ActionOptions } from '../../types';

import type { Internals } from '../state';
import { resolveBackend } from '../util/backend';
import { assertReady, dispatchBefore } from '../util/guards';
import { transitionPhase } from '../util/phase';


// ──────────────────────────────────────────────────────────────────────────
// Seek helper — shared between forward/rewind/currentTime
// ──────────────────────────────────────────────────────────────────────────

/**
 * Wrap a synchronous seek action with a `seeking` phase round-trip. Per spec
 * §D, the player enters `seeking` while a seek is in flight and returns to
 * the prior phase (`playing` / `paused`) once resolved. With no real backend
 * the seek "resolves" immediately — when a backend lands, this helper grows
 * to await the backend's `seeked` callback.
 *
 * Phase transitions happen ONLY when the prior phase is `playing` or
 * `paused` — seeks during `setup`/`ready` (e.g. consumer pre-seeking before
 * play) skip the round-trip to avoid noisy `seeking` blips.
 */
export function seekingTransition(self: Internals, doSeek: () => void): void {
	const prior = self._phase;
	const shouldTransition = prior === 'playing' || prior === 'paused' || prior === 'starting';
	if (shouldTransition) {
		transitionPhase(self, 'seeking');
	}
	doSeek();
	if (shouldTransition) {
		transitionPhase(self, prior);
	}
}


// ──────────────────────────────────────────────────────────────────────────
// Mixin: transport
// ──────────────────────────────────────────────────────────────────────────

export const transportMethods = {
	async play(this: Internals, opts: ActionOptions = {}): Promise<void> {
		assertReady(this);
		const result = await dispatchBefore<ActionOptions>(this, 'beforePlay', { ...opts });
		if (result.prevented) {
			this.emit('playPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}
		this._playState = 'playing';
		if (this._phase === 'ready' || this._phase === 'paused') {
			transitionPhase(this, 'starting');
		}
		this.emit('play', result.data);

		await resolveBackend(this)?.play?.();
	},

	async pause(this: Internals, opts: ActionOptions = {}): Promise<void> {
		assertReady(this);
		const result = await dispatchBefore<ActionOptions>(this, 'beforePause', { ...opts });
		if (result.prevented) {
			this.emit('pausePrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}
		this._playState = 'paused';
		if (this._phase === 'playing' || this._phase === 'starting') {
			transitionPhase(this, 'paused');
		}
		this.emit('pause', result.data);

		resolveBackend(this)?.pause?.();
	},

	async stop(this: Internals, opts: ActionOptions = {}): Promise<void> {
		assertReady(this);
		const result = await dispatchBefore<ActionOptions>(this, 'beforeStop', { ...opts });
		if (result.prevented) {
			this.emit('stopPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}
		this._playState = 'stopped';
		transitionPhase(this, 'stopped');
		this.emit('stop', result.data);

		resolveBackend(this)?.stop?.();
	},

	async togglePlayback(this: Internals, opts?: ActionOptions): Promise<void> {
		assertReady(this);
		if (this._playState === 'playing')
			await this.pause(opts);
		else await this.play(opts);
	},

	async next(this: Internals, opts: ActionOptions = {}): Promise<void> {
		assertReady(this);
		const result = await dispatchBefore<ActionOptions>(this, 'beforeNext', { ...opts });
		if (result.prevented) {
			this.emit('nextPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}

		const nextItem = this._queueList.peekNext();
		if (!nextItem) {
			this.emit('queue:exhausted');
			return;
		}

		this.emit('next', result.data);

		await this.load(nextItem, { source: result.data?.source });
		void this.play({ source: result.data?.source });
	},

	async previous(this: Internals, opts: ActionOptions = {}): Promise<void> {
		assertReady(this);
		const result = await dispatchBefore<ActionOptions>(this, 'beforePrevious', { ...opts });
		if (result.prevented) {
			this.emit('previousPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}

		const prevItem = this._queueList.peekPrevious();
		if (!prevItem) {
			return;
		}

		this.emit('previous', result.data);

		await this.load(prevItem, { source: result.data?.source });
		void this.play({ source: result.data?.source });
	},

	async rewind(this: Internals, seconds = 5, opts: ActionOptions = {}): Promise<void> {
		assertReady(this);
		const result = await dispatchBefore<{ time: number; source?: string }>(this, 'beforeSeek', {
			time: -seconds,
			source: opts.source,
		});
		if (result.prevented) {
			this.emit('seekPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}
		seekingTransition(this, () => {
			this._internalCurrentTime = Math.max(0, this._internalCurrentTime - seconds);
			this.emit('seek', {
				time: this._internalCurrentTime,
				source: result.data.source,
			});
		});

		resolveBackend(this)?.currentTime?.(this._internalCurrentTime);

		this.emit('seeked', { time: this._internalCurrentTime });
	},

	async forward(this: Internals, seconds = 5, opts: ActionOptions = {}): Promise<void> {
		assertReady(this);
		const result = await dispatchBefore<{ time: number; source?: string }>(this, 'beforeSeek', {
			time: seconds,
			source: opts.source,
		});
		if (result.prevented) {
			this.emit('seekPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}
		seekingTransition(this, () => {
			this._internalCurrentTime = this._internalCurrentTime + seconds;
			this.emit('seek', {
				time: this._internalCurrentTime,
				source: result.data.source,
			});
		});

		resolveBackend(this)?.currentTime?.(this._internalCurrentTime);

		this.emit('seeked', { time: this._internalCurrentTime });
	},

	async restart(this: Internals, opts: ActionOptions = {}): Promise<void> {
		assertReady(this);
		const seekResult = await dispatchBefore<{ time: number; source?: string }>(this, 'beforeSeek', {
			time: 0,
			source: opts.source,
		});
		if (seekResult.prevented) {
			// If the seek-to-zero was cancelled, restart is also cancelled — emit
			// a `seekPrevented` event and bail; do NOT play unconditionally.
			this.emit('seekPrevented', {
				reason: seekResult.reason ?? 'listener-prevented',
				cause: seekResult.cause,
			});
			return;
		}
		seekingTransition(this, () => {
			this._internalCurrentTime = 0;
			this.emit('seek', {
				time: 0,
				source: seekResult.data.source,
			});
		});
		// Spec §P4-V1: emit `seeked` after the seek-to-zero settles.
		this.emit('seeked', { time: 0 });
		await this.play(opts);
	},
} as const;
