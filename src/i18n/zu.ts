// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Zulu core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'zu',
 *   translations: {
 *     ...defaultTranslations,
 *     zu: zuTranslations,
 *   },
 * });
 */
export const zuTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Ayikho ikhannekshini ye-Inthanekhi.',
	'core.network.timeout': 'Ikhannekshini imisile isikhathi. Kuzama kwakhona…',
	'core.network.serverError': 'Isiveri sinezinkinga. Zama kwakhona emhluthweni.',
	'core.network.notFound': 'Lelo nokuqukethwe akalikhona lokuhlola.',
	'core.network.rateLimited': 'Imibuzo emininzi kakhulu. Ngiyabinqumela.',

	// Auth
	'core.auth.unauthenticated': 'Ngena kabusha ukuze ubuye kusesiweni sakho.',
	'core.auth.forbidden': 'I-akhawunti yakho ayinalo inkulumo yokufakela okuqukethwe okunjalo.',
	'core.auth.refreshFailed': 'Ayikwazi ukubuyela kusesiweni sakho. Ngena kabusha.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Thonitho noma ucinzekelele kunoma akulungile ukuqala ukudlala.',
	'core.policy.userGestureRequired': 'Thonitho ukuze kuvuleke umsindo.',
	'core.policy.pipDenied': 'Isithombe efakweni kwisithombe akuvumiswanga kulesi simanje.',
	'core.policy.fullscreenDenied': 'I-skrini ephelele akuvumiswanga kulesi simanje.',
	'core.policy.wakeLockDenied': 'I-skrini ingaba nimnyama ngesikhathi sokudlala.',

	// Media
	'core.media.unsupported': 'Uhlelo lwakho lwesithupha akalu zelusi lesi sikhundla.',
	'core.media.decodeFailed': 'Ukudlala kuwedluliselwe — ukushintsha kwenkundla elandelayo efanele.',
	'core.media.allDecodeFailed': 'Ayikho inkundla yokudlala efanele kwelokhu kuqukethwe.',

	// DRM
	'core.drm.outputProtection': 'Isikrini sakho asikugcini izidingo zokukhusela okunjalo kuqukethwe.',
	'core.drm.licenseFailed': 'Ayikwazi ukuthola ilayisense yokuleloqhinindikwa.',
	'core.drm.keySystemUnsupported': 'Uhlelo lwakho lwesithupha alusekeli uhlelo lokunolinda olufanele.',

	// State / dev
	'core.state.queueEmpty': 'Ayikho okuthile emithi.',
	'core.state.notReady': 'Umdlali akambi ulungele.',

	// A11y announcements
	'core.a11y.playing': 'Udlala {title}',
	'core.a11y.paused': 'Uphumzile',
	'core.a11y.stopped': 'Imiselwe',
	'core.a11y.seeking': 'Ekhela ku-{time}',
	'core.a11y.trackChange': 'Manje udlala u-{title}',
	'core.a11y.error': 'Ikona lidale ngesikhathi sokudlala',
	'core.a11y.muted': 'Isilungu',
	'core.a11y.unmuted': 'Umsindo uvuleke',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Ukudlala kuphumzile — ithabu enye manje iyadlala.',
	'plugin.media-session.unsupported': 'Izilawuli zemediyam ze-OS azitholakali kulolu hlelo lwesithupha.',
};

export default zuTranslations;
