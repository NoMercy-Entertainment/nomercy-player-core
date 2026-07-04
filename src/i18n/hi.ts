// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Hindi core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'hi',
 *   translations: {
 *     ...defaultTranslations,
 *     hi: hiTranslations,
 *   },
 * });
 */
export const hiTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'कोई इंटरनेट कनेक्शन नहीं।',
	'core.network.timeout': 'कनेक्शन टाइम आउट हो गया। फिर से कोशिश कर रहे हैं…',
	'core.network.serverError': 'सर्वर को समस्याएं हो रही हैं। एक पल में फिर से कोशिश करें।',
	'core.network.notFound': 'वह सामग्री नहीं मिल सकी।',
	'core.network.rateLimited': 'बहुत सारे अनुरोध। कृपया धीमा करें।',

	// Auth
	'core.auth.unauthenticated': 'अपने सेशन को ताज़ा करने के लिए फिर से साइन इन करें।',
	'core.auth.forbidden': 'आपके खाते को इस सामग्री तक पहुंच नहीं है।',
	'core.auth.refreshFailed': 'आपके सेशन को ताज़ा नहीं किया जा सका। फिर से साइन इन करें।',

	// Browser policy
	'core.policy.autoplayBlocked': 'प्लेबैक शुरू करने के लिए कहीं भी टैप या क्लिक करें।',
	'core.policy.userGestureRequired': 'ऑडियो सक्षम करने के लिए टैप करें।',
	'core.policy.pipDenied': 'इस संदर्भ में चित्र-में-चित्र की अनुमति नहीं है।',
	'core.policy.fullscreenDenied': 'इस संदर्भ में पूर्ण स्क्रीन की अनुमति नहीं है।',
	'core.policy.wakeLockDenied': 'प्लेबैक के दौरान स्क्रीन कम हो सकती है।',

	// Media
	'core.media.unsupported': 'यह प्रारूप आपके ब्राउज़र द्वारा समर्थित नहीं है।',
	'core.media.decodeFailed': 'प्लेबैक विफल — अगले उपलब्ध स्रोत पर स्विच कर रहे हैं।',
	'core.media.allDecodeFailed': 'इस सामग्री के लिए कोई चलाने योग्य स्रोत उपलब्ध नहीं है।',

	// DRM
	'core.drm.outputProtection': 'आपकी डिस्प्ले इस सामग्री के लिए सुरक्षा आवश्यकताओं को पूरा नहीं करती है।',
	'core.drm.licenseFailed': 'इस सामग्री के लिए लाइसेंस प्राप्त नहीं कर सका।',
	'core.drm.keySystemUnsupported': 'आपका ब्राउज़र आवश्यक सुरक्षा प्रणाली का समर्थन नहीं करता है।',

	// State / dev
	'core.state.queueEmpty': 'कतार में कुछ नहीं है।',
	'core.state.notReady': 'प्लेयर अभी तक तैयार नहीं है।',

	// A11y announcements
	'core.a11y.playing': '{title} चल रहा है',
	'core.a11y.paused': 'रुका हुआ',
	'core.a11y.stopped': 'रोका गया',
	'core.a11y.seeking': '{time} को खोज रहे हैं',
	'core.a11y.trackChange': 'अब {title} चल रहा है',
	'core.a11y.error': 'प्लेबैक के दौरान एक त्रुटि हुई',
	'core.a11y.muted': 'म्यूट किया गया',
	'core.a11y.unmuted': 'अनम्यूट किया गया',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'प्लेबैक रोका गया — अन्य टैब अब चल रहा है।',
	'plugin.media-session.unsupported': 'OS मीडिया नियंत्रण इस ब्राउज़र में उपलब्ध नहीं हैं।',
};

export default hiTranslations;
