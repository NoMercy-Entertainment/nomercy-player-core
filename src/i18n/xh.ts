// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Xhosa core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'xh',
 *   translations: {
 *     ...defaultTranslations,
 *     xh: xhTranslations,
 *   },
 * });
 */
export const xhTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Ayikho ikhonnekshini ye-intanethi.',
	'core.network.timeout': 'Ikhonnekshini ithathe ixesha. Kuzama kwakhona…',
	'core.network.serverError': 'Isirveyi inemingxaki. Zama kwakhona emomtweni.',
	'core.network.notFound': 'Elo noxulo alizukwazi ukufunyanwa.',
	'core.network.rateLimited': 'Imibuzo emininzi kakhulu. Cela ukuba khula.',

	// Auth
	'core.auth.unauthenticated': 'Buya kuqala ngokuthula uphikiso lwakho.',
	'core.auth.forbidden': 'I-akhawunti yakho ayinabvumelwano lokungena kule noxulo.',
	'core.auth.refreshFailed': 'Izalamele ukuvuselela uhlobo lwakho. Buya kuqala ngokuthula.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Thintelana okanye cofa kunaphi na ukuqalela ukulunguleleka.',
	'core.policy.userGestureRequired': 'Thintelela ukuvula umsebenzi wesandi.',
	'core.policy.pipDenied': 'Isithombe kumthombo wesithombe akuvumelekanga kule ngxelo.',
	'core.policy.fullscreenDenied': 'Isikrini esigqithisileyo akuvumelekanga kule ngxelo.',
	'core.policy.wakeLockDenied': 'Isikrini sinokufa ubumnyama ngexesha lokusasaza.',

	// Media
	'core.media.unsupported': 'Olu hlobo alucetywsielwanga ngumbuki wakho.',
	'core.media.decodeFailed': 'Ukulunguleleka kwathandeka - ukutshintshelwa kwi-source elandelayo.',
	'core.media.allDecodeFailed': 'Ayikho imvelaphi yokuhlula efumanekayo kale noxulo.',

	// DRM
	'core.drm.outputProtection': 'Iskrini yakho ayingahambi izibango zokhuseleko kale noxulo.',
	'core.drm.licenseFailed': 'Ayikho iselula efumanekayo kale noxulo.',
	'core.drm.keySystemUnsupported': 'Umbuki wakho awakhethi inkqubo yohuseleko efanelekayo.',

	// State / dev
	'core.state.queueEmpty': 'Ayikho nto kwilayini.',
	'core.state.notReady': 'Umdlali akambi ulungele.',

	// A11y announcements
	'core.a11y.playing': 'Ukulunguleleka {title}',
	'core.a11y.paused': 'Kumile',
	'core.a11y.stopped': 'Imiselwe',
	'core.a11y.seeking': 'Ukuphucula {time}',
	'core.a11y.trackChange': 'Ngoku ukulunguleleka {title}',
	'core.a11y.error': 'Impilo yenzeka ngexesha lokusasaza',
	'core.a11y.muted': 'Ukutula',
	'core.a11y.unmuted': 'Umsebenzi ovulekile',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Ukulunguleleka kumile - enye ithebhu ngoku ilunguleleka.',
	'plugin.media-session.unsupported': 'Izisombululo zesixhobo ze-OS azikhona kule umbuki.',
};

export default xhTranslations;
