import type { ActionOptions } from '../../types';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: transport
// ──────────────────────────────────────────────────────────────────────────

export const transportMethods = {
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
	_seekingTransition(this: Internals, doSeek: () => void): void {
		const prior = this._phase;
		const shouldTransition = prior === 'playing' || prior === 'paused' || prior === 'starting';

		if (shouldTransition) {
			this._transitionPhase('seeking');
		}

		doSeek();

		if (shouldTransition) {
			this._transitionPhase(prior);
		}
	},

	async play(this: Internals, opts: ActionOptions = {}): Promise<void> {
		this._assertReady();
		const result = await this._dispatchBefore<ActionOptions>('beforePlay', { ...opts });
		if (result.prevented) {
			this.emit('playPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}
		this._playState = 'playing';
		if (this._phase === 'ready' || this._phase === 'paused') {
			this._transitionPhase('starting');
		}
		this.emit('play', result.data);

		await this._resolveBackend()?.play?.();
	},

	async pause(this: Internals, opts: ActionOptions = {}): Promise<void> {
		this._assertReady();
		const result = await this._dispatchBefore<ActionOptions>('beforePause', { ...opts });
		if (result.prevented) {
			this.emit('pausePrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}
		this._playState = 'paused';
		if (this._phase === 'playing' || this._phase === 'starting') {
			this._transitionPhase('paused');
		}
		this.emit('pause', result.data);

		this._resolveBackend()?.pause?.();
	},

	async stop(this: Internals, opts: ActionOptions = {}): Promise<void> {
		this._assertReady();
		const result = await this._dispatchBefore<ActionOptions>('beforeStop', { ...opts });
		if (result.prevented) {
			this.emit('stopPrevented', {
				reason: result.reason ?? 'listener-prevented',
				cause: result.cause,
			});
			return;
		}
		this._playState = 'stopped';
		this._transitionPhase('stopped');
		this.emit('stop', result.data);

		this._resolveBackend()?.stop?.();
	},

	async togglePlayback(this: Internals, opts?: ActionOptions): Promise<void> {
		this._assertReady();
		if (this._playState === 'playing')
			await this.pause(opts);
		else await this.play(opts);
	},

	async next(this: Internals, opts: ActionOptions = {}): Promise<void> {
		this._assertReady();
		const result = await this._dispatchBefore<ActionOptions>('beforeNext', { ...opts });
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
		this._assertReady();
		const result = await this._dispatchBefore<ActionOptions>('beforePrevious', { ...opts });
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
		this._assertReady();
		const result = await this._dispatchBefore<{ time: number; source?: string }>('beforeSeek', {
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
		this._seekingTransition(() => {
			this._internalCurrentTime = Math.max(0, this._internalCurrentTime - seconds);
			this.emit('seek', {
				time: this._internalCurrentTime,
				source: result.data.source,
			});
		});

		this._resolveBackend()?.currentTime?.(this._internalCurrentTime);

		this.emit('seeked', { time: this._internalCurrentTime });
	},

	async forward(this: Internals, seconds = 5, opts: ActionOptions = {}): Promise<void> {
		this._assertReady();
		const result = await this._dispatchBefore<{ time: number; source?: string }>('beforeSeek', {
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
		this._seekingTransition(() => {
			this._internalCurrentTime = this._internalCurrentTime + seconds;
			this.emit('seek', {
				time: this._internalCurrentTime,
				source: result.data.source,
			});
		});

		this._resolveBackend()?.currentTime?.(this._internalCurrentTime);

		this.emit('seeked', { time: this._internalCurrentTime });
	},

	async restart(this: Internals, opts: ActionOptions = {}): Promise<void> {
		this._assertReady();
		const seekResult = await this._dispatchBefore<{ time: number; source?: string }>('beforeSeek', {
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
		this._seekingTransition(() => {
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
