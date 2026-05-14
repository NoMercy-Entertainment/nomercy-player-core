import { makePlayerErrorEvent, pluginError } from '../../errors';

import type { PlayStateToken, RepeatStateToken, ShuffleStateToken, VolumeStateToken } from '../state';
import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mutation guard helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Hot-path mutations that skip `beforeMutation` by default — they fire too
 * often to be worth guarding unless the consumer opts in via
 * `setup({ mutationGuards: 'all' })` or names them in a string array.
 */
export const HOT_MUTATIONS: ReadonlyArray<string> = ['currentTime', 'volume', 'playbackRate', 'bandwidth', 'recordMetric'] as const;

/**
 * Decide whether a given mutation method should fire `beforeMutation` based on
 * `setup({ mutationGuards })` config:
 *   - `false`        → never fire (fast path)
 *   - `'all'`        → always fire
 *   - `string[]`     → fire for normal-list methods + named hot methods
 *   - `undefined`    → fire for normal-list methods, skip hot list (default)
 */
function _shouldGuardMutation(self: Internals, method: string): boolean {
	const cfg = self.options?.mutationGuards;
	if (cfg === false)
		return false;
	if (cfg === 'all')
		return true;
	const isHot = HOT_MUTATIONS.includes(method);
	if (Array.isArray(cfg)) {
		// Normal mutations always fire when config is a string[] (the array adds hot methods).
		if (!isHot)
			return true;
		return cfg.includes(method);
	}
	// Default: normal mutations fire, hot ones don't.
	return !isHot;
}


// ──────────────────────────────────────────────────────────────────────────
// Mixin: state-enum read accessors + mutation guard.
// Subclasses override only when they need to type the return value as the
// library's own enum.
// ──────────────────────────────────────────────────────────────────────────

export const stateMethods = {
	/**
	 * Return the current play-state token (`'playing'`, `'paused'`, `'stopped'`,
	 * …). Read-only snapshot — subscribe to `play` / `pause` / `stop` events to
	 * track changes reactively.
	 */
	playState(this: Internals): PlayStateToken {
		return this._playState;
	},

	/**
	 * Return the current volume-state token (`'unmuted'` or `'muted'`).
	 * Read-only snapshot — subscribe to `volume` / `mute` events to track
	 * changes reactively.
	 */
	volumeState(this: Internals): VolumeStateToken {
		return this._volumeState;
	},

	/**
	 * Read or write the repeat mode.
	 *
	 * `repeatState()` — returns the current `RepeatStateToken`
	 * (`'none'` / `'one'` / `'all'`).
	 *
	 * `repeatState(state)` — set the repeat mode and emit `repeat` with the
	 * new token. The transport mixin honours this token inside `next()` to
	 * decide whether to loop the current item or advance.
	 */
	repeatState(this: Internals, state?: RepeatStateToken): RepeatStateToken | void {
		if (state === undefined)
			return this._repeatState;
		this._repeatState = state;
		this.emit('repeat', { state });
	},

	/**
	 * Read or write the shuffle mode.
	 *
	 * `shuffleState()` — returns the current `ShuffleStateToken`
	 * (`'on'` / `'off'`).
	 *
	 * `shuffleState(state)` — accepts a `ShuffleStateToken` or a plain
	 * boolean (`true` → `'on'`, `false` → `'off'`). Emits `shuffle` with
	 * the normalised token.
	 */
	shuffleState(this: Internals, state?: ShuffleStateToken | boolean): ShuffleStateToken | void {
		if (state === undefined)
			return this._shuffleState;
		const next = typeof state === 'boolean' ? (state ? 'on' : 'off') : state;
		this._shuffleState = next;
		this.emit('shuffle', { state: next });
	},

	/**
	 * Synchronously dispatch `beforeMutation` for a mutation method. Returns
	 * `true` if the mutation should proceed, `false` if a listener cancelled it
	 * (in which case `mutationPrevented` was already emitted).
	 *
	 * The `delay()` hook on the event object is a no-op — mutations are
	 * synchronous. The async `delay()` contract only applies to transport
	 * `before*` events.
	 *
	 * Also walks every registered plugin's `static advisories` entries and fires
	 * matching ones as `info` / `warning` / `error` events. Matching criteria:
	 * the advisory's `method` equals `method`, `duringPhase` (if set) includes
	 * the current phase, and `duringEvent` (if set) overlaps the current
	 * dispatch stack.
	 */
	_emitBeforeMutation(this: Internals, method: string, args: ReadonlyArray<unknown>): boolean {
		if (!_shouldGuardMutation(this, method))
			return true;

		const player = this;
		let prevented = false;
		const evt = {
			get data() {
				return {
					method,
					args,
					phase: player._phase,
					dispatchStack: [...player._dispatchStack],
				};
			},
			set data(_value) { /* immutable for mutation events — args mutate via the method itself */ },
			preventDefault(): void { prevented = true; },
			isDefaultPrevented(): boolean { return prevented; },
			stopImmediatePropagation(): void { /* no-op for mutation guards */ },
			isPropagationStopped(): boolean { return false; },
			delay(): void { /* sync-only — delay is ignored for mutation events */ },
			isDelayed(): boolean { return false; },
		};

		const listeners = this.listenersOf('beforeMutation');
		for (const fn of listeners) {
			try {
				fn(evt);
			}
			catch (err) {
				if (typeof console !== 'undefined' && console.error) {
					console.error(`[beforeMutation:${method}] listener threw:`, err);
				}
			}
		}

		// Walk advisories for all enabled plugins.
		for (const { instance, ctor } of this._plugins) {
			if (!instance.enabled())
				continue;
			const advisories = ctor.advisories;
			if (!advisories)
				continue;
			for (const advisory of advisories) {
				if (advisory.method !== method)
					continue;
				if (advisory.duringPhase !== undefined) {
					const phases = Array.isArray(advisory.duringPhase) ? advisory.duringPhase : [advisory.duringPhase];
					if (!phases.includes(this._phase))
						continue;
				}
				if (advisory.duringEvent !== undefined) {
					const events = Array.isArray(advisory.duringEvent) ? advisory.duringEvent : [advisory.duringEvent];
					const inFlight = this._dispatchStack;
					if (!events.some(eventName => inFlight.includes(eventName)))
						continue;
				}
				const code = `plugin:${ctor.id}/${advisory.reason}`;
				const error = pluginError(code, advisory.message, {
					severity: advisory.severity,
					pluginId: ctor.id,
					context: {
						method,
						args,
						phase: this._phase,
					},
				});
				this.emit(advisory.severity, makePlayerErrorEvent(
					error,
					advisory.severity,
					{ kind: 'plugin', id: ctor.id },
				));
			}
		}

		if (prevented) {
			this.emit('mutationPrevented', {
				method,
				reason: 'listener-prevented',
			});
			return false;
		}
		return true;
	},
} as const;
