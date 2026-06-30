// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { appendAuthTokenParam } from '../core/append-auth-token-param';

describe('appendAuthTokenParam', () => {
	it('appends access_token with raw jwt when headerValue is a Bearer string', () => {
		const result = appendAuthTokenParam(
			'https://media.example.com/track.mp3',
			'Bearer eyJhbGciOiJSUzI1NiJ9.payload.sig',
		);

		expect(result).toBe(
			'https://media.example.com/track.mp3?access_token=eyJhbGciOiJSUzI1NiJ9.payload.sig',
		);
		expect(result).not.toContain('Bearer');
	});

	it('strips Bearer prefix case-insensitively', () => {
		const result = appendAuthTokenParam(
			'https://media.example.com/track.mp3',
			'bearer eyJtest.payload.sig',
		);

		expect(result).toContain('access_token=eyJtest.payload.sig');
		expect(result).not.toContain('bearer');
	});

	it('uses & separator when the url already contains a query string', () => {
		const result = appendAuthTokenParam(
			'https://media.example.com/track.mp3?quality=high',
			'Bearer myrawtoken',
		);

		expect(result).toBe(
			'https://media.example.com/track.mp3?quality=high&access_token=myrawtoken',
		);
	});

	it('url-encodes the token', () => {
		const result = appendAuthTokenParam(
			'https://media.example.com/track.mp3',
			'Bearer tok en+with/specials=',
		);

		expect(result).toContain('access_token=tok%20en%2Bwith%2Fspecials%3D');
	});

	it('returns the original url unchanged when headerValue is undefined', () => {
		const url = 'https://media.example.com/track.mp3';

		expect(appendAuthTokenParam(url, undefined)).toBe(url);
	});

	it('returns the original url unchanged when headerValue is an empty string', () => {
		const url = 'https://media.example.com/track.mp3';

		expect(appendAuthTokenParam(url, '')).toBe(url);
	});
});
