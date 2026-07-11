// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Shared `before*` event dispatcher used by both the kit's transport mixins
 * and `Plugin.dispatchBefore`. One implementation, one contract — no drift.
 *
 * Every `BeforeEvent<TData>` capability is honoured:
 *  - mutable `e.data` — listeners can reshape the payload before the action runs
 *  - `preventDefault()` / `isDefaultPrevented()` — stop the default action
 *  - `stopImmediatePropagation()` / `isPropagationStopped()` — stop calling remaining listeners
 *  - `delay(promise)` — async gate; multiple delays compose via `Promise.allSettled`
 *  - timeout cap — default 10 000 ms, overridable per call via `DispatchBeforeOpts`
 *
 * The dispatcher pushes the event name onto the player's dispatch stack before
 * running listeners and pops it after, so `player.dispatching()` accurately
 * reports nested dispatches across both kit and plugin paths.
 */

import type { BeforeEvent, PreventedReason } from '../types';

/**
 * Returned by every `dispatchBefore` call.
 *
 * `data` carries the (possibly mutated) payload back to the caller — listeners
 * may have reshaped it via `e.data = ...` and the caller should use this value,
 * not the original.
 *
 * `prevented` is `true` when any listener called `preventDefault()`, when a
 * `delay()` promise rejected, or when the timeout elapsed. The caller should
 * abort the default action and not emit the post-event.
 *
 * `reason` and `cause` are present on prevented outcomes so the caller can
 * decide whether to surface an error or silently skip.
 */
export interface BeforeDispatchOutcome<TData> {
	data: TData;
	prevented: boolean;
	reason?: PreventedReason;
	cause?: unknown;
}

/**
 * Minimal player surface required by the dispatcher.
 *
 * Both `BasePlayerCore` and the `Plugin.dispatchBefore` call site satisfy this
 * shape without additional coupling. The optional fields let callers use the
 * dispatcher against a plain object in unit tests.
 */
export interface DispatchTarget {
	listenersOf?: (event: string) => ReadonlyArray<(data: unknown) => void>;
	pushDispatch?: (name: string) => void;
	popDispatch?: () => string | undefined;
}

/**
 * Per-call options for `runDispatchBefore`.
 */
export interface DispatchBeforeOpts {
	/**
	 * Maximum milliseconds to wait for all `delay()` promises to settle before
	 * treating the dispatch as timed out and returning a prevented outcome.
	 * Defaults to 10 000 ms.
	 */
	timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Run the cancellable `before*` dispatch loop for a named event.
 *
 * Call this before executing any user-visible state change that listeners
 * should be able to cancel or delay. The typical pattern inside a transport
 * mixin:
 *
 * ```ts
 * const outcome = await runDispatchBefore(this, 'beforePlay', { source });
 * if (outcome.prevented) return;
 * // proceed with the real action using outcome.data (listener may have mutated it)
 * ```
 *
 * **Listener iteration.** Every listener registered for `eventName` is called
 * in insertion order with a `BeforeEvent<TData>` object. If a listener calls
 * `stopImmediatePropagation()`, the remaining listeners are skipped. Exceptions
 * inside listeners are caught and logged to `console.error`; they do not
 * prevent subsequent listeners from running.
 *
 * **Async gates.** A listener may call `e.delay(promise)` to hold the action
 * until the promise settles. All delayed promises are awaited concurrently via
 * `Promise.allSettled`. If any promise rejects, the outcome is prevented with
 * `reason: 'delay-rejected'`. If the combined wait exceeds `timeoutMs`, the
 * outcome is prevented with `reason: 'delay-timeout'`.
 *
 * **Dispatch stack.** `target.pushDispatch` / `target.popDispatch` are called
 * around the entire loop (including the async wait) so `player.dispatching()`
 * reports the event name while any delayed async work is in-flight.
 *
 * @param target   The player or plugin host that owns the listener registry.
 * @param eventName  The `before*` event name, e.g. `'beforePlay'`.
 * @param initialData  Initial payload. Listeners may mutate this via `e.data`.
 * @param opts  Optional timeout override.
 * @returns  Outcome containing the (possibly mutated) data and a `prevented` flag.
 */
export async function runDispatchBefore<TData>(
	target: DispatchTarget,
	eventName: string,
	initialData: TData,
	opts?: DispatchBeforeOpts,
): Promise<BeforeDispatchOutcome<TData>> {
	const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	let data = initialData;
	let defaultPrevented = false;
	let propagationStopped = false;
	const delayedPromises: Promise<unknown>[] = [];
	let isDelayed = false;

	const beforeEvent: BeforeEvent<TData> = {
		get data(): TData { return data; },
		set data(value: TData) { data = value; },
		preventDefault(): void { defaultPrevented = true; },
		isDefaultPrevented(): boolean { return defaultPrevented; },
		stopImmediatePropagation(): void { propagationStopped = true; },
		isPropagationStopped(): boolean { return propagationStopped; },
		delay(promise: Promise<unknown>): void {
			isDelayed = true;
			delayedPromises.push(promise);
		},
		isDelayed(): boolean { return isDelayed; },
	};

	target.pushDispatch?.(eventName);

	try {
		const listeners = target.listenersOf?.(eventName) ?? [];

		for (const fn of listeners) {
			if (propagationStopped)
				break;
			try {
				fn(beforeEvent);
			}
			catch (err) {
				if (typeof console !== 'undefined' && console.error) {
					console.error(`[dispatchBefore:${eventName}] listener threw:`, err);
				}
			}
		}

		if (delayedPromises.length > 0) {
			let rejectedCause: unknown;
			let hasRejection = false;
			let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
			const settled = await Promise.race([
				Promise.allSettled(delayedPromises).then((results) => {
					const first = results.find(result => result.status === 'rejected') as
						| PromiseRejectedResult
						| undefined;
					if (first) {
						hasRejection = true;
						rejectedCause = first.reason;
					}
					return 'settled' as const;
				}),
				new Promise<'timeout'>((resolve) => {
					timeoutHandle = setTimeout(() => {
						resolve('timeout');
					}, timeoutMs);
				}),
			]);

			if (timeoutHandle)
				clearTimeout(timeoutHandle);

			if (settled === 'timeout') {
				return {
					data,
					prevented: true,
					reason: 'delay-timeout',
				};
			}
			if (hasRejection) {
				return {
					data,
					prevented: true,
					reason: 'delay-rejected',
					cause: rejectedCause,
				};
			}
		}

		if (defaultPrevented) {
			return {
				data,
				prevented: true,
				reason: 'listener-prevented',
			};
		}

		return {
			data,
			prevented: false,
		};
	}
	finally {
		target.popDispatch?.();
	}
}
