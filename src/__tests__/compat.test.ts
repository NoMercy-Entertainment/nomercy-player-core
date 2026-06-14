// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { applyKitV1Compat } from '../compat';

describe('applyKitV1Compat', () => {
	it('maps debug:true to logLevel:"debug" when logLevel is unset', () => {
		const result = applyKitV1Compat({ debug: true });
		expect(result.logLevel).toBe('debug');
	});

	it('does not override logLevel when already set', () => {
		const result = applyKitV1Compat({ debug: true, logLevel: 'warn' });
		expect(result.logLevel).toBe('warn');
	});

	it('maps accessToken string to auth.bearerToken', () => {
		const result = applyKitV1Compat({ accessToken: 'tok' });
		expect(result.auth?.bearerToken).toBe('tok');
	});

	it('maps accessToken getter to auth.bearerToken', () => {
		const getter = (): string => 'dynamic';
		const result = applyKitV1Compat({ accessToken: getter });
		expect(result.auth?.bearerToken).toBe(getter);
	});

	it('does not overwrite existing auth.bearerToken', () => {
		const result = applyKitV1Compat({
			accessToken: 'old',
			auth: { bearerToken: 'winner' },
		});
		expect(result.auth?.bearerToken).toBe('winner');
	});

	it('strips deprecated fields from output', () => {
		const result = applyKitV1Compat({ debug: true, accessToken: 'tok' }) as Record<string, unknown>;
		expect('debug' in result).toBe(false);
		expect('accessToken' in result).toBe(false);
	});

	it('passes through unrelated config fields unchanged', () => {
		const result = applyKitV1Compat({ baseUrl: 'https://cdn.example.com' });
		expect(result.baseUrl).toBe('https://cdn.example.com');
	});

	it('is safe on a config that is already v2-clean (no deprecated fields)', () => {
		const result = applyKitV1Compat({ logLevel: 'info', auth: { bearerToken: 'ok' } });
		expect(result.logLevel).toBe('info');
		expect(result.auth?.bearerToken).toBe('ok');
	});
});
