// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Tajik core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'tg',
 *   translations: {
 *     ...defaultTranslations,
 *     tg: tgTranslations,
 *   },
 * });
 */
export const tgTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Ҳеч гуна алоқаи интернетӣ нест.',
	'core.network.timeout': 'Вақти алоқа ихтиёр шуд. Аз нав кӯшиш…',
	'core.network.serverError': 'Сервер дорои мушкилот аст. Баъд аз вақте аз нав кӯшиш кунед.',
	'core.network.notFound': 'Ин мундариҷа ёфт нашуда.',
	'core.network.rateLimited': 'Бисёр сўратҳо. Лутфан суст кунед.',

	// Auth
	'core.auth.unauthenticated': 'Барои аз нав кардани сеанси худ дубора ворид шавед.',
	'core.auth.forbidden': 'Ҳисоби шумо ба ин мундариҷа дастрасӣ надорад.',
	'core.auth.refreshFailed': 'Наметавон сеанси худро аз нав кард. Дубора ворид шавед.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Барои шурӯъ кардани пахш ҳама ҷо пунҷа кунед ё рӯ кунед.',
	'core.policy.userGestureRequired': 'Барои фаъол кардани аудио пунҷа кунед.',
	'core.policy.pipDenied': 'Акс дар акс дар ин матн иҷозада нашуда.',
	'core.policy.fullscreenDenied': 'Экрани пур дар ин матн иҷозада нашуда.',
	'core.policy.wakeLockDenied': 'Экран метавонад ҳангоми пахш торик шавад.',

	// Media
	'core.media.unsupported': 'Ин формат дар браузери шумо ҳимоя нашудаст.',
	'core.media.decodeFailed': 'Пахш ноком буд — гузарифт ба сарчашмаи оқибаи дастрас.',
	'core.media.allDecodeFailed': 'Барои ин мундариҷа ҳеч гуна сарчашмаи пахшконанда дастрас нест.',

	// DRM
	'core.drm.outputProtection': 'Намойишгари шумо талабҳои ҳимояи ин мундариҷаро қонеъ намекунад.',
	'core.drm.licenseFailed': 'Наметавон иҷозатномаи ин мундариҷаро гирифт.',
	'core.drm.keySystemUnsupported': 'Браузери шумо системаи ҳимояи паст кунандаро ҳимояд намекунад.',

	// State / dev
	'core.state.queueEmpty': 'Дар пайдабуни ҳеч чизе нест.',
	'core.state.notReady': 'Плеер ҳанӯз омода нест.',

	// A11y announcements
	'core.a11y.playing': '{title} пахши дорад',
	'core.a11y.paused': 'Таваққуф шуда',
	'core.a11y.stopped': 'Ғаор кард',
	'core.a11y.seeking': 'Ҷустуҷӯ ба {time}',
	'core.a11y.trackChange': 'Ҳоло {title} пахши дорад',
	'core.a11y.error': 'Сатҳи ҳома ҳангоми пахш рух дод',
	'core.a11y.muted': 'Бис овоз',
	'core.a11y.unmuted': 'Овоз фаъол',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Пахш таваққуф шуд — таб-и дигаре ҳоло пахши дорад.',
	'plugin.media-session.unsupported': 'Назоратҳои расона OS дар ин браузер дастрас нестанд.',
};

export default tgTranslations;
