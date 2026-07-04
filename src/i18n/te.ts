// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Telugu core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'te',
 *   translations: {
 *     ...defaultTranslations,
 *     te: teTranslations,
 *   },
 * });
 */
export const teTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'ఇంటర్నెట్ సంযోగం లేదు.',
	'core.network.timeout': 'సంయోగం సమయం ముగిసిన. మళ్ళీ ప్రయత్నిస్తుంది…',
	'core.network.serverError': 'సర్వర్‌కు సమస్యలు ఉన్నాయి. క్షణం సమయానికి మళ్ళీ ప్రయత్నించండి.',
	'core.network.notFound': 'ఆ కంటెంట్‌ను కనుగొనలేము.',
	'core.network.rateLimited': 'చాలా అభ్యర్థనలు. దయచేసి నెమ్మదించండి.',

	// Auth
	'core.auth.unauthenticated': 'మీ సెషన్‌ను రిఫ్రెష్ చేయడానికి మళ్ళీ సైన్ ఇన్ చేయండి.',
	'core.auth.forbidden': 'మీ ఖాతకు ఈ కంటెంట్‌కు ప్రాప్యత లేదు.',
	'core.auth.refreshFailed': 'మీ సెషన్‌ను రిఫ్రెష్ చేయలేము. మళ్ళీ సైన్ ఇన్ చేయండి.',

	// Browser policy
	'core.policy.autoplayBlocked': 'ప్లేబ్యాక్‌ను ప్రారంభించడానికి ఎక్కడైనా ట్యాప్ లేదా క్లిక్ చేయండి.',
	'core.policy.userGestureRequired': 'ఆడియో ప్రారంభించడానికి ట్యాప్ చేయండి.',
	'core.policy.pipDenied': 'ఈ సందర్భంలో చిత్ర-ఇన్-చిత్ర అనుమతించబడదు.',
	'core.policy.fullscreenDenied': 'ఈ సందర్భంలో పూర్ణ స్క్రీన్ అనుమతించబడదు.',
	'core.policy.wakeLockDenied': 'ప్లేబ్యాక్ సమయంలో స్క్రీన్ మందం చేయవచ్చు.',

	// Media
	'core.media.unsupported': 'ఈ ఫార్మాట్ మీ బ్రౌజర్ ద్వారా సమర్థించబడదు.',
	'core.media.decodeFailed': 'ప్లేబ్యాక్ విఫలమైంది - తదుపరి అందుబాటులో ఉన్న మూలానికి మారుతుంది.',
	'core.media.allDecodeFailed': 'ఈ కంటెంట్‌కు ప్లే చేయదగిన మూలం లేదు.',

	// DRM
	'core.drm.outputProtection': 'మీ ప్రదర్శన ఈ కంటెంట్ కోసం సంరక్షణ అవసరాలను తీరుస్తుంది.',
	'core.drm.licenseFailed': 'ఈ కంటెంట్ కోసం లైసెన్స్ పొందలేకపోయాను.',
	'core.drm.keySystemUnsupported': 'మీ బ్రౌజర్ అవసరమైన సంరక్షణ విధానాన్ని సమర్థించదు.',

	// State / dev
	'core.state.queueEmpty': 'క్యూలో ఏమీ లేదు.',
	'core.state.notReady': 'ప్లేయర్ ఇంకా సిద్ధంగా లేదు.',

	// A11y announcements
	'core.a11y.playing': '{title} ప్లే చేస్తుంది',
	'core.a11y.paused': 'పాజ్ చేసిన',
	'core.a11y.stopped': 'ఆపివేసిన',
	'core.a11y.seeking': '{time}కు వెతకడం',
	'core.a11y.trackChange': 'ఇప్పుడు {title} ప్లే చేస్తుంది',
	'core.a11y.error': 'ప్లేబ్యాక్ సమయంలో ఎర్రర్ సంభవించింది',
	'core.a11y.muted': 'మ్యూట్ చేసిన',
	'core.a11y.unmuted': 'ఆడియో ఆన్',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'ప్లేబ్యాక్ పాజ్ చేయబడింది - మరొక ట్యాబ్ ఇప్పుడు ప్లే చేస్తుంది.',
	'plugin.media-session.unsupported': 'OS మీడియా నియంత్రణలు ఈ బ్రౌజర్‌లో అందుబాటులో లేవు.',
};

export default teTranslations;
