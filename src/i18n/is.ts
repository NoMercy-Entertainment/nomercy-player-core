// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Icelandic core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'is',
 *   translations: {
 *     ...defaultTranslations,
 *     is: isTranslations,
 *   },
 * });
 */
export const isTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Engin internettenging.',
	'core.network.timeout': 'Tenging tímamark. Reyni aftur…',
	'core.network.serverError': 'Þjónninn á í vandræðum. Reyndu aftur eftir stund.',
	'core.network.notFound': 'Ekki var hægt að finna þennan efni.',
	'core.network.rateLimited': 'Of margar beiðnir. Bíddu þér.',

	// Auth
	'core.auth.unauthenticated': 'Skráðu þig aftur inn til að endurnýja setuna þína.',
	'core.auth.forbidden': 'Aðgangur reikningsins þíns nær ekki til þessa efnis.',
	'core.auth.refreshFailed': 'Ekki var hægt að endurnýja setuna þína. Skráðu þig aftur inn.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Snerttu eða smelltu hvers staðar til að hefja afspilun.',
	'core.policy.userGestureRequired': 'Snerttu til að virkja hljóð.',
	'core.policy.pipDenied': 'Mynd-í-mynd er ekki leyfð í þessu samhengi.',
	'core.policy.fullscreenDenied': 'Fullan skjá er ekki leyfð í þessu samhengi.',
	'core.policy.wakeLockDenied': 'Skjárinn gæti orðið dimmari meðan á afspilun stendur.',

	// Media
	'core.media.unsupported': 'Þessi snið er ekki studd af vafranum þínum.',
	'core.media.decodeFailed': 'Afspilun mistókst — skiptum yfir á næsta fáanlega uppsprettu.',
	'core.media.allDecodeFailed': 'Engin leikanleg uppspretta er til staðar fyrir þennan efni.',

	// DRM
	'core.drm.outputProtection': 'Skjárinn þinn stenst ekki verndarkröfur fyrir þennan efni.',
	'core.drm.licenseFailed': 'Ekki var hægt að fá leyfi fyrir þennan efni.',
	'core.drm.keySystemUnsupported': 'Vafrinn þinn styður ekki nauðsynlega verndarkerfi.',

	// State / dev
	'core.state.queueEmpty': 'Ekkert er í biðröðinni.',
	'core.state.notReady': 'Spilari er ekki tilbúinn ennþá.',

	// A11y announcements
	'core.a11y.playing': 'Spilar {title}',
	'core.a11y.paused': 'Í bið',
	'core.a11y.stopped': 'Stöðvað',
	'core.a11y.seeking': 'Leita að {time}',
	'core.a11y.trackChange': 'Spilar nú {title}',
	'core.a11y.error': 'Villa kom upp meðan á afspilun stóð',
	'core.a11y.muted': 'Þaggað',
	'core.a11y.unmuted': 'Hljóð kveikt',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Afspilun sett í bið — annar flipi spilar nú.',
	'plugin.media-session.unsupported': 'Stjórnun miðla stýrikerfis er ekki tiltæk í þessum vafra.',
};

export default isTranslations;
