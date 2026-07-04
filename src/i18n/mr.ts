// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Marathi core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'mr',
 *   translations: {
 *     ...defaultTranslations,
 *     mr: mrTranslations,
 *   },
 * });
 */
export const mrTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'इंटरनेट कनेक्शन नाही.',
	'core.network.timeout': 'कनेक्शन टाइमआउट. पुन्हा प्रयत्न करीत आहे…',
	'core.network.serverError': 'सर्व्हरला समस्या आहे. थोड्या वेळात पुन्हा प्रयत्न करा.',
	'core.network.notFound': 'ती सामग्री सापडली नाही.',
	'core.network.rateLimited': 'खूप विनंत्या. कृपया धीमे करा.',

	// Auth
	'core.auth.unauthenticated': 'आपले सत्र ताजे करण्यासाठी पुन्हा साइन इन करा.',
	'core.auth.forbidden': 'आपल्या खात्याला हीसामग्रीच प्रवेश नाही.',
	'core.auth.refreshFailed': 'आपले सत्र ताजे करू शकले नाही. पुन्हा साइन इन करा.',

	// Browser policy
	'core.policy.autoplayBlocked': 'चालू करण्यास प्रारंभ करण्यासाठी कोथीही टॅप किंवा क्लिक करा.',
	'core.policy.userGestureRequired': 'ऑडिओ सक्षम करण्यासाठी टॅप करा.',
	'core.policy.pipDenied': 'या संदर्भामध्ये चित्र-मध्ये-चित्र परवानगी नाही.',
	'core.policy.fullscreenDenied': 'या संदर्भामध्ये पूर्ण स्क्रीन परवानगी नाही.',
	'core.policy.wakeLockDenied': 'चालू करताना स्क्रीन मंद होऊ शकते.',

	// Media
	'core.media.unsupported': 'हा फॉर्मॅट आपल्या ब्राउজरद्वारे समर्थित नाही.',
	'core.media.decodeFailed': 'चालू करणे अयोग्य - पुढील उपलब्ध स्रोतकडे स्विच करीत आहे.',
	'core.media.allDecodeFailed': 'हीसामग्रीसाठी कोणताही चालू करणारा स्रोत उपलब्ध नाही.',

	// DRM
	'core.drm.outputProtection': 'आपल्या डिस्प्लेला हीसामग्रीचीसुरक्षा आवश्यकता पूरणकरत नाही.',
	'core.drm.licenseFailed': 'हीसामग्रीचा परवाना मिळवू शकले नाही.',
	'core.drm.keySystemUnsupported': 'आपल्या ब्राउজरला आवश्यक सुरक्षा प्रणाली समर्थित नाही.',

	// State / dev
	'core.state.queueEmpty': 'रांगेत काहीही नाही.',
	'core.state.notReady': 'प्लेयर अजून तयार नाही.',

	// A11y announcements
	'core.a11y.playing': '{title} चालू करीत आहे',
	'core.a11y.paused': 'विराम दिला',
	'core.a11y.stopped': 'थांबवले',
	'core.a11y.seeking': '{time} साठी शोधत आहे',
	'core.a11y.trackChange': 'आता {title} चालू करीत आहे',
	'core.a11y.error': 'चालू करताना त्रुटी घडली',
	'core.a11y.muted': 'मूक',
	'core.a11y.unmuted': 'आवाज चालू',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'चालू करणे विराम दिले - दुसरा टॅब आता चालू करीत आहे.',
	'plugin.media-session.unsupported': 'OS मीडिया नियंत्रण या ब्राउজरमध्ये उपलब्ध नाही.',
};

export default mrTranslations;
