// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Sinhala core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'si',
 *   translations: {
 *     ...defaultTranslations,
 *     si: siTranslations,
 *   },
 * });
 */
export const siTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'අන්තර්ජාල සම්බන්ධතා නැත.',
	'core.network.timeout': 'සම්බන්ධතා කාලය ඉකුත්. නැවත උත්සාහ කරමින්…',
	'core.network.serverError': 'සර්වරයට ගැටළු ඇත. මොහොතකින් නැවත උත්සාහ කරන්න.',
	'core.network.notFound': 'එම සামගිය සොයාගත නොහැක.',
	'core.network.rateLimited': 'ඉතා ගණනක් ඉල්ලීම්. කරුණාකර මන්දගාමී කරන්න.',

	// Auth
	'core.auth.unauthenticated': 'ඔබේ සැසිය නැවුම් කිරීමට නැවත පිවිසෙන්න.',
	'core.auth.forbidden': 'ඔබේ ගිණුමට මෙම සामගිය වෙත ප්‍රවේශ අයිතියක් නැත.',
	'core.auth.refreshFailed': 'ඔබේ සැසිය නැවුම් කිරීමට නොහැකි විය. නැවත පිවිසෙන්න.',

	// Browser policy
	'core.policy.autoplayBlocked': 'ධාවනය ආරම්භ කිරීමට කොතැනක් ස්පර්ශ එකතු නැතහොත් ක්ලික් කරන්න.',
	'core.policy.userGestureRequired': 'ශබ්දය සක්‍රිය කිරීමට ස්පර්ශ කරන්න.',
	'core.policy.pipDenied': 'මෙම සන්දර්භයේ පින් පින්-සඳහා පින්තුර අයිතිවාසිකම් නැත.',
	'core.policy.fullscreenDenied': 'මෙම සන්දර්භයේ සම්පූර්ණ තිරය අයිතිවාසිකම් නැත.',
	'core.policy.wakeLockDenied': 'ධාවනය අතරතුර තිරය අඳුරු වීමට ඉඩ දිය හැකිය.',

	// Media
	'core.media.unsupported': 'ඔබේ බ්‍රවුසරය විසින් මෙම ආකෘතිය සහාය දක්වා නොමැත.',
	'core.media.decodeFailed': 'ධාවනය අසාර්ථක - ඉදිරියෙන් ඇති ප්‍රවේශ්‍ය මූලාධාරයට මාරු කිරීම.',
	'core.media.allDecodeFailed': 'මෙම සामගිය සඳහා කිසිදු ධාවනයක් සඳහා හැකිවෙතින් මූලාධාරය නොමැත.',

	// DRM
	'core.drm.outputProtection': 'ඔබේ ප්‍රදර්ශනය මෙම සामගිය සඳහා ආරක්ෂණ අවශ්‍යතා සපුරාලන්නේ නැත.',
	'core.drm.licenseFailed': 'මෙම සामගිය සඳහා බලපත්‍රය ලබාගත නොහැකි විය.',
	'core.drm.keySystemUnsupported': 'ඔබේ බ්‍රවුසරය අවශ්‍ය ආරක්ෂණ ක්‍රමය සහාය දක්වා නොමැත.',

	// State / dev
	'core.state.queueEmpty': 'පෙළට කිසිවක් නොමැත.',
	'core.state.notReady': 'ක්‍රීඩකය තවම සූදානම් නොවී ඇත.',

	// A11y announcements
	'core.a11y.playing': '{title} ධාවනය වේ',
	'core.a11y.paused': 'විරතිකර',
	'core.a11y.stopped': 'නතර කිරි',
	'core.a11y.seeking': '{time} කරා සෙවීම',
	'core.a11y.trackChange': 'දැන් {title} ධාවනය වේ',
	'core.a11y.error': 'ධාවනය අතරතුර දෝෂයක් සිදුවිය',
	'core.a11y.muted': 'නිහඩ',
	'core.a11y.unmuted': 'ශබ්දය සක්‍රිය',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'ධාවනය විරතිකර - වෙනත් ටැබය දැන් ධාවනය වේ.',
	'plugin.media-session.unsupported': 'OS මාධ්‍ය පාලනයන් මෙම බ්‍රවුසරයේ ලබා ගත නොහැකිය.',
};

export default siTranslations;
