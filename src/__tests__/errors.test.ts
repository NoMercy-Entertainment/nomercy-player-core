// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Error framework tests — code helpers, error class hierarchy, retry policy.
 *
 * Test groups:
 *  - makeCode / parseCode / formatCode round-trip
 *  - makeCode validation (range checks)
 *  - SEVERITY_LEVEL mapping
 *  - PlayerError construction (defaults, fields, isHttp helper)
 *  - Error subclass identity (NetworkError, AuthError, MediaFormatError, etc.)
 *  - DEFAULT_RETRY_POLICY shape
 *  - VENDOR + SEVERITY constants
 */

import { describe, expect, it } from 'vitest';
import {
	AuthError,
	BrowserPolicyError,
	DEFAULT_RETRY_POLICY,
	DrmError,
	formatCode,
	makeCode,
	MediaFormatError,
	NetworkError,
	parseCode,
	PlayerError,
	PluginError,
	ResourceError,
	SEVERITY,
	SEVERITY_LEVEL,
	StateError,
	StreamError,
	VENDOR,
} from '../errors';

describe('Error framework', () => {
	// ─────────────────────────────────────────────────────────────────────
	// makeCode / parseCode round-trip
	// ─────────────────────────────────────────────────────────────────────

	describe('makeCode()', () => {
		it('packs vendor / severity / category / event into 8-digit code', () => {
			// vendor=1 * 100_000 + severity=3 * 10_000 + category=1 * 100 + event=5 = 130_105
			const code = makeCode({ vendor: 1, severity: 3, category: 1, event: 5 });
			expect(code).toBe(130_105);
		});

		it('zero is a valid value for vendor / category / event', () => {
			const code = makeCode({ vendor: 0, severity: 1, category: 0, event: 0 });
			expect(code).toBe(10000);
		});

		it('throws RangeError when vendor < 0', () => {
			expect(() => makeCode({ vendor: -1, severity: 1, category: 0, event: 0 })).toThrow(RangeError);
		});

		it('throws RangeError when vendor > 999', () => {
			expect(() => makeCode({ vendor: 1000, severity: 1, category: 0, event: 0 })).toThrow(RangeError);
		});

		it('throws RangeError when category > 99', () => {
			expect(() => makeCode({ vendor: 1, severity: 1, category: 100, event: 0 })).toThrow(RangeError);
		});

		it('throws RangeError when event > 99', () => {
			expect(() => makeCode({ vendor: 1, severity: 1, category: 0, event: 100 })).toThrow(RangeError);
		});

		it('round-trips with parseCode', () => {
			const fields = { vendor: 42, severity: 4 as const, category: 12, event: 7 };
			const code = makeCode(fields);
			expect(parseCode(code)).toEqual(fields);
		});
	});

	describe('parseCode()', () => {
		it('decomposes a code into fields', () => {
			expect(parseCode(130_105)).toEqual({ vendor: 1, severity: 3, category: 1, event: 5 });
		});

		it('handles all-zeros code', () => {
			expect(parseCode(0)).toEqual({ vendor: 0, severity: 0, category: 0, event: 0 });
		});

		it('handles max values', () => {
			expect(parseCode(999_4_99_99)).toEqual({ vendor: 999, severity: 4, category: 99, event: 99 });
		});
	});

	describe('formatCode()', () => {
		it('zero-pads short codes to 8 digits', () => {
			expect(formatCode(10005)).toBe('00010005');
		});

		it('renders 8-digit code without padding', () => {
			expect(formatCode(99949999)).toBe('99949999');
		});

		it('zero renders as 00000000', () => {
			expect(formatCode(0)).toBe('00000000');
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Severity constants
	// ─────────────────────────────────────────────────────────────────────

	describe('SEVERITY constants', () => {
		it('exposes fatal/error/warning/info', () => {
			expect(SEVERITY).toEqual({
				FATAL: 'fatal',
				ERROR: 'error',
				WARNING: 'warning',
				INFO: 'info',
			});
		});
	});

	describe('SEVERITY_LEVEL mapping', () => {
		it('maps info → 1, warning → 2, error → 3, fatal → 4', () => {
			expect(SEVERITY_LEVEL.info).toBe(1);
			expect(SEVERITY_LEVEL.warning).toBe(2);
			expect(SEVERITY_LEVEL.error).toBe(3);
			expect(SEVERITY_LEVEL.fatal).toBe(4);
		});
	});

	describe('VENDOR constants', () => {
		it('reserves KIT=1, MUSIC=2, VIDEO=3', () => {
			expect(VENDOR.KIT).toBe(1);
			expect(VENDOR.MUSIC).toBe(2);
			expect(VENDOR.VIDEO).toBe(3);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// PlayerError class
	// ─────────────────────────────────────────────────────────────────────

	describe('PlayerError', () => {
		it('stores code / scope / severity (defaulting to error)', () => {
			const playerError = new PlayerError({ code: 'core:foo/bar', scope: { kind: 'core' } });
			expect(playerError.code).toBe('core:foo/bar');
			expect(playerError.scope).toEqual({ kind: 'core' });
			expect(playerError.severity).toBe('error');
		});

		it('honors explicit severity', () => {
			const playerError = new PlayerError({ code: 'x', scope: { kind: 'core' }, severity: 'fatal' });
			expect(playerError.severity).toBe('fatal');
		});

		it('uses message arg for Error.message when supplied', () => {
			const playerError = new PlayerError({ code: 'x', scope: { kind: 'core' }, message: 'bang' });
			expect(playerError.message).toBe('bang');
		});

		it('falls back to code as Error.message when message is omitted', () => {
			const playerError = new PlayerError({ code: 'core:fallback', scope: { kind: 'core' } });
			expect(playerError.message).toBe('core:fallback');
		});

		it('stores cause / context / suggestion when provided', () => {
			const cause = new Error('inner');
			const playerError = new PlayerError({
				code: 'x',
				scope: { kind: 'core' },
				cause,
				context: { url: 'https://example.com' },
				suggestion: 'Try again',
			});
			expect(playerError.cause).toBe(cause);
			expect(playerError.context).toEqual({ url: 'https://example.com' });
			expect(playerError.suggestion).toBe('Try again');
		});

		it('has name "PlayerError"', () => {
			const playerError = new PlayerError({ code: 'x', scope: { kind: 'core' } });
			expect(playerError.name).toBe('PlayerError');
		});

		it('is an instanceof Error', () => {
			const playerError = new PlayerError({ code: 'x', scope: { kind: 'core' } });
			expect(playerError).toBeInstanceOf(Error);
		});

		describe('isHttp()', () => {
			it('returns true when context.httpStatus matches the requested century', () => {
				const playerError = new PlayerError({ code: 'x', scope: { kind: 'network' }, context: { httpStatus: 404 } });
				expect(playerError.isHttp(4)).toBe(true);
				expect(playerError.isHttp(5)).toBe(false);
			});

			it('returns false when no httpStatus in context', () => {
				const playerError = new PlayerError({ code: 'x', scope: { kind: 'network' } });
				expect(playerError.isHttp(4)).toBe(false);
			});

			it('returns false for httpStatus boundary outside century', () => {
				const playerError = new PlayerError({ code: 'x', scope: { kind: 'network' }, context: { httpStatus: 500 } });
				expect(playerError.isHttp(4)).toBe(false);
				expect(playerError.isHttp(5)).toBe(true);
			});
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Error subclasses
	// ─────────────────────────────────────────────────────────────────────

	describe('error subclasses', () => {
		it('NetworkError extends PlayerError', () => {
			const networkError = new NetworkError({ code: 'core:network/x', scope: { kind: 'network' } });
			expect(networkError).toBeInstanceOf(PlayerError);
			expect(networkError.name).toBe('NetworkError');
		});

		it('AuthError extends NetworkError', () => {
			const authError = new AuthError({ code: 'core:auth/x', scope: { kind: 'auth' } });
			expect(authError).toBeInstanceOf(NetworkError);
			expect(authError).toBeInstanceOf(PlayerError);
			expect(authError.name).toBe('AuthError');
		});

		it('MediaFormatError extends PlayerError', () => {
			const mediaFormatError = new MediaFormatError({ code: 'core:media/x', scope: { kind: 'core' } });
			expect(mediaFormatError).toBeInstanceOf(PlayerError);
			expect(mediaFormatError.name).toBe('MediaFormatError');
		});

		it('StreamError extends PlayerError', () => {
			const streamError = new StreamError({ code: 'core:stream/x', scope: { kind: 'stream', id: 'hls' } });
			expect(streamError).toBeInstanceOf(PlayerError);
			expect(streamError.name).toBe('StreamError');
		});

		it('DrmError extends PlayerError', () => {
			const drmError = new DrmError({ code: 'core:drm/x', scope: { kind: 'core' } });
			expect(drmError).toBeInstanceOf(PlayerError);
			expect(drmError.name).toBe('DrmError');
		});

		it('BrowserPolicyError extends PlayerError', () => {
			const browserPolicyError = new BrowserPolicyError({ code: 'core:policy/x', scope: { kind: 'core' } });
			expect(browserPolicyError).toBeInstanceOf(PlayerError);
			expect(browserPolicyError.name).toBe('BrowserPolicyError');
		});

		it('StateError extends PlayerError', () => {
			const stateError = new StateError({ code: 'core:state/x', scope: { kind: 'core' } });
			expect(stateError).toBeInstanceOf(PlayerError);
			expect(stateError.name).toBe('StateError');
		});

		it('PluginError extends PlayerError', () => {
			const pluginError = new PluginError({ code: 'plugin:foo/x', scope: { kind: 'plugin', id: 'foo' } });
			expect(pluginError).toBeInstanceOf(PlayerError);
			expect(pluginError.name).toBe('PluginError');
		});

		it('ResourceError extends PlayerError', () => {
			const resourceError = new ResourceError({ code: 'core:resource/x', scope: { kind: 'core' } });
			expect(resourceError).toBeInstanceOf(PlayerError);
			expect(resourceError.name).toBe('ResourceError');
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// DEFAULT_RETRY_POLICY
	// ─────────────────────────────────────────────────────────────────────

	describe('DEFAULT_RETRY_POLICY', () => {
		it('defines exact-code entries for known errors', () => {
			expect(DEFAULT_RETRY_POLICY['core:auth/forbidden']).toEqual({ attempts: 0 });
			expect(DEFAULT_RETRY_POLICY['core:auth/unauthenticated']).toEqual({ attempts: 1, refreshFirst: true });
			expect(DEFAULT_RETRY_POLICY['core:media/codec-unsupported']).toEqual({ attempts: 0 });
		});

		it('defines HTTP century fallbacks', () => {
			expect(DEFAULT_RETRY_POLICY['4xx']).toEqual({ attempts: 0 });
			expect(DEFAULT_RETRY_POLICY['5xx']).toBeDefined();
			expect(DEFAULT_RETRY_POLICY['5xx']!.attempts).toBeGreaterThan(0);
		});

		it('defines wildcard fallback', () => {
			expect(DEFAULT_RETRY_POLICY['*']).toEqual({ attempts: 0 });
		});

		it('5xx uses exponential backoff', () => {
			const policy = DEFAULT_RETRY_POLICY['5xx']!;
			expect(policy.backoff).toBe('exponential');
			expect(policy.baseMs).toBeDefined();
			expect(policy.maxMs).toBeDefined();
		});
	});
});
