// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Default English translation bundle — verifies kit-shipped i18n is well-formed
 * and contains the keys the kit's own code paths reference.
 */

import { describe, expect, it } from 'vitest';
import { defaultTranslations, enTranslations } from '../i18n/en';

describe('enTranslations', () => {
	it('is a non-empty record', () => {
		expect(Object.keys(enTranslations).length).toBeGreaterThan(0);
	});

	it('every value is a non-empty string', () => {
		for (const [key, value] of Object.entries(enTranslations)) {
			expect(typeof value, `key ${key}`).toBe('string');
			expect(value.length, `key ${key}`).toBeGreaterThan(0);
		}
	});

	describe('required core.* keys', () => {
		it.each([
			'core.network.offline',
			'core.network.timeout',
			'core.network.serverError',
			'core.network.notFound',
			'core.network.rateLimited',
			'core.auth.unauthenticated',
			'core.auth.forbidden',
			'core.auth.refreshFailed',
		])('%s is present', (key) => {
			expect(enTranslations[key]).toBeDefined();
		});
	});

	describe('browser-policy keys', () => {
		it.each([
			'core.policy.autoplayBlocked',
			'core.policy.userGestureRequired',
			'core.policy.pipDenied',
			'core.policy.fullscreenDenied',
			'core.policy.wakeLockDenied',
		])('%s is present', (key) => {
			expect(enTranslations[key]).toBeDefined();
		});
	});

	describe('media + DRM + state keys', () => {
		it.each([
			'core.media.unsupported',
			'core.media.decodeFailed',
			'core.media.allDecodeFailed',
			'core.drm.outputProtection',
			'core.drm.licenseFailed',
			'core.drm.keySystemUnsupported',
			'core.state.queueEmpty',
			'core.state.notReady',
		])('%s is present', (key) => {
			expect(enTranslations[key]).toBeDefined();
		});
	});

	describe('a11y announcement keys', () => {
		it.each([
			'core.a11y.playing',
			'core.a11y.paused',
			'core.a11y.stopped',
			'core.a11y.seeking',
			'core.a11y.trackChange',
			'core.a11y.error',
			'core.a11y.muted',
			'core.a11y.unmuted',
		])('%s is present', (key) => {
			expect(enTranslations[key]).toBeDefined();
		});
	});

	describe('kit plugin keys', () => {
		it.each([
			'plugin.tab-leader.lost',
			'plugin.media-session.unsupported',
		])('%s is present', (key) => {
			expect(enTranslations[key]).toBeDefined();
		});

		it('does NOT include cast-sender keys (i18n is consumer-supplied, not bundled)', () => {
			// CastSenderPlugin lives in the kit but ships no built-in
			// translations — consumer apps add their own UX strings.
			expect(enTranslations['plugin.cast-sender.connecting']).toBeUndefined();
			expect(enTranslations['plugin.cast-sender.connected']).toBeUndefined();
			expect(enTranslations['plugin.cast-sender.disconnected']).toBeUndefined();
		});
	});

	describe('interpolation placeholders', () => {
		it('a11y.playing has {title} placeholder', () => {
			expect(enTranslations['core.a11y.playing']).toContain('{title}');
		});

		it('a11y.seeking has {time} placeholder', () => {
			expect(enTranslations['core.a11y.seeking']).toContain('{time}');
		});

		it('a11y.trackChange has {title} placeholder', () => {
			expect(enTranslations['core.a11y.trackChange']).toContain('{title}');
		});
	});
});

describe('defaultTranslations', () => {
	it('exposes en bundle', () => {
		expect(defaultTranslations.en).toBeDefined();
	});

	it('en bundle is the same object as enTranslations', () => {
		expect(defaultTranslations.en).toBe(enTranslations);
	});

	it('is consumable as Translations type via spread', () => {
		const merged = { ...defaultTranslations, nl: { 'core.network.offline': 'Geen verbinding' } };
		expect(merged.en).toBe(enTranslations);
		expect(merged.nl['core.network.offline']).toBe('Geen verbinding');
	});
});
