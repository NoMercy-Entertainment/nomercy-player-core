// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Norwegian Nynorsk core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'nn',
 *   translations: {
 *     ...defaultTranslations,
 *     nn: nnTranslations,
 *   },
 * });
 */
export const nnTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Ingen internetttilkopling.',
	'core.network.timeout': 'Tilkoplinga vart for lang. Prøver igjen…',
	'core.network.serverError': 'Serveren har problem. Prøv igjen om ei stund.',
	'core.network.notFound': 'Innhaldet kunne ikkje finnast.',
	'core.network.rateLimited': 'For mange førespurnader. Venlegt sakta ned.',

	// Auth
	'core.auth.unauthenticated': 'Logg inn att for å oppdatera økta di.',
	'core.auth.forbidden': 'Kontoen din har ikkje tilgang til dette innhaldet.',
	'core.auth.refreshFailed': 'Kunne ikkje oppdatera økta di. Logg inn att.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Trykk eller klikk nokestad for å starta spelingen.',
	'core.policy.userGestureRequired': 'Trykk for å slå på lyd.',
	'core.policy.pipDenied': 'Bilete i bilete er ikkje tillate i denne samanhengen.',
	'core.policy.fullscreenDenied': 'Fullskjerm er ikkje tillate i denne samanhengen.',
	'core.policy.wakeLockDenied': 'Skjermen kan bli mørkare under spelingen.',

	// Media
	'core.media.unsupported': 'Dette formatet vert ikkje støtta av nettlesaren din.',
	'core.media.decodeFailed': 'Spelingen feil - byter til den neste tilgjengelege kjelden.',
	'core.media.allDecodeFailed': 'Ingen spelbar kjelde er tilgjengeleg for dette innhaldet.',

	// DRM
	'core.drm.outputProtection': 'Skjermen din oppfyller ikkje vernekrava for dette innhaldet.',
	'core.drm.licenseFailed': 'Kunne ikkje få ei lisens for dette innhaldet.',
	'core.drm.keySystemUnsupported': 'Nettlesaren din støttar ikkje det nødvendige vernessystemet.',

	// State / dev
	'core.state.queueEmpty': 'Det er ingenting i køen.',
	'core.state.notReady': 'Spelaren er ikkje klar endå.',

	// A11y announcements
	'core.a11y.playing': 'Spelar av {title}',
	'core.a11y.paused': 'Pausert',
	'core.a11y.stopped': 'Stansa',
	'core.a11y.seeking': 'Søkjer til {time}',
	'core.a11y.trackChange': 'Spelar no av {title}',
	'core.a11y.error': 'Ein feil oppstod under spelingen',
	'core.a11y.muted': 'Dempet',
	'core.a11y.unmuted': 'Lyd på',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Spelingen vart pausa — ein annan fane spelar no av.',
	'plugin.media-session.unsupported': 'OS-mediekontrollar er ikkje tilgjengelege i denne nettlesaren.',
};

export default nnTranslations;
