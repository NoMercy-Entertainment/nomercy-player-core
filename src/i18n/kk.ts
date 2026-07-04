// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Kazakh core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'kk',
 *   translations: {
 *     ...defaultTranslations,
 *     kk: kkTranslations,
 *   },
 * });
 */
export const kkTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Интернет байланысы жоқ.',
	'core.network.timeout': 'Байланыс уақыты өтінді. Қайта талпыныс…',
	'core.network.serverError': 'Сервер ақаулары бар. Бір сәтте қайта талпыныңыз.',
	'core.network.notFound': 'Бұл мазмұнды табу мүмкін болмады.',
	'core.network.rateLimited': 'Тым көп сұраулар. Түсінік болыңыз.',

	// Auth
	'core.auth.unauthenticated': 'Сеансты жаңарту үшін қайта келіңіз.',
	'core.auth.forbidden': 'Сіздің есептік жазбасы осы мазмұнға қатынауға құқылы емес.',
	'core.auth.refreshFailed': 'Сеансты жаңарту мүмкін болмады. Қайта келіңіз.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Ойнатуды бастау үшін бірде-бір жерге құрт ұрыңыз.',
	'core.policy.userGestureRequired': 'Дыбысты іске қосу үшін құрт ұрыңыз.',
	'core.policy.pipDenied': 'Осы контекстінде суреттің ішіндегі сурет рұқсат етілмеген.',
	'core.policy.fullscreenDenied': 'Осы контекстінде толық экран рұқсат етілмеген.',
	'core.policy.wakeLockDenied': 'Ойнату кезінде экран сөнуі мүмкін.',

	// Media
	'core.media.unsupported': 'Бұл пішім сіздің браузеріңіз ішін қолдау таба алмайды.',
	'core.media.decodeFailed': 'Ойнату сәтсіз болды — келесі қолжетімді көзге ауысу.',
	'core.media.allDecodeFailed': 'Бұл мазмұнға ойнатуға болатын өзге де дереккөз жоқ.',

	// DRM
	'core.drm.outputProtection': 'Сіздің дисплейіңіз осы мазмұнның қорғау талаптарын қанағаттандырмайды.',
	'core.drm.licenseFailed': 'Осы мазмұн үшін лицензия алу мүмкін болмады.',
	'core.drm.keySystemUnsupported': 'Сіздің браузеріңіз қажет қорғау жүйесін қолдамайды.',

	// State / dev
	'core.state.queueEmpty': 'Ұстағыда ештеңе жоқ.',
	'core.state.notReady': 'Ойнатқышы әлі де дайын емес.',

	// A11y announcements
	'core.a11y.playing': '{title} ойнатылуда',
	'core.a11y.paused': 'Тоқтатылды',
	'core.a11y.stopped': 'Тоқтаталды',
	'core.a11y.seeking': '{time}-ге іздеу',
	'core.a11y.trackChange': 'Қазір {title} ойнатылуда',
	'core.a11y.error': 'Ойнату кезінде қате орын алды',
	'core.a11y.muted': 'Дыбысы өшірілген',
	'core.a11y.unmuted': 'Дыбысы қосылған',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Ойнату тоқтатылды — өзге де қойындақ қазір ойнатылуда.',
	'plugin.media-session.unsupported': 'ОС медиа басқарылымдары осы браузерде қолмайды.',
};

export default kkTranslations;
