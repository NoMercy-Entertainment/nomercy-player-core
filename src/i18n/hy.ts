// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Armenian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'hy',
 *   translations: {
 *     ...defaultTranslations,
 *     hy: hyTranslations,
 *   },
 * });
 */
export const hyTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Ինտերնետի միացում չկա.',
	'core.network.timeout': 'Միացման ժամանակ սպառվել է: Նորից փորձում…',
	'core.network.serverError': 'Սերվերն ունի խնդիրներ: Փորձեք կրկին մի պահ:',
	'core.network.notFound': 'Այդ բովանդակությունը գտնել չէր հաջողվել:',
	'core.network.rateLimited': 'Շատ կբերանքներ: Խնդրում եմ, դանդաղեցրեք:',

	// Auth
	'core.auth.unauthenticated': 'Վերից մուտք գործեք ձեր հանդիսավորմունքը թարմացնելու համար:',
	'core.auth.forbidden': 'Ձեր հաշիվն այս բովանդակությունը մուտք չունի:',
	'core.auth.refreshFailed': 'Ձեր հանդիսավորմունքը թարմացնել չէր հաջողվել: Վերից մուտք գործեք:',

	// Browser policy
	'core.policy.autoplayBlocked': 'Հպեք կամ սեղմեք ցանկացած տեղ վերածնունցման սկսելու համար:',
	'core.policy.userGestureRequired': 'Հպեք ձայնն միացնելու համար:',
	'core.policy.pipDenied': 'Պատկերը պատկերում արգելված է այս համատեքստում:',
	'core.policy.fullscreenDenied': 'Լիաեկրան արգելված է այս համատեքստում:',
	'core.policy.wakeLockDenied': 'Էկրանը կարող է մութ պահել վերածնունցման ընթացքում:',

	// Media
	'core.media.unsupported': 'Այս ձևաչափը ձեր դիտարկիչը չի սատարում:',
	'core.media.decodeFailed': 'Վերածնունցումն ձախողվել է — հանդուրժեցում հաջորդ հասանելի աղբյուրին:',
	'core.media.allDecodeFailed': 'Այս բովանդակության համար վերածնունցման հասանելի աղբյուր չկա:',

	// DRM
	'core.drm.outputProtection': 'Ձեր ցուցադրումը չի համապատասխանում այս բովանդակության պաշտպանման պահանջներին:',
	'core.drm.licenseFailed': 'Այս բովանդակության լիցենզիա ստանալու չհաջողվեց:',
	'core.drm.keySystemUnsupported': 'Ձեր դիտարկիչը չի սատարում պահանջվող պաշտպանության համակարգը:',

	// State / dev
	'core.state.queueEmpty': 'Հերթում ոչ մի բան չկա:',
	'core.state.notReady': 'Վերածնունցիչը դեռ պատրաստ չէ:',

	// A11y announcements
	'core.a11y.playing': '{title} վերածնունցում',
	'core.a11y.paused': 'Դադարեցված',
	'core.a11y.stopped': 'Կանգ',
	'core.a11y.seeking': 'Որոնում {time}',
	'core.a11y.trackChange': 'Այժմ {title} վերածնունցում',
	'core.a11y.error': 'Սխալ է տեղի ունեցել վերածնունցման ընթացքում',
	'core.a11y.muted': 'Լուռ',
	'core.a11y.unmuted': 'Ձայն միացված',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Վերածնունցումը դադարեցված է — այժմ այլ ներդիր վերածնունցում է:',
	'plugin.media-session.unsupported': 'ՕՀ մեդիա վերահսկողները հասանելի չեն այս դիտարկիչում:',
};

export default hyTranslations;
