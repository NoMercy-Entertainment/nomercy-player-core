// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * `runDispatchBefore` direct contract — the shared `before*` dispatcher used
 * by both the transport mixins and `Plugin.dispatchBefore`. The plugin-facing
 * wrapper is covered in plugin.test.ts; these tests pin the dispatcher's own
 * contract against a plain `DispatchTarget` (the documented unit-test form).
 *
 * Test groups:
 *  - bare targets — optional listenersOf / pushDispatch / popDispatch
 *  - listener ordering + cross-listener data visibility
 *  - prevented outcomes — reason and cause carriage
 *  - delay gates — settle, rejection, timeout
 *  - dispatch-stack bookkeeping
 *  - throwing listeners are isolated
 */

import type { BeforeDispatchOutcome, DispatchTarget } from '../core/dispatch';
import type { BeforeEvent } from '../types';
import { describe, expect, it, vi } from 'vitest';
import { runDispatchBefore } from '../core/dispatch';

function targetWithListeners(
	listeners: Array<(data: unknown) => void>,
): DispatchTarget & { pushed: string[]; popped: number } {
	const record = {
		pushed: [] as string[],
		popped: 0,
	};
	return {
		listenersOf: () => listeners,
		pushDispatch: (name: string) => {
			record.pushed.push(name);
		},
		popDispatch: () => {
			record.popped += 1;
			return record.pushed[record.pushed.length - 1];
		},
		get pushed() {
			return record.pushed;
		},
		get popped() {
			return record.popped;
		},
	};
}

describe('runDispatchBefore()', () => {
	describe('bare targets', () => {
		it('resolves un-prevented against a completely empty target', async () => {
			const outcome = await runDispatchBefore({}, 'beforeThing', { value: 1 });
			expect(outcome).toEqual({
				data: { value: 1 },
				prevented: false,
			});
		});

		it('returns the initial data unchanged when there are no listeners', async () => {
			const data = { value: 7 };
			const outcome = await runDispatchBefore({ listenersOf: () => [] }, 'beforeThing', data);
			expect(outcome.data).toBe(data);
			expect(outcome.prevented).toBe(false);
		});
	});

	describe('listener ordering and data visibility', () => {
		it('calls listeners in insertion order', async () => {
			const order: string[] = [];
			const target = targetWithListeners([
				() => order.push('first'),
				() => order.push('second'),
				() => order.push('third'),
			]);

			await runDispatchBefore(target, 'beforeThing', {});

			expect(order).toEqual([
				'first',
				'second',
				'third',
			]);
		});

		it('a later listener sees an earlier listener\'s data mutation', async () => {
			const seenBysecond: number[] = [];
			const target = targetWithListeners([
				(event) => {
					(event as BeforeEvent<{ value: number }>).data = { value: 99 };
				},
				(event) => {
					seenBysecond.push((event as BeforeEvent<{ value: number }>).data.value);
				},
			]);

			await runDispatchBefore(target, 'beforeThing', { value: 1 });

			expect(seenBysecond).toEqual([99]);
		});

		it('the caller receives the mutated data in the outcome', async () => {
			const target = targetWithListeners([
				(event) => {
					(event as BeforeEvent<{ value: number }>).data = { value: 42 };
				},
			]);

			const outcome = await runDispatchBefore(target, 'beforeThing', { value: 1 });

			expect(outcome.data).toEqual({ value: 42 });
			expect(outcome.prevented).toBe(false);
		});

		it('stopImmediatePropagation() skips the remaining listeners', async () => {
			const secondListener = vi.fn();
			const target = targetWithListeners([
				(event) => {
					(event as BeforeEvent<unknown>).stopImmediatePropagation();
				},
				secondListener,
			]);

			const outcome = await runDispatchBefore(target, 'beforeThing', {});

			expect(secondListener).not.toHaveBeenCalled();
			expect(outcome.prevented).toBe(false);
		});
	});

	describe('prevented outcomes carry reason and cause', () => {
		it('preventDefault() yields reason "listener-prevented" without a cause', async () => {
			const target = targetWithListeners([
				(event) => {
					(event as BeforeEvent<unknown>).preventDefault();
				},
			]);

			const outcome = await runDispatchBefore(target, 'beforeThing', {});

			expect(outcome.prevented).toBe(true);
			expect(outcome.reason).toBe('listener-prevented');
			expect(outcome.cause).toBeUndefined();
		});

		it('a prevented outcome still returns the mutated data', async () => {
			const target = targetWithListeners([
				(event) => {
					const beforeEvent = event as BeforeEvent<{ value: number }>;
					beforeEvent.data = { value: 5 };
					beforeEvent.preventDefault();
				},
			]);

			const outcome = await runDispatchBefore(target, 'beforeThing', { value: 1 });

			expect(outcome.prevented).toBe(true);
			expect(outcome.data).toEqual({ value: 5 });
		});

		it('a rejected delay yields reason "delay-rejected" and carries the rejection as cause', async () => {
			const rejection = new Error('gate failed');
			const target = targetWithListeners([
				(event) => {
					(event as BeforeEvent<unknown>).delay(Promise.reject(rejection));
				},
			]);

			const outcome = await runDispatchBefore(target, 'beforeThing', {});

			expect(outcome.prevented).toBe(true);
			expect(outcome.reason).toBe('delay-rejected');
			expect(outcome.cause).toBe(rejection);
		});

		it('an overrunning delay yields reason "delay-timeout"', async () => {
			const neverSettles = new Promise<void>(() => {});
			const target = targetWithListeners([
				(event) => {
					(event as BeforeEvent<unknown>).delay(neverSettles);
				},
			]);

			const outcome = await runDispatchBefore(target, 'beforeThing', {}, { timeoutMs: 20 });

			expect(outcome.prevented).toBe(true);
			expect(outcome.reason).toBe('delay-timeout');
			expect(outcome.cause).toBeUndefined();
		});
	});

	describe('delay gates', () => {
		it('waits for every delay to settle before resolving', async () => {
			let resolveFirst: (() => void) | undefined;
			let resolveSecond: (() => void) | undefined;
			const firstGate = new Promise<void>((resolve) => {
				resolveFirst = resolve;
			});
			const secondGate = new Promise<void>((resolve) => {
				resolveSecond = resolve;
			});
			const target = targetWithListeners([
				(event) => {
					const beforeEvent = event as BeforeEvent<unknown>;
					beforeEvent.delay(firstGate);
					beforeEvent.delay(secondGate);
				},
			]);

			let settled: BeforeDispatchOutcome<Record<string, never>> | undefined;
			const pending = runDispatchBefore(target, 'beforeThing', {} as Record<string, never>).then((outcome) => {
				settled = outcome;
				return outcome;
			});

			await new Promise(resolve => setTimeout(resolve, 5));
			expect(settled).toBeUndefined();

			resolveFirst!();
			await new Promise(resolve => setTimeout(resolve, 5));
			expect(settled).toBeUndefined();

			resolveSecond!();
			await pending;
			expect(settled?.prevented).toBe(false);
		});

		it('exposes isDelayed() to listeners once a delay is registered', async () => {
			const observed: boolean[] = [];
			const target = targetWithListeners([
				(event) => {
					const beforeEvent = event as BeforeEvent<unknown>;
					observed.push(beforeEvent.isDelayed());
					beforeEvent.delay(Promise.resolve());
					observed.push(beforeEvent.isDelayed());
				},
			]);

			await runDispatchBefore(target, 'beforeThing', {});

			expect(observed).toEqual([false, true]);
		});
	});

	describe('dispatch-stack bookkeeping', () => {
		it('pushes the event name before listeners run and pops after', async () => {
			const stackDuringListener: string[] = [];
			const target = targetWithListeners([
				() => {
					stackDuringListener.push('ran');
				},
			]);

			await runDispatchBefore(target, 'beforePlay', {});

			expect(target.pushed).toEqual(['beforePlay']);
			expect(target.popped).toBe(1);
			expect(stackDuringListener).toEqual(['ran']);
		});

		it('pops the stack on the timeout path too', async () => {
			const target = targetWithListeners([
				(event) => {
					(event as BeforeEvent<unknown>).delay(new Promise<void>(() => {}));
				},
			]);

			await runDispatchBefore(target, 'beforePlay', {}, { timeoutMs: 10 });

			expect(target.popped).toBe(1);
		});
	});

	describe('throwing listeners', () => {
		it('logs the throw and keeps running the remaining listeners', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const secondListener = vi.fn();
			const target = targetWithListeners([
				() => {
					throw new Error('listener boom');
				},
				secondListener,
			]);

			const outcome = await runDispatchBefore(target, 'beforeThing', {});

			expect(secondListener).toHaveBeenCalledTimes(1);
			expect(outcome.prevented).toBe(false);
			expect(errorSpy).toHaveBeenCalledTimes(1);
			errorSpy.mockRestore();
		});
	});
});
