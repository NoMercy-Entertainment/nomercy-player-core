// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Punjabi core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'pa',
 *   translations: {
 *     ...defaultTranslations,
 *     pa: paTranslations,
 *   },
 * });
 */
export const paTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'ਇੰਟਰਨੈੱਟ ਸੰਪਰਕ ਨਹੀਂ।',
	'core.network.timeout': 'ਸੰਪਰਕ ਸਮਾਈ ਖਤਮ ਹੋ ਗਈ। ਫਿਰ ਤੋਂ ਕੋਸ਼ਿਸ਼ ਕਰ ਰਿਹਾ ਹਾਂ…',
	'core.network.serverError': 'ਸਰਵਰ ਨੂੰ ਸਮੱਸਿਆਵਾਂ ਹਨ। ਇੱਕ ਪਲ ਵਿੱਚ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
	'core.network.notFound': 'ਉਹ ਸਮੱਗਰੀ ਨਹੀਂ ਲੱਭੀ ਜਾ ਸਕੀ।',
	'core.network.rateLimited': 'ਬਹੁਤ ਸਾਰੀਆਂ ਬੇਨਤੀਆਂ। ਕਿਰਪਾ ਕਰਕੇ ਹੌਲੀ ਕਰੋ।',

	// Auth
	'core.auth.unauthenticated': 'ਆਪਣੇ ਸੈਸ਼ਨ ਨੂੰ ਤਾਜ਼ਾ ਕਰਨ ਲਈ ਦੁਬਾਰਾ ਸਾਈਨ ਇਨ ਕਰੋ।',
	'core.auth.forbidden': 'ਆਪਣੇ ਖਾਤੇ ਨੂੰ ਇਸ ਸਮੱਗਰੀ ਤੱਕ ਪਹੁੰਚ ਨਹੀਂ ਹੈ।',
	'core.auth.refreshFailed': 'ਆਪਣੇ ਸੈਸ਼ਨ ਨੂੰ ਤਾਜ਼ਾ ਨਹੀਂ ਕਰ ਸਕੇ। ਦੁਬਾਰਾ ਸਾਈਨ ਇਨ ਕਰੋ।',

	// Browser policy
	'core.policy.autoplayBlocked': 'ਪਲੇਬੈਕ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਕਿਤੇ ਵੀ ਟੈਪ ਜਾਂ ਕਲਿਕ ਕਰੋ।',
	'core.policy.userGestureRequired': 'ਆਡੀਓ ਨੂੰ ਸਮਰਥ ਬਣਾਉਣ ਲਈ ਟੈਪ ਕਰੋ।',
	'core.policy.pipDenied': 'ਇਸ ਸਵੇਰ ਵਿੱਚ ਸਤਰ-ਵਿੱਚ-ਸਤਰ ਅਨੁਮਤ ਨਹੀਂ ਹੈ।',
	'core.policy.fullscreenDenied': 'ਇਸ ਸਵੇਰ ਵਿੱਚ ਪੂਰੀ ਸਕ੍ਰੀਨ ਅਨੁਮਤ ਨਹੀਂ ਹੈ।',
	'core.policy.wakeLockDenied': 'ਪਲੇਬੈਕ ਦੌਰਾਨ ਸਕ੍ਰੀਨ ਹਲਕਾ ਹੋ ਸਕਦਾ ਹੈ।',

	// Media
	'core.media.unsupported': 'ਇਹ ਸਮਰੂਪ ਆਪਣੇ ਬ੍ਰਾਊਜ਼ਰ ਦੁਆਰਾ ਸਮਰਥਿਤ ਨਹੀਂ ਹੈ।',
	'core.media.decodeFailed': 'ਪਲੇਬੈਕ ਵਿਫਲ - ਅਗਲੇ ਉਪਲਬਧ ਸ੍ਰੋਤ ਵਿਚ ਸਵਿਚ ਕਰ ਰਿਹਾ ਹਾਂ।',
	'core.media.allDecodeFailed': 'ਇਸ ਸਮੱਗਰੀ ਲਈ ਕੋਈ ਚਲਾਯੋਗ ਸ੍ਰੋਤ ਉਪਲਬਧ ਨਹੀਂ ਹੈ।',

	// DRM
	'core.drm.outputProtection': 'ਆਪਣੀ ਡਿਸਪਲੇ ਇਸ ਸਮੱਗਰੀ ਲਈ ਸੁਰੱਖਿਆ ਲੋੜਾਂ ਪੂਰੀਆਂ ਨਹੀਂ ਕਰਦੀ।',
	'core.drm.licenseFailed': 'ਇਸ ਸਮੱਗਰੀ ਲਈ ਲਾਇਸੈਂਸ ਨਹੀਂ ਮਿਲ ਸਕਿਆ।',
	'core.drm.keySystemUnsupported': 'ਆਪਣਾ ਬ੍ਰਾਊਜ਼ਰ ਲੋੜੀਂਦੀ ਸੁਰੱਖਿਆ ਪ੍ਰਣਾਲੀ ਨੂੰ ਸਮਰਥਨ ਨਹੀਂ ਕਰਦਾ।',

	// State / dev
	'core.state.queueEmpty': 'ਕਤਾਰ ਵਿੱਚ ਕੁਝ ਵੀ ਨਹੀਂ।',
	'core.state.notReady': 'ਪਲੇਅਰ ਅਜੇ ਤਿਆਰ ਨਹੀਂ ਹੈ।',

	// A11y announcements
	'core.a11y.playing': '{title} ਚਲਾ ਰਿਹਾ ਹਾਂ',
	'core.a11y.paused': 'ਰੁਕਾ ਹੋਇਆ',
	'core.a11y.stopped': 'ਬੰਦ ਕੀਤਾ',
	'core.a11y.seeking': '{time} ਲਈ ਖੋਜ ਕਰ ਰਿਹਾ ਹਾਂ',
	'core.a11y.trackChange': 'ਹੁਣ {title} ਚਲਾ ਰਿਹਾ ਹਾਂ',
	'core.a11y.error': 'ਪਲੇਬੈਕ ਦੌਰਾਨ ਇੱਕ ਤਰੁੱਟੀ ਹੋਈ',
	'core.a11y.muted': 'ਮੰਤ',
	'core.a11y.unmuted': 'ਆਵਾਜ਼ ਚਾਲੂ',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'ਪਲੇਬੈਕ ਰੋਕਿਆ ਗਿਆ — ਇਕ ਹੋਰ ਟ੍ਰੈਬ ਹੁਣ ਚਲ ਰਿਹਾ ਹੈ।',
	'plugin.media-session.unsupported': 'OS ਮੀਡੀਆ ਨਿਯੰਤਰਣ ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਉਪਲਬਧ ਨਹੀਂ ਹਨ।',
};

export default paTranslations;
