// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Norwegian Bokmål core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'nb',
 *   translations: {
 *     ...defaultTranslations,
 *     nb: nbTranslations,
 *   },
 * });
 */
export const nbTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Ingen internettforbindelse.',
	'core.network.timeout': 'Forbindelsen var utløpt. Prøver igjen…',
	'core.network.serverError': 'Serveren har problemer. Prøv igjen om en stund.',
	'core.network.notFound': 'Det innholdet kunne ikke finnes.',
	'core.network.rateLimited': 'For mange forespørsler. Vennligst reduser hastigheten.',

	// Auth
	'core.auth.unauthenticated': 'Logg inn igjen for å oppdatere økten din.',
	'core.auth.forbidden': 'Kontoen din har ingen tilgang til dette innholdet.',
	'core.auth.refreshFailed': 'Kunne ikke oppdatere økten din. Logg inn igjen.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Trykk eller klikk hvor som helst for å starte avspilling.',
	'core.policy.userGestureRequired': 'Trykk for å aktivere lyd.',
	'core.policy.pipDenied': 'Bilde-i-bilde er ikke tillatt i denne konteksten.',
	'core.policy.fullscreenDenied': 'Fullskjerm er ikke tillatt i denne konteksten.',
	'core.policy.wakeLockDenied': 'Skjermen kan bli mørkere under avspilling.',

	// Media
	'core.media.unsupported': 'Dette formatet støttes ikke av nettleseren din.',
	'core.media.decodeFailed': 'Avspilling mislyktes — bytting til neste tilgjengelige kilde.',
	'core.media.allDecodeFailed': 'Ingen avspillbar kilde er tilgjengelig for dette innholdet.',

	// DRM
	'core.drm.outputProtection': 'Skjermen din oppfyller ikke beskyttelseskravene for dette innholdet.',
	'core.drm.licenseFailed': 'Kunne ikke få en lisens for dette innholdet.',
	'core.drm.keySystemUnsupported': 'Nettleseren din støtter ikke det påkrevde beskyttelsessystemet.',

	// State / dev
	'core.state.queueEmpty': 'Det er ingenting i køen.',
	'core.state.notReady': 'Avspilleren er ikke klar ennå.',

	// A11y announcements
	'core.a11y.playing': 'Spiller av {title}',
	'core.a11y.paused': 'Pausert',
	'core.a11y.stopped': 'Stoppet',
	'core.a11y.seeking': 'Søker til {time}',
	'core.a11y.trackChange': 'Spiller nå av {title}',
	'core.a11y.error': 'En feil oppstod under avspilling',
	'core.a11y.muted': 'Dempet',
	'core.a11y.unmuted': 'Lyd på',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Avspilling ble satt på pause — en annen fane spilles nå av.',
	'plugin.media-session.unsupported': 'OS-mediekontroller er ikke tilgjengelige i denne nettleseren.',
};

export default nbTranslations;
