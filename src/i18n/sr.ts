// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Serbian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'sr',
 *   translations: {
 *     ...defaultTranslations,
 *     sr: srTranslations,
 *   },
 * });
 */
export const srTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Нема интернет повезаности.',
	'core.network.timeout': 'Повезаност је истекла. Покушавам поново…',
	'core.network.serverError': 'Сервер има проблеме. Покушајте поново за тренутак.',
	'core.network.notFound': 'Тај садржај се не може пронаћи.',
	'core.network.rateLimited': 'Превише захтева. Молим вас, успорите.',

	// Auth
	'core.auth.unauthenticated': 'Пријавите се поново да освежите вашу сесију.',
	'core.auth.forbidden': 'Ваш налог нема приступа овом садржају.',
	'core.auth.refreshFailed': 'Није могуће освежити вашу сесију. Пријавите се поново.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Додирните или кликните било где да бисте почели пуштање.',
	'core.policy.userGestureRequired': 'Додирните да омогућите звук.',
	'core.policy.pipDenied': 'Слика у слици није дозвољена у овом контексту.',
	'core.policy.fullscreenDenied': 'Напун екран није дозвољен у овом контексту.',
	'core.policy.wakeLockDenied': 'Екран може постати тамнији током пуштања.',

	// Media
	'core.media.unsupported': 'Овај формат није подржан од стране вашег прегледача.',
	'core.media.decodeFailed': 'Пуштање је неуспешно — пребацивање на следећи доступни извор.',
	'core.media.allDecodeFailed': 'Ниједан извор за пуштање није доступан за овај садржај.',

	// DRM
	'core.drm.outputProtection': 'Ваш приказ не испуњава захтеве заштите за овај садржај.',
	'core.drm.licenseFailed': 'Није могуће добити лиценцу за овај садржај.',
	'core.drm.keySystemUnsupported': 'Ваш прегледач не подржава потребан систем заштите.',

	// State / dev
	'core.state.queueEmpty': 'Ничега нема у реду.',
	'core.state.notReady': 'Плејер још није спреман.',

	// A11y announcements
	'core.a11y.playing': 'Пустићемо {title}',
	'core.a11y.paused': 'Паузирано',
	'core.a11y.stopped': 'Заустављено',
	'core.a11y.seeking': 'Тражим {time}',
	'core.a11y.trackChange': 'Сада се пуста {title}',
	'core.a11y.error': 'Дошло је до грешке tijekom пуштања',
	'core.a11y.muted': 'Утишан',
	'core.a11y.unmuted': 'Звук укључен',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Пуштање је паузирано — друга картица сада пуста.',
	'plugin.media-session.unsupported': 'Контроле за медије ОС нису доступне у овом прегледачу.',
};

export default srTranslations;
