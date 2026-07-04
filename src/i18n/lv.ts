// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Latvian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'lv',
 *   translations: {
 *     ...defaultTranslations,
 *     lv: lvTranslations,
 *   },
 * });
 */
export const lvTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Nav interneta savienojuma.',
	'core.network.timeout': 'Savienojuma noildze. Mēģina izsūtīt…',
	'core.network.serverError': 'Serveris saspēlējas problēmām. Mēģiniet vēlreiz pēc laika.',
	'core.network.notFound': 'Šo satura nevarēja atrast.',
	'core.network.rateLimited': 'Pārāk daudz pieprasījumu. Lūdzu, palēniniet.',

	// Auth
	'core.auth.unauthenticated': 'Pieteikties vēlreiz, lai atsvaidzinātu savu sesiju.',
	'core.auth.forbidden': 'Jūsu konts nespēj piekļūt šim saturam.',
	'core.auth.refreshFailed': 'Nevarēja atsvaidzināt jūsu sesiju. Pieteikties vēlreiz.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Pieskarieties vai noklikšķiniet jebkur, lai sāktu atskaņošanu.',
	'core.policy.userGestureRequired': 'Pieskarieties, lai iespējotu audio.',
	'core.policy.pipDenied': 'Attēls attēlā šajā kontekstā nav atļauts.',
	'core.policy.fullscreenDenied': 'Pilnekrāns šajā kontekstā nav atļauts.',
	'core.policy.wakeLockDenied': 'Ekrāns var kļūt tumšs atskaņošanas laikā.',

	// Media
	'core.media.unsupported': 'Jūsu pārlūks neatbalsta šo formātu.',
	'core.media.decodeFailed': 'Atskaņošana neizdevās — pārslēdzams uz nākamo pieejamo avotu.',
	'core.media.allDecodeFailed': 'Šim saturam nav pieejams atskaņojams avots.',

	// DRM
	'core.drm.outputProtection': 'Jūsu displejs neatbilst šī satura aizsardzības prasībām.',
	'core.drm.licenseFailed': 'Nevarēja iegūt licenci šim saturam.',
	'core.drm.keySystemUnsupported': 'Jūsu pārlūks neatbalsta nepieciešamo aizsardzības sistēmu.',

	// State / dev
	'core.state.queueEmpty': 'Rindā nav nekā.',
	'core.state.notReady': 'Atskaņotājs vēl nav gatavs.',

	// A11y announcements
	'core.a11y.playing': '{title} atskaņošana',
	'core.a11y.paused': 'Pauzēts',
	'core.a11y.stopped': 'Apturēts',
	'core.a11y.seeking': 'Meklējot {time}',
	'core.a11y.trackChange': 'Tagad atskaņo {title}',
	'core.a11y.error': 'Atskaņošanas laikā radās kļūda',
	'core.a11y.muted': 'Klusināts',
	'core.a11y.unmuted': 'Skaņa ieslēgta',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Atskaņošana pauzēta — cits cilne tagad atskaņo.',
	'plugin.media-session.unsupported': 'OS medijas vadības nav pieejamas šajā pārlūkā.',
};

export default lvTranslations;
