// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Croatian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'hr',
 *   translations: {
 *     ...defaultTranslations,
 *     hr: hrTranslations,
 *   },
 * });
 */
export const hrTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Nema internet konekcije.',
	'core.network.timeout': 'Isteklo vrijeme konekcije. Pokušaj ponovno…',
	'core.network.serverError': 'Server ima problema. Pokušajte ponovno za trenutak.',
	'core.network.notFound': 'Taj sadržaj se ne može pronaći.',
	'core.network.rateLimited': 'Previše zahtjeva. Molimo usporrite.',

	// Auth
	'core.auth.unauthenticated': 'Ponovno se prijavite da osvježite sesiju.',
	'core.auth.forbidden': 'Vaš račun nema pristupa ovom sadržaju.',
	'core.auth.refreshFailed': 'Sesija se ne može osvježiti. Ponovno se prijavite.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Dodirnite ili kliknite bilo gdje za početak reprodukcije.',
	'core.policy.userGestureRequired': 'Dodirnite da omogućite zvuk.',
	'core.policy.pipDenied': 'Slika u slici nije dopuštena u ovom kontekstu.',
	'core.policy.fullscreenDenied': 'Puni zaslon nije dopušten u ovom kontekstu.',
	'core.policy.wakeLockDenied': 'Zaslon se može potamniti tijekom reprodukcije.',

	// Media
	'core.media.unsupported': 'Ovaj oblik nije podržan od strane vašeg preglednika.',
	'core.media.decodeFailed': 'Reprodukcija nije uspjela — prebacivanje na sljedeći dostupan izvor.',
	'core.media.allDecodeFailed': 'Nema dostupnog izlaza reprodukcije za ovaj sadržaj.',

	// DRM
	'core.drm.outputProtection': 'Vaš zaslon ne ispunjava zahtjeve zaštite za ovaj sadržaj.',
	'core.drm.licenseFailed': 'Nije moguće dobiti licencu za ovaj sadržaj.',
	'core.drm.keySystemUnsupported': 'Vaš preglednik ne podržava potreban sustav zaštite.',

	// State / dev
	'core.state.queueEmpty': 'Nema ničega u redu.',
	'core.state.notReady': 'Igrač nije još spreman.',

	// A11y announcements
	'core.a11y.playing': 'Reprodukcija {title}',
	'core.a11y.paused': 'Pauziran',
	'core.a11y.stopped': 'Zaustavljen',
	'core.a11y.seeking': 'Tražim {time}',
	'core.a11y.trackChange': 'Sada se reproducira {title}',
	'core.a11y.error': 'Greška se dogodila tijekom reprodukcije',
	'core.a11y.muted': 'Bez zvuka',
	'core.a11y.unmuted': 'Zvuk uključen',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Reprodukcija pauzirana — druga kartica se sada reproducira.',
	'plugin.media-session.unsupported': 'OS medijske kontrole nisu dostupne u ovom pregledniku.',
};

export default hrTranslations;
