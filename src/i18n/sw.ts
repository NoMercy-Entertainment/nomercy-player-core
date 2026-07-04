// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Swahili core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'sw',
 *   translations: {
 *     ...defaultTranslations,
 *     sw: swTranslations,
 *   },
 * });
 */
export const swTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Hakuna muunganisho wa intaneti.',
	'core.network.timeout': 'Muunganisho umehitaji ujumbe. Kujaribu tena…',
	'core.network.serverError': 'Seva ina matatizo. Jaribu tena baada ya dakika.',
	'core.network.notFound': 'Hicho msimu hakuweza kupatikana.',
	'core.network.rateLimited': 'Maombi mengi sana. Tafadhali polepole.',

	// Auth
	'core.auth.unauthenticated': 'Ingia tena ili kufanya kazi yako jipya.',
	'core.auth.forbidden': 'Akaunti yako haina ufahamu wa msimu huu.',
	'core.auth.refreshFailed': 'Haiwezi kufanya kazi jipya kwa akaunti yako. Ingia tena.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Gusa au bonyeza mahali popote ili kuanza kucheza.',
	'core.policy.userGestureRequired': 'Gusa ili kukamatia sauti.',
	'core.policy.pipDenied': 'Picha ndani ya picha haijaidhiniywa katika muktadha huu.',
	'core.policy.fullscreenDenied': 'Skrini kamili haijaidhiniywa katika muktadha huu.',
	'core.policy.wakeLockDenied': 'Skrini inaweza kuwa na giza wakati wa kucheza.',

	// Media
	'core.media.unsupported': 'Umbizo hili halielewi na kivinjari chako.',
	'core.media.decodeFailed': 'Kucheza kumefeli — kubanisha chanzo kinachofuata.',
	'core.media.allDecodeFailed': 'Hakuna chanzo cha kucheza kinachoofa kwa msimu huu.',

	// DRM
	'core.drm.outputProtection': 'Onyesho lako halikidhi mahitaji ya ulinzi wa msimu huu.',
	'core.drm.licenseFailed': 'Haiwezi kupata leseni kwa msimu huu.',
	'core.drm.keySystemUnsupported': 'Kivinjari chako hakielewi mfumo wa ulinzi unaohitajika.',

	// State / dev
	'core.state.queueEmpty': 'Hakuna kitu katika foleni.',
	'core.state.notReady': 'Mchezaji bado hajako tayari.',

	// A11y announcements
	'core.a11y.playing': 'Inacheza {title}',
	'core.a11y.paused': 'Imesimamishwa',
	'core.a11y.stopped': 'Imekamatia',
	'core.a11y.seeking': 'Inatafuta {time}',
	'core.a11y.trackChange': 'Sasa inacheza {title}',
	'core.a11y.error': 'Hitilafu ilitokea wakati wa kucheza',
	'core.a11y.muted': 'Sifiri',
	'core.a11y.unmuted': 'Sauti kwenye',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Kucheza kumesimamishwa — kichupo kingine sasa kinacheza.',
	'plugin.media-session.unsupported': 'Vidhibiti vya vyombo vya habari vya OS havielewi katika kivinjari hiki.',
};

export default swTranslations;
