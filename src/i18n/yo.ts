// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Yoruba core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'yo',
 *   translations: {
 *     ...defaultTranslations,
 *     yo: yoTranslations,
 *   },
 * });
 */
export const yoTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Bayi si Ikunra Intanẹti.',
	'core.network.timeout': 'Akoko kika kika ni jẹ. Eti gbe…',
	'core.network.serverError': 'Server ni awọ àwọn ẹ̀ ìran. Gbe eti lo ni akoko.',
	'core.network.notFound': 'Iyalẹnu naa ko le gbê.',
	'core.network.rateLimited': 'Ọpọlọpọ ìbeèrè nidii. Jọwọ ṣanwọ.',

	// Auth
	'core.auth.unauthenticated': 'Lo si ṣafihan lẹẹkan si gbe ṣiṣẹ rẹ.',
	'core.auth.forbidden': 'Iwe rẹ kii ni ihọtọ si iyalẹnu yii.',
	'core.auth.refreshFailed': 'A kii le tun ṣiṣẹ rẹ. Ṣafihan lẹẹkan.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Kan tabi un nibikita lati bẹrẹ ṣeé.',
	'core.policy.userGestureRequired': 'Kan lati kọja ohun ẹlọ.',
	'core.policy.pipDenied': 'Aworan ni aworan kii ni iranlọwọ nidani asiko yii.',
	'core.policy.fullscreenDenied': 'Ibadandun akúkù kii ni iranlọwọ nidani asiko yii.',
	'core.policy.wakeLockDenied': 'Ibadandun le di dudu lakoko ṣeé.',

	// Media
	'core.media.unsupported': 'Oṣu yii kii ni iṣẹ ti rẹ ero ayẹ.',
	'core.media.decodeFailed': 'Ṣeé fẹ - yipada si orisun titi tẹlẹ.',
	'core.media.allDecodeFailed': 'Ko si orisun ṣeé ti o wa fun iyalẹnu yii.',

	// DRM
	'core.drm.outputProtection': 'Ibadandun rẹ kii ṭẹ awọn iye iṣọ fun iyalẹnu yii.',
	'core.drm.licenseFailed': 'A kii le lo ipo fun iyalẹnu yii.',
	'core.drm.keySystemUnsupported': 'Ero ayẹ rẹ kii lo ètò ọjọ tí o nilo.',

	// State / dev
	'core.state.queueEmpty': 'Bayi ko si ohun nla ninu ila.',
	'core.state.notReady': 'Aṣẹdá kii ṣebi lọkọ bẹrẹ.',

	// A11y announcements
	'core.a11y.playing': 'Ṣeé {title}',
	'core.a11y.paused': 'Ọjòó',
	'core.a11y.stopped': 'Ọkọ',
	'core.a11y.seeking': 'Nilo {time}',
	'core.a11y.trackChange': 'Bayi ṣeé {title}',
	'core.a11y.error': 'Aṣiṣe kan ṣẹlẹ lakoko ṣeé',
	'core.a11y.muted': 'Ẹdidìde',
	'core.a11y.unmuted': 'Ohun ẹlọ jade',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Ṣeé jẹ iyẹn - iwe miiran ṣeé bayi.',
	'plugin.media-session.unsupported': 'Awọn asopọ ohun ẹlọ OS kii wa nidani ero ayẹ yii.',
};

export default yoTranslations;
