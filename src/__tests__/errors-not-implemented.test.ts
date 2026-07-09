// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * `NotImplementedError` — the "method exists in the contract but this backend
 * does not support it" error consumers catch by code / instanceof.
 *
 * Test groups:
 *  - construction with and without a feature suffix
 *  - fixed severity / scope / name
 *  - instanceof chain (NotImplementedError → PlayerError → Error)
 */

import { describe, expect, it } from 'vitest';
import { NotImplementedError, PlayerError } from '../errors';

describe('NotImplementedError', () => {
	it('uses the bare core:not-implemented code when no feature is given', () => {
		const error = new NotImplementedError('subtitles are not supported here');
		expect(error.code).toBe('core:not-implemented');
	});

	it('appends the feature to the code as core:not-implemented/<feature>', () => {
		const error = new NotImplementedError('no subtitles', 'subtitles');
		expect(error.code).toBe('core:not-implemented/subtitles');
	});

	it('carries the message verbatim', () => {
		const error = new NotImplementedError('captureStream is unavailable', 'captureStream');
		expect(error.message).toBe('captureStream is unavailable');
	});

	it('always reports severity "error"', () => {
		const error = new NotImplementedError('x');
		expect(error.severity).toBe('error');
	});

	it('is always scoped to the core', () => {
		const error = new NotImplementedError('x', 'feature');
		expect(error.scope).toEqual({ kind: 'core' });
	});

	it('has name "NotImplementedError"', () => {
		const error = new NotImplementedError('x');
		expect(error.name).toBe('NotImplementedError');
	});

	it('is an instanceof NotImplementedError, PlayerError, and Error', () => {
		const error = new NotImplementedError('x');
		expect(error).toBeInstanceOf(NotImplementedError);
		expect(error).toBeInstanceOf(PlayerError);
		expect(error).toBeInstanceOf(Error);
	});

	it('is catchable by instanceof after a throw (documented consumer pattern)', () => {
		let caught: unknown;
		try {
			throw new NotImplementedError('no subtitles', 'subtitles');
		}
		catch (err) {
			caught = err;
		}
		expect(caught instanceof NotImplementedError).toBe(true);
		expect((caught as NotImplementedError).code).toBe('core:not-implemented/subtitles');
	});
});
