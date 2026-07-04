// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Lithuanian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'lt',
 *   translations: {
 *     ...defaultTranslations,
 *     lt: ltTranslations,
 *   },
 * });
 */
export const ltTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Nėra interneto ryšio.',
	'core.network.timeout': 'Ryšio baigėsi laikas. Bandau iš naujo…',
	'core.network.serverError': 'Serveris turi problemų. Bandykite vėl po kurio laiko.',
	'core.network.notFound': 'Šio turinio nepavyko rasti.',
	'core.network.rateLimited': 'Per daug prašymų. Prašome sulėtinti.',

	// Auth
	'core.auth.unauthenticated': 'Prisijunkite iš naujo, kad atnaujintumėte savo sesiją.',
	'core.auth.forbidden': 'Jūsų paskyra neturi prieigos prie šio turinio.',
	'core.auth.refreshFailed': 'Nepavyko atnaujinti jūsų sesijos. Prisijunkite iš naujo.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Palieskite arba spustelėkite bet kurioje vietoje, kad pradėtumėte atkūrimą.',
	'core.policy.userGestureRequired': 'Palieskite, norėdami įjungti garsą.',
	'core.policy.pipDenied': 'Nuotrauka nuotraukoje šiame kontekste neleistina.',
	'core.policy.fullscreenDenied': 'Pilnas ekranas šiame kontekste neleistinas.',
	'core.policy.wakeLockDenied': 'Atkūrimo metu ekranas gali parusvėti.',

	// Media
	'core.media.unsupported': 'Jūsų naršyklė nepalaiko šio formato.',
	'core.media.decodeFailed': 'Atkūrimas nepavyko — perjungimas į kitą prieinamą šaltinį.',
	'core.media.allDecodeFailed': 'Nėra prieinamo atkūrimo šaltinio šiam turiniui.',

	// DRM
	'core.drm.outputProtection': 'Jūsų ekranas neatitinka šio turinio apsaugos reikalavimų.',
	'core.drm.licenseFailed': 'Nepavyko gauti šio turinio licencijos.',
	'core.drm.keySystemUnsupported': 'Jūsų naršyklė nepalaika reikalingos apsaugos sistemos.',

	// State / dev
	'core.state.queueEmpty': 'Eilėje nėra nieko.',
	'core.state.notReady': 'Grotuvas dar nėra paruoštas.',

	// A11y announcements
	'core.a11y.playing': '{title} atkūrimas',
	'core.a11y.paused': 'Pauzuota',
	'core.a11y.stopped': 'Sustabdyta',
	'core.a11y.seeking': 'Ieško {time}',
	'core.a11y.trackChange': 'Dabar atkūrima {title}',
	'core.a11y.error': 'Atkūrimo metu įvyko klaida',
	'core.a11y.muted': 'Nutildyta',
	'core.a11y.unmuted': 'Garsas įjungtas',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Atkūrimas sustabdytas — kita skirtukas dabar atkūrinama.',
	'plugin.media-session.unsupported': 'OS medijos valdikliai nėra pasiekiami šioje naršyklėje.',
};

export default ltTranslations;
