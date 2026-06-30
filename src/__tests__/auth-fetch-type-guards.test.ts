// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Type guard tests for isAuthError() and isNetworkError() exported from
 * core/auth-fetch/index.ts.
 *
 * Asserts:
 *  - isAuthError returns true for AuthError, false for NetworkError and Error
 *  - isNetworkError returns true for NetworkError and AuthError (subclass),
 *    false for plain Error
 */

import { describe, expect, it } from 'vitest';
import { isAuthError, isNetworkError } from '../core/auth-fetch';
import { AuthError, NetworkError } from '../errors';

function makeNetworkError(): NetworkError {
	return new NetworkError({
		code: 'core:network/timeout',
		severity: 'error',
		scope: { kind: 'core' },
	});
}

function makeAuthError(): AuthError {
	return new AuthError({
		code: 'core:auth/unauthenticated',
		severity: 'error',
		scope: { kind: 'core' },
	});
}

describe('isAuthError()', () => {
	it('returns true for an AuthError instance', () => {
		expect(isAuthError(makeAuthError())).toBe(true);
	});

	it('returns false for a NetworkError instance (not AuthError)', () => {
		expect(isAuthError(makeNetworkError())).toBe(false);
	});

	it('returns false for a plain Error', () => {
		expect(isAuthError(new Error('plain'))).toBe(false);
	});

	it('returns false for null', () => {
		expect(isAuthError(null)).toBe(false);
	});

	it('returns false for undefined', () => {
		expect(isAuthError(undefined)).toBe(false);
	});

	it('returns false for a plain object', () => {
		expect(isAuthError({ code: 'core:auth/unauthenticated' })).toBe(false);
	});
});

describe('isNetworkError()', () => {
	it('returns true for a NetworkError instance', () => {
		expect(isNetworkError(makeNetworkError())).toBe(true);
	});

	it('returns true for an AuthError (AuthError extends NetworkError)', () => {
		expect(isNetworkError(makeAuthError())).toBe(true);
	});

	it('returns false for a plain Error', () => {
		expect(isNetworkError(new Error('plain'))).toBe(false);
	});

	it('returns false for null', () => {
		expect(isNetworkError(null)).toBe(false);
	});

	it('returns false for undefined', () => {
		expect(isNetworkError(undefined)).toBe(false);
	});

	it('returns false for a plain object', () => {
		expect(isNetworkError({ message: 'fail' })).toBe(false);
	});
});
