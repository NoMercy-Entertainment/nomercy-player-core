// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Dutch core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'nl',
 *   translations: {
 *     ...defaultTranslations,
 *     nl: nlTranslations,
 *   },
 * });
 */
export const nlTranslations: Record<string, string> = {
	// Netwerk
	'core.network.offline': 'Geen internetverbinding.',
	'core.network.timeout': 'De verbinding duurde te lang. Opnieuw proberen…',
	'core.network.serverError': 'De server heeft problemen. Probeer het over een moment opnieuw.',
	'core.network.notFound': 'Die inhoud kon niet worden gevonden.',
	'core.network.rateLimited': 'Te veel verzoeken. Probeer het zo dadelijk opnieuw.',

	// Authenticatie
	'core.auth.unauthenticated': 'Meld je opnieuw aan om je sessie te vernieuwen.',
	'core.auth.forbidden': 'Je account heeft geen toegang tot deze inhoud.',
	'core.auth.refreshFailed': 'Je sessie kon niet worden vernieuwd. Meld je opnieuw aan.',

	// Browserbeleid
	'core.policy.autoplayBlocked': 'Tik of klik ergens om het afspelen te starten.',
	'core.policy.userGestureRequired': 'Tik om audio in te schakelen.',
	'core.policy.pipDenied': 'Beeld-in-beeld is niet toegestaan in deze context.',
	'core.policy.fullscreenDenied': 'Volledig scherm is niet toegestaan in deze context.',
	'core.policy.wakeLockDenied': 'Het scherm kan dimmen tijdens het afspelen.',

	// Media
	'core.media.unsupported': 'Dit formaat wordt niet ondersteund door je browser.',
	'core.media.decodeFailed': 'Afspelen mislukt — overschakelen naar de volgende beschikbare bron.',
	'core.media.allDecodeFailed': 'Er is geen afspeelbare bron beschikbaar voor deze inhoud.',

	// DRM
	'core.drm.outputProtection': 'Je beeldscherm voldoet niet aan de beveiligingsvereisten voor deze inhoud.',
	'core.drm.licenseFailed': 'Kon geen licentie ophalen voor deze inhoud.',
	'core.drm.keySystemUnsupported': 'Je browser ondersteunt het vereiste beveiligingssysteem niet.',

	// Toestand / ontwikkeling
	'core.state.queueEmpty': 'De wachtrij is leeg.',
	'core.state.notReady': 'De speler is nog niet gereed.',

	// A11y aankondigingen
	'core.a11y.playing': '{title} wordt afgespeeld',
	'core.a11y.paused': 'Gepauzeerd',
	'core.a11y.stopped': 'Gestopt',
	'core.a11y.seeking': 'Doorspoelen naar {time}',
	'core.a11y.trackChange': 'Nu wordt afgespeeld: {title}',
	'core.a11y.error': 'Er is een fout opgetreden tijdens het afspelen',
	'core.a11y.muted': 'Gedempt',
	'core.a11y.unmuted': 'Dempen opgeheven',

	// Kit-plugin levenscyclus (consumentgericht)
	'plugin.tab-leader.lost': 'Afspelen gepauzeerd — een ander tabblad speelt nu af.',
	'plugin.media-session.unsupported': 'OS-mediabediening is niet beschikbaar in deze browser.',
};
