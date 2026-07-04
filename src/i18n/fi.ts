// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Finnish core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'fi',
 *   translations: {
 *     ...defaultTranslations,
 *     fi: fiTranslations,
 *   },
 * });
 */
export const fiTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Ei internet-yhteyttä.',
	'core.network.timeout': 'Yhteys aikakatkaistiin. Yritetään uudelleen…',
	'core.network.serverError': 'Palvelimella on ongelmia. Yritä hetken kuluttua.',
	'core.network.notFound': 'Tätä sisältöä ei löytynyt.',
	'core.network.rateLimited': 'Liian monta pyyntöä. Ole hyvä ja hidasta.',

	// Auth
	'core.auth.unauthenticated': 'Kirjaudu sisään uudelleen päivittääksesi istuntosi.',
	'core.auth.forbidden': 'Tililläsi ei ole pääsyä tähän sisältöön.',
	'core.auth.refreshFailed': 'Istuntosi päivittäminen epäonnistui. Kirjaudu uudelleen sisään.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Napauta tai napsauta missä tahansa aloittaaksesi toiston.',
	'core.policy.userGestureRequired': 'Napauta ottaaksesi äänen käyttöön.',
	'core.policy.pipDenied': 'Kuva kuvassa ei ole sallittu tässä yhteydessä.',
	'core.policy.fullscreenDenied': 'Koko näyttö ei ole sallittu tässä yhteydessä.',
	'core.policy.wakeLockDenied': 'Näyttö voi himmentyä toiston aikana.',

	// Media
	'core.media.unsupported': 'Selaimesi ei tue tätä muotoa.',
	'core.media.decodeFailed': 'Toiston epäonnistuminen — vaihdetaan seuraavaan käytettävissä olevaan lähteeseen.',
	'core.media.allDecodeFailed': 'Tälle sisällölle ei ole saatavilla toistettavaa lähteistä.',

	// DRM
	'core.drm.outputProtection': 'Näyttösi ei täytä tämän sisällön suojausvaatimuksia.',
	'core.drm.licenseFailed': 'Tämän sisällön lisenssiä ei voitu saada.',
	'core.drm.keySystemUnsupported': 'Selaimesi ei tue vaadittavaa suojausjärjestelmää.',

	// State / dev
	'core.state.queueEmpty': 'Jonossa ei ole mitään.',
	'core.state.notReady': 'Soitin ei ole vielä valmis.',

	// A11y announcements
	'core.a11y.playing': 'Toistetaan {title}',
	'core.a11y.paused': 'Pysäytetty',
	'core.a11y.stopped': 'Pysäytetty',
	'core.a11y.seeking': 'Etsitään {time}',
	'core.a11y.trackChange': 'Toistetaan nyt {title}',
	'core.a11y.error': 'Toiston aikana tapahtui virhe',
	'core.a11y.muted': 'Ääni pois',
	'core.a11y.unmuted': 'Ääni päällä',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Toisto pysäytettiin — toinen välilehti on nyt toistossa.',
	'plugin.media-session.unsupported': 'Käyttöjärjestelmän mediaohjainta ei ole saatavilla tässä selaimessa.',
};

export default fiTranslations;
