// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Afrikaans core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'af',
 *   translations: {
 *     ...defaultTranslations,
 *     af: afTranslations,
 *   },
 * });
 */
export const afTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Geen internetverbinding.',
	'core.network.timeout': 'Die verbinding het tyd uitgestel. Probeer weer…',
	'core.network.serverError': 'Die bediener het probleme. Probeer oor \'n oomblik weer.',
	'core.network.notFound': 'Daardie inhoud kon nie gevind word nie.',
	'core.network.rateLimited': 'Te veel versoeke. Vertraag asseblief.',

	// Auth
	'core.auth.unauthenticated': 'Teken weer aan om jou sessie te verfris.',
	'core.auth.forbidden': 'Jou rekening het geen toegang tot hierdie inhoud nie.',
	'core.auth.refreshFailed': 'Kon nie jou sessie verfris nie. Teken weer aan.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Tik of klik enige plek om afspeling te begin.',
	'core.policy.userGestureRequired': 'Tik om klank in te skakel.',
	'core.policy.pipDenied': 'Prent-in-prent is nie in hierdie konteks toegelaat nie.',
	'core.policy.fullscreenDenied': 'Volskerm is nie in hierdie konteks toegelaat nie.',
	'core.policy.wakeLockDenied': 'Die skerm kan tydens afspeling verduister.',

	// Media
	'core.media.unsupported': 'Hierdie formaat word nie deur jou blaaier ondersteun nie.',
	'core.media.decodeFailed': 'Afspeling het misluk — skakel oor na die volgende beskikbare bron.',
	'core.media.allDecodeFailed': 'Geen afspeelbare bron is beskikbaar vir hierdie inhoud nie.',

	// DRM
	'core.drm.outputProtection': 'Jou vertoon voldoen nie aan die beskermingsvereistes vir hierdie inhoud nie.',
	'core.drm.licenseFailed': 'Kon nie \'n lisensie vir hierdie inhoud kry nie.',
	'core.drm.keySystemUnsupported': 'Jou blaaier ondersteun nie die vereiste beveiligingstelsel nie.',

	// State / dev
	'core.state.queueEmpty': 'Daar is niks in die tou nie.',
	'core.state.notReady': 'Die speler is nog nie gereed nie.',

	// A11y announcements
	'core.a11y.playing': '{title} word gespeel',
	'core.a11y.paused': 'Gepauzeerd',
	'core.a11y.stopped': 'Gestop',
	'core.a11y.seeking': 'Soek na {time}',
	'core.a11y.trackChange': 'Speel nou {title}',
	'core.a11y.error': 'Fout het tydens afspeling voorgekom',
	'core.a11y.muted': 'Stom',
	'core.a11y.unmuted': 'Klank aan',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Afspeling gepauzeerd — \'n ander oortjie speel nou.',
	'plugin.media-session.unsupported': 'OS-mediabediening is nie in hierdie blaaier beskikbaar nie.',
};

export default afTranslations;
