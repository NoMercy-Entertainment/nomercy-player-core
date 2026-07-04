// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Nepali core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ne',
 *   translations: {
 *     ...defaultTranslations,
 *     ne: neTranslations,
 *   },
 * });
 */
export const neTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'इन्टरनेट जडान छैन।',
	'core.network.timeout': 'जडान समय समाप्त। पुनः प्रयास गरीरहेको…',
	'core.network.serverError': 'सर्भरलाई समस्या छ। केही पलमा फेरि प्रयास गर्नुहोस्।',
	'core.network.notFound': 'त्यो सामग्री फेला पार्न सकिएन।',
	'core.network.rateLimited': 'अत्यधिक अनुरोध। कृपया ढिलो गर्नुहोस्।',

	// Auth
	'core.auth.unauthenticated': 'आपको सत्र ताजा गर्न फेरि साइन इन गर्नुहोस्।',
	'core.auth.forbidden': 'आपको खाता यस सामग्रीमा पहुँच छैन।',
	'core.auth.refreshFailed': 'आपको सत्र ताजा गर्न सकिएन। फेरि साइन इन गर्नुहोस्।',

	// Browser policy
	'core.policy.autoplayBlocked': 'चलन सुरु गर्न कहीँ पनि ट्याप गर्नुहोस् वा क्लिक गर्नुहोस्।',
	'core.policy.userGestureRequired': 'अडियो सक्षम गर्न ट्याप गर्नुहोस्।',
	'core.policy.pipDenied': 'यस सन्दर्भमा चित्र-मा-चित्र अनुमति छैन।',
	'core.policy.fullscreenDenied': 'यस सन्दर्भमा पूर्ण स्क्रिन अनुमति छैन।',
	'core.policy.wakeLockDenied': 'चलन समय स्क्रिन मन्द हुन सक्छ।',

	// Media
	'core.media.unsupported': 'यो ढाँचा आपको ब्राउजरद्वारा समर्थित छैन।',
	'core.media.decodeFailed': 'चलन विफल - अर्को उपलब्ध स्रोतमा स्विच गरीरहेको।',
	'core.media.allDecodeFailed': 'यस सामग्रीको लागि कुनै चलनयोग्य स्रोत उपलब्ध छैन।',

	// DRM
	'core.drm.outputProtection': 'आपको डिस्प्ले यस सामग्रीको सुरक्षा आवश्यकताहरू पूरा गर्दैन।',
	'core.drm.licenseFailed': 'यस सामग्रीको लागि लाइसेन्स प्राप्त गर्न सकिएन।',
	'core.drm.keySystemUnsupported': 'आपको ब्राउजरले आवश्यक सुरक्षा प्रणाली समर्थन गर्दैन।',

	// State / dev
	'core.state.queueEmpty': 'लामबन्दीमा केही छैन।',
	'core.state.notReady': 'प्लेयर अझै तयार छैन।',

	// A11y announcements
	'core.a11y.playing': '{title} चलाइरहेको',
	'core.a11y.paused': 'रोकिएको',
	'core.a11y.stopped': 'बन्द गरिएको',
	'core.a11y.seeking': '{time} मा खोजीरहेको',
	'core.a11y.trackChange': 'अहिले {title} चलाइरहेको',
	'core.a11y.error': 'चलन समय त्रुटि हुई',
	'core.a11y.muted': 'मौन',
	'core.a11y.unmuted': 'आवाज चालु',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'चलन रोकिएको - अर्को ट्याब अहिले चलाइरहेको।',
	'plugin.media-session.unsupported': 'OS मिडिया नियन्त्रण यो ब्राउजरमा उपलब्ध छैन।',
};

export default neTranslations;
