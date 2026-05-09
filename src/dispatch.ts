/**
 * Shared `before*` event dispatcher used by BOTH the kit's transport mixins
 * AND `Plugin.dispatchBefore`. One implementation, one contract — no drift.
 *
 * Honours every `BeforeEvent<TData>` capability:
 *  - mutable `e.data`
 *  - `preventDefault()` / `isDefaultPrevented()`
 *  - `stopImmediatePropagation()` / `isPropagationStopped()`
 *  - `delay(promise)` — async gate; multiple delays compose via `Promise.allSettled`
 *  - timeout cap (default `beforeEventTimeoutMs` from BasePlayerConfig, override per call)
 *
 * The dispatcher pushes the event name onto the player's dispatch stack BEFORE
 * running listeners and pops it AFTER, so `player.dispatching()` accurately
 * reports nested dispatches across both kit and plugin paths.
 */

import type { BeforeEvent, PreventedReason } from './types';

/**
 * Result of a `dispatchBefore` call. The data field carries the (possibly
 * mutated) payload back to the caller; `prevented` tells the caller whether
 * to proceed with the default action.
 */
export interface BeforeDispatchOutcome<TData> {
	data: TData;
	prevented: boolean;
	reason?: PreventedReason;
	cause?: unknown;
}

/**
 * Minimal player surface used by the dispatcher. Both `BasePlayerCore` and the
 * `Plugin.dispatchBefore` site satisfy this without further coupling.
 */
export interface DispatchTarget {
	listenersOf?: (event: string) => ReadonlyArray<(data: unknown) => void>;
	pushDispatch?: (name: string) => void;
	popDispatch?: () => string | undefined;
}

export interface DispatchBeforeOpts {
	/** Cap on `delay()` waits before timing out. Default 10000ms. */
	timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Run the shared cancellable `before*` dispatch loop. Returns the outcome
 * after every listener has run AND every `delay()` promise has settled (or
 * timed out).
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

		// Async-gate on every delay() promise. One rejection or timeout
		// becomes a prevention.
		if (delayedPromises.length > 0) {
			let timedOut = false;
			let rejectedCause: unknown;
			let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
			const settled = await Promise.race([
				Promise.allSettled(delayedPromises).then((results) => {
					const first = results.find(r => r.status === 'rejected') as
						| PromiseRejectedResult
						| undefined;
					if (first)
						rejectedCause = first.reason;
					return 'settled' as const;
				}),
				new Promise<'timeout'>((resolve) => {
					timeoutHandle = setTimeout(() => {
						timedOut = true;
						resolve('timeout');
					}, timeoutMs);
				}),
			]);

			if (timeoutHandle)
				clearTimeout(timeoutHandle);
			void timedOut;

			if (settled === 'timeout') {
				return {
					data,
					prevented: true,
					reason: 'delay-timeout',
				};
			}
			if (rejectedCause !== undefined) {
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
