// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Tagalog core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'tl',
 *   translations: {
 *     ...defaultTranslations,
 *     tl: tlTranslations,
 *   },
 * });
 */
export const tlTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Walang koneksyon sa internet.',
	'core.network.timeout': 'Ang koneksyon ay nag-timeout. Sinisikap muli…',
	'core.network.serverError': 'Ang server ay may mga problema. Subukan ulit sa ilang sandali.',
	'core.network.notFound': 'Ang nilalaman na iyon ay hindi mahanap.',
	'core.network.rateLimited': 'Masyadong maraming mga kahilingan. Mangyaring gumaan.',

	// Auth
	'core.auth.unauthenticated': 'Mag-log in ulit upang i-refresh ang iyong session.',
	'core.auth.forbidden': 'Ang iyong account ay walang access sa nilalaman na ito.',
	'core.auth.refreshFailed': 'Hindi maisenyo ang iyong sesyon. Mag-log in ulit.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Humawak o mag-click saanman upang simulan ang pagkukuha.',
	'core.policy.userGestureRequired': 'Humawak upang paganahin ang tunog.',
	'core.policy.pipDenied': 'Ang larawan sa larawan ay hindi pinapayagan sa kontekstong ito.',
	'core.policy.fullscreenDenied': 'Ang buong screen ay hindi pinapayagan sa kontekstong ito.',
	'core.policy.wakeLockDenied': 'Ang screen ay maaaring maging madilim sa panahon ng pagkukuha.',

	// Media
	'core.media.unsupported': 'Ang format na ito ay hindi sinusuportahan ng iyong browser.',
	'core.media.decodeFailed': 'Ang pagkukuha ay nabigo — lumipat sa susunod na available na pinagkukunan.',
	'core.media.allDecodeFailed': 'Walang available na playable na pinagkukunan para sa nilalaman na ito.',

	// DRM
	'core.drm.outputProtection': 'Ang iyong display ay hindi nakakatugon sa mga pangangailangan sa proteksyon para sa nilalaman na ito.',
	'core.drm.licenseFailed': 'Ang lisensya para sa nilalaman na ito ay hindi makakakuha.',
	'core.drm.keySystemUnsupported': 'Ang iyong browser ay hindi sumusuporta sa kinakailangang sistema ng proteksyon.',

	// State / dev
	'core.state.queueEmpty': 'Walang kahit ano sa queue.',
	'core.state.notReady': 'Ang player ay hindi pa handa.',

	// A11y announcements
	'core.a11y.playing': 'Naglalaro ng {title}',
	'core.a11y.paused': 'Iniwan',
	'core.a11y.stopped': 'Titigil',
	'core.a11y.seeking': 'Naghahanap sa {time}',
	'core.a11y.trackChange': 'Ngayon ay naglalaro ng {title}',
	'core.a11y.error': 'Ang isang error ay nagsimula sa panahon ng pagkukuha',
	'core.a11y.muted': 'Walang tunog',
	'core.a11y.unmuted': 'Tunog na naka-on',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Ang pagkukuha ay iniwan — ang iba pang tab ay ngayon naglalaro.',
	'plugin.media-session.unsupported': 'Ang mga kontrol ng media ng OS ay hindi available sa browser na ito.',
};

export default tlTranslations;
