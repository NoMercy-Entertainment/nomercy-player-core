import { PluginError } from '../../errors';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mutation guard helpers shared by volume, queue mixins.
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

/**
 * Synchronously dispatch `beforeMutation` for a mutation method. Returns true
 * if the mutation should proceed, false if a listener cancelled it (in which
 * case `mutationPrevented` was emitted by this helper). Async `delay()` is
 * NOT supported here — mutations are sync by spec and dispatchBefore's full
 * async contract only applies to transport `before*` events.
 *
 * Also auto-fires every `static advisories` entry that matches the method +
 * current phase + currently-dispatching event names. Advisories surface as
 * `info`/`warning`/`error` events with code `plugin:<plugin-id>/<reason>`.
 */
export function emitBeforeMutation(self: Internals, method: string, args: ReadonlyArray<unknown>): boolean {
	if (!_shouldGuardMutation(self, method))
		return true;

	let prevented = false;
	const evt = {
		get data() {
			return {
				method,
				args,
				phase: self._phase,
				dispatchStack: [...self._dispatchStack],
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

	const listeners = self.listenersOf('beforeMutation');
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

	// Spec §C: auto-fire matching advisories. Walk every registered plugin's
	// `static advisories`, match on (method, duringPhase, duringEvent), and
	// emit on the matching severity channel.
	for (const { instance, ctor } of self._plugins) {
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
				if (!phases.includes(self._phase))
					continue;
			}
			if (advisory.duringEvent !== undefined) {
				const events = Array.isArray(advisory.duringEvent) ? advisory.duringEvent : [advisory.duringEvent];
				const inFlight = self._dispatchStack;
				if (!events.some(eventName => inFlight.includes(eventName)))
					continue;
			}
			const code = `plugin:${ctor.id}/${advisory.reason}`;
			const errorPayload = {
				error: new PluginError({
					code,
					severity: advisory.severity,
					scope: {
						kind: 'plugin',
						id: ctor.id,
					},
					message: advisory.message,
					context: {
						method,
						args,
						phase: self._phase,
					},
				}),
				severity: advisory.severity,
				scope: {
					kind: 'plugin',
					id: ctor.id,
				},
				timestamp: Date.now(),
				markHandled: () => {},
				isHandled: () => false,
				stopImmediatePropagation: () => {},
				isPropagationStopped: () => false,
				preventDefault: () => {},
				isDefaultPrevented: () => false,
			};
			self.emit(advisory.severity, errorPayload);
		}
	}

	if (prevented) {
		self.emit('mutationPrevented', {
			method,
			reason: 'listener-prevented',
		});
		return false;
	}
	return true;
}
