// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Tamil core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ta',
 *   translations: {
 *     ...defaultTranslations,
 *     ta: taTranslations,
 *   },
 * });
 */
export const taTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'இணைய இணைப்பு இல்லை.',
	'core.network.timeout': 'இணைப்பு நேரம் முடிந்துவிட்டது. மீண்டும் முயற்சி…',
	'core.network.serverError': 'சர்வரில் சிக்கல் உள்ளது. சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.',
	'core.network.notFound': 'அந்த உள்ளடக்கத்தைக் கண்டுபிடிக்க முடியவில்லை.',
	'core.network.rateLimited': 'பல கோரிக்கைகள். தயவுசெய்து மெதுவாக செல்லவும்.',

	// Auth
	'core.auth.unauthenticated': 'உங்கள் அமர்வை புதுப்பிக்க மீண்டும் உள்நுழையவும்.',
	'core.auth.forbidden': 'உங்கள் கணக்கு இந்த உள்ளடக்கத்திற்கு அணுகல் இல்லை.',
	'core.auth.refreshFailed': 'உங்கள் அமர்வைப் புதுப்பிக்க முடியவில்லை. மீண்டும் உள்நுழையவும்.',

	// Browser policy
	'core.policy.autoplayBlocked': 'இயக்கத்தைத் தொடங்க எங்கேயாவது தொடவும் அல்லது கிளிக் செய்யவும்.',
	'core.policy.userGestureRequired': 'ஆடியோ இயக்க தொடவும்.',
	'core.policy.pipDenied': 'இந்த சூழலில் பட்டம்-அளவு-சுற்று அனுமதிக்கப்படவில்லை.',
	'core.policy.fullscreenDenied': 'இந்த சூழலில் முழு திரை அனுமதிக்கப்படவில்லை.',
	'core.policy.wakeLockDenied': 'இயக்கத்தின் போது திரை மங்கலாக இருக்கலாம்.',

	// Media
	'core.media.unsupported': 'இந்த வடிவம் உங்கள் உலாவியால் ஆதரிக்கப்படவில்லை.',
	'core.media.decodeFailed': 'இயக்கம் தோல்வியடைந்தது - அடுத்த கிடைக்கும் மூலத்திற்கு மாறுதல்.',
	'core.media.allDecodeFailed': 'இந்த உள்ளடக்கத்திற்கு எந்த இயக்க மூலமும் கிடைக்கவில்லை.',

	// DRM
	'core.drm.outputProtection': 'உங்கள் காட்சி இந்த உள்ளடக்கத்தின் பாதுகாப்பு தேவைகளை பூர்த்தி செய்யவில்லை.',
	'core.drm.licenseFailed': 'இந்த உள்ளடக்கத்திற்கான உரிமம் பெற முடியவில்லை.',
	'core.drm.keySystemUnsupported': 'உங்கள் உலாவி தேவையான பாதுகாப்பு முறையை ஆதரிக்கவில்லை.',

	// State / dev
	'core.state.queueEmpty': 'வரிசையில் எதுவும் இல்லை.',
	'core.state.notReady': 'பிளேயர் இன்னும் தயாரில்லை.',

	// A11y announcements
	'core.a11y.playing': '{title} இயக்கம்',
	'core.a11y.paused': 'இடைநிறுத்தப்பட்டது',
	'core.a11y.stopped': 'நிறுத்தப்பட்டது',
	'core.a11y.seeking': '{time}ஐ தேடுதல்',
	'core.a11y.trackChange': 'இப்போது {title} இயக்கம்',
	'core.a11y.error': 'இயக்கத்தின் போது பிழை ஏற்பட்டது',
	'core.a11y.muted': 'மியூட் செய்தல்',
	'core.a11y.unmuted': 'ஆடியோ இயக்கம்',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'இயக்கம் இடைநிறுத்தப்பட்டது - மற்றொரு தாவல் இப்போது இயக்கம் வருகிறது.',
	'plugin.media-session.unsupported': 'OS ஊடக கட்டுப்பாடுகள் இந்த உலாவியில் கிடைக்கவில்லை.',
};

export default taTranslations;
