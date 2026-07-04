// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Gujarati core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'gu',
 *   translations: {
 *     ...defaultTranslations,
 *     gu: guTranslations,
 *   },
 * });
 */
export const guTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'ઇન્ટરનેટ જોડાણ નથી.',
	'core.network.timeout': 'કનેક્શન સમયસીમા. ફરીથી પ્રયાસ કરી રહ્યા…',
	'core.network.serverError': 'સર્વર પાસે મુશ્કેલીઓ છે. એક ક્ષણમાં ફરીથી પ્રયાસ કરો.',
	'core.network.notFound': 'તે સામગ્રી શોધી શકાઈ નહીં.',
	'core.network.rateLimited': 'ઘણી બધી વિનંતીઓ. કૃપया ધીમું કરો.',

	// Auth
	'core.auth.unauthenticated': 'તમારા સેશનને તાજું કરવા માટે ફરીથી સાઇન ઇન કરો.',
	'core.auth.forbidden': 'તમારા ખાતાને આ સામગ્રીતક પ્રવેશ નથી.',
	'core.auth.refreshFailed': 'તમારા સેશનને તાજું કરી શકાયું નથી. ફરીથી સાઇન ઇન કરો.',

	// Browser policy
	'core.policy.autoplayBlocked': 'ચાલુ કરવાનું શરૂ કરવા માટે ક્યાંય સ્પર્શ કરો અથવા ક્લિક કરો.',
	'core.policy.userGestureRequired': 'સાઉન્ડ સક્ષમ કરવા માટે સ્પર્શ કરો.',
	'core.policy.pipDenied': 'આ સંદર્ભમાં ચિત્રમાં ચિત્ર સુયોજિત નથી.',
	'core.policy.fullscreenDenied': 'આ સંદર્ભમાં સંપૂર્ણ સ્ક્રીન સુયોજિત નથી.',
	'core.policy.wakeLockDenied': 'પ્લેબેક દરમિયાન સ્ક્રીન ડુંગર થઈ શકે છે.',

	// Media
	'core.media.unsupported': 'આ ફોર્મેટ તમારા બ્રાઉઝર દ્વારા સમર્થિત નથી.',
	'core.media.decodeFailed': 'ચાલુ નિષ્ફળ — આગળના ઉપલબ્ધ સ્રોતમાં સ્વિચ કરી રહ્યા છીએ.',
	'core.media.allDecodeFailed': 'આ સામગ્રી માટે કોઈ ચાલું સ્રોત ઉપલબ્ધ નથી.',

	// DRM
	'core.drm.outputProtection': 'તમારો ડિસ્પ્લે આ સામગ્રી માટે સુરક્ષા આવશ્યકતાઓ પૂર્ણ કરતો નથી.',
	'core.drm.licenseFailed': 'આ સામગ્રી માટે લાઇસેન્સ મેળવી શકાયું નથી.',
	'core.drm.keySystemUnsupported': 'તમારો બ્રાઉઝર જરૂરી સુરક્ષા તંત્રને સમર્થન આપતો નથી.',

	// State / dev
	'core.state.queueEmpty': 'કતારમાં કશું નથી.',
	'core.state.notReady': 'પ્લેયર હજી તૈયાર નથી.',

	// A11y announcements
	'core.a11y.playing': '{title} ચાલુ કર્યું',
	'core.a11y.paused': 'વિરામ આપ્યું',
	'core.a11y.stopped': 'બંધ',
	'core.a11y.seeking': '{time} માટે શોધી રહ્યા છીએ',
	'core.a11y.trackChange': 'હવે {title} ચાલુ છે',
	'core.a11y.error': 'ચાલુ કરવા દરમિયાન ભૂલ આવી',
	'core.a11y.muted': 'મીટ થયેલ',
	'core.a11y.unmuted': 'સાઉન્ડ ચાલુ',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'ચાલુ વિરામ આપ્યું — અન્ય ટેબ હવે ચાલુ છે.',
	'plugin.media-session.unsupported': 'OS મીડિયા નિયંત્રણો આ બ્રાઉઝરમાં ઉપલબ્ધ નથી.',
};

export default guTranslations;
