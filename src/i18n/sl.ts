// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slovenian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'sl',
 *   translations: {
 *     ...defaultTranslations,
 *     sl: slTranslations,
 *   },
 * });
 */
export const slTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Ni internetne povezave.',
	'core.network.timeout': 'Povezava je potekla. Ponovno poskušam…',
	'core.network.serverError': 'Strežnik ima težave. Poskusite ponovno čez trenutek.',
	'core.network.notFound': 'Te vsebine ni bilo mogoče najti.',
	'core.network.rateLimited': 'Premalo zahtevkov. Prosim, počakajte.',

	// Auth
	'core.auth.unauthenticated': 'Ponovno se prijavite, da osvežite sejo.',
	'core.auth.forbidden': 'Vaš račun nima dostopa do te vsebine.',
	'core.auth.refreshFailed': 'Seje ni bilo mogoče osvežiti. Ponovno se prijavite.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Dotaknite se ali kliknite kjerkoli, da začnete predvajanje.',
	'core.policy.userGestureRequired': 'Dotaknite se za vključitev zvoka.',
	'core.policy.pipDenied': 'Slika v sliki ni dovoljena v tem kontekstu.',
	'core.policy.fullscreenDenied': 'Celozaslonski način ni dovoljen v tem kontekstu.',
	'core.policy.wakeLockDenied': 'Zaslon se lahko temni med predvajanjem.',

	// Media
	'core.media.unsupported': 'Vaš brskalnik ne podpira te oblike.',
	'core.media.decodeFailed': 'Predvajanje je neuspešno — preklapljam na naslednji razpoložljiv vir.',
	'core.media.allDecodeFailed': 'Za to vsebino ni razpoložljive izvorne datoteke.',

	// DRM
	'core.drm.outputProtection': 'Vaš zaslon ne izpolnjuje zahtev za zaščito te vsebine.',
	'core.drm.licenseFailed': 'Licence za to vsebino ni bilo mogoče pridobiti.',
	'core.drm.keySystemUnsupported': 'Vaš brskalnik ne podpira zahtevnega sistema zaščite.',

	// State / dev
	'core.state.queueEmpty': 'V čakalni vrsti ni ničesar.',
	'core.state.notReady': 'Predvajalnik še ni pripravljen.',

	// A11y announcements
	'core.a11y.playing': 'Predvajanje {title}',
	'core.a11y.paused': 'Premor',
	'core.a11y.stopped': 'Ustavljeno',
	'core.a11y.seeking': 'Iskanje {time}',
	'core.a11y.trackChange': 'Sedaj predvajanje {title}',
	'core.a11y.error': 'Med predvajanjem je prišlo do napake',
	'core.a11y.muted': 'Utišano',
	'core.a11y.unmuted': 'Zvok prižgan',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Predvajanje je pauznirano — druga zavihek sedaj predvaja.',
	'plugin.media-session.unsupported': 'Kontrolniki medijev OS niso na voljo v tem brskalniku.',
};

export default slTranslations;
