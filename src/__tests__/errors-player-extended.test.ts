// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended coverage for `src/errors/player.ts` — targets uncovered functions:
 *  - PlayerError.isHttp() — all centuries, non-numeric context, missing context
 *  - makePlayerErrorEvent() — all six methods + timestamp parameter
 *  - stateError() — with and without context
 */

import { describe, expect, it } from 'vitest';
import { makePlayerErrorEvent, PlayerError, StateError, stateError } from '../errors/player';

// ── PlayerError.isHttp() ──────────────────────────────────────────────────────

describe('PlayerError.isHttp()', () => {
	function makeError(httpStatus?: number): PlayerError {
		return new PlayerError({
			code: 'core:test/http',
			scope: { kind: 'core' },
			context: httpStatus !== undefined ? { httpStatus } : undefined,
		});
	}

	it('returns true for status 200 (2xx century)', () => {
		expect(makeError(200).isHttp(2)).toBe(true);
	});

	it('returns true for status 404 (4xx century)', () => {
		expect(makeError(404).isHttp(4)).toBe(true);
	});

	it('returns true for status 500 (5xx century)', () => {
		expect(makeError(500).isHttp(5)).toBe(true);
	});

	it('returns true for status 101 (1xx century)', () => {
		expect(makeError(101).isHttp(1)).toBe(true);
	});

	it('returns true for status 301 (3xx century)', () => {
		expect(makeError(301).isHttp(3)).toBe(true);
	});

	it('returns false when status is in a different century', () => {
		expect(makeError(404).isHttp(2)).toBe(false);
	});

	it('returns false when httpStatus is missing from context', () => {
		expect(makeError().isHttp(2)).toBe(false);
	});

	it('returns false when httpStatus is a string (not a number)', () => {
		const err = new PlayerError({
			code: 'test',
			scope: { kind: 'core' },
			context: { httpStatus: '200' as unknown as number },
		});
		expect(err.isHttp(2)).toBe(false);
	});

	it('returns false when context is undefined', () => {
		const err = new PlayerError({ code: 'test', scope: { kind: 'core' } });
		expect(err.isHttp(2)).toBe(false);
	});
});

// ── makePlayerErrorEvent() ────────────────────────────────────────────────────

describe('makePlayerErrorEvent()', () => {
	function makeEvent(): ReturnType<typeof makePlayerErrorEvent> {
		const err = new PlayerError({
			code: 'core:test',
			scope: { kind: 'core' },
		});
		return makePlayerErrorEvent(err, 'error', { kind: 'core' });
	}

	it('error field is the passed PlayerError', () => {
		const err = new PlayerError({ code: 'core:x', scope: { kind: 'core' } });
		const evt = makePlayerErrorEvent(err, 'error', { kind: 'core' });
		expect(evt.error).toBe(err);
	});

	it('severity field is set', () => {
		const evt = makeEvent();
		expect(evt.severity).toBe('error');
	});

	it('scope field is set', () => {
		const evt = makeEvent();
		expect(evt.scope).toEqual({ kind: 'core' });
	});

	it('timestamp defaults to approximately now', () => {
		const before = Date.now();
		const evt = makeEvent();
		const after = Date.now();
		expect(evt.timestamp).toBeGreaterThanOrEqual(before);
		expect(evt.timestamp).toBeLessThanOrEqual(after);
	});

	it('timestamp can be overridden', () => {
		const err = new PlayerError({ code: 'test', scope: { kind: 'core' } });
		const evt = makePlayerErrorEvent(err, 'warning', { kind: 'core' }, 12345);
		expect(evt.timestamp).toBe(12345);
	});

	describe('markHandled()', () => {
		it('isHandled() starts false', () => {
			expect(makeEvent().isHandled()).toBe(false);
		});

		it('isHandled() returns true after markHandled()', () => {
			const evt = makeEvent();
			evt.markHandled();
			expect(evt.isHandled()).toBe(true);
		});
	});

	describe('stopImmediatePropagation()', () => {
		it('isPropagationStopped() starts false', () => {
			expect(makeEvent().isPropagationStopped()).toBe(false);
		});

		it('isPropagationStopped() returns true after stopImmediatePropagation()', () => {
			const evt = makeEvent();
			evt.stopImmediatePropagation();
			expect(evt.isPropagationStopped()).toBe(true);
		});
	});

	describe('preventDefault()', () => {
		it('isDefaultPrevented() starts false', () => {
			expect(makeEvent().isDefaultPrevented()).toBe(false);
		});

		it('isDefaultPrevented() returns true after preventDefault()', () => {
			const evt = makeEvent();
			evt.preventDefault();
			expect(evt.isDefaultPrevented()).toBe(true);
		});
	});

	it('each event instance has independent state', () => {
		const a = makeEvent();
		const b = makeEvent();
		a.markHandled();
		expect(a.isHandled()).toBe(true);
		expect(b.isHandled()).toBe(false);
	});
});

// ── stateError() ──────────────────────────────────────────────────────────────

describe('stateError()', () => {
	it('returns a StateError instance', () => {
		expect(stateError('core:test/x', 'message')).toBeInstanceOf(StateError);
	});

	it('code is set correctly', () => {
		const err = stateError('core:test/code', 'msg');
		expect(err.code).toBe('core:test/code');
	});

	it('message includes the code prefix', () => {
		const err = stateError('core:state/disposed', 'player is gone');
		expect(err.message).toContain('core:state/disposed');
		expect(err.message).toContain('player is gone');
	});

	it('severity is "error"', () => {
		expect(stateError('core:test', 'x').severity).toBe('error');
	});

	it('scope.kind is "core"', () => {
		expect(stateError('core:test', 'x').scope).toEqual({ kind: 'core' });
	});

	it('context is undefined when not provided', () => {
		expect(stateError('core:test', 'x').context).toBeUndefined();
	});

	it('context is attached when provided', () => {
		const err = stateError('core:test', 'x', { foo: 'bar' });
		expect(err.context).toEqual({ foo: 'bar' });
	});
});
