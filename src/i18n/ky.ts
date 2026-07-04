// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Kyrgyz core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ky',
 *   translations: {
 *     ...defaultTranslations,
 *     ky: kyTranslations,
 *   },
 * });
 */
export const kyTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Интернет туташуусу жок.',
	'core.network.timeout': 'Туташуу убактысы өтүп кетти. Кайра аракет…',
	'core.network.serverError': 'Серверде проблемалар бар. Азырынча кайра аракет кылыңыз.',
	'core.network.notFound': 'Ал мазмун табылган жок.',
	'core.network.rateLimited': 'Өтө көп өтүнүч. Жайдатыңыз, ааруу.',

	// Auth
	'core.auth.unauthenticated': 'Сеансыңызды жаңыртуу үчүн кайра кирүүңүз.',
	'core.auth.forbidden': 'Сиздин эсебиңиз бул мазмунга уруксат берген жок.',
	'core.auth.refreshFailed': 'Сеансыңызды жаңырта алган жок. Кайра кирүүңүз.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Ойнотууну баштоо үчүн каалаган жерге сүртүңүз же басыңыз.',
	'core.policy.userGestureRequired': 'Дыбысты иштетүү үчүн сүртүңүз.',
	'core.policy.pipDenied': 'Сүрөттүн ичинде сүрөт бул контекстте уруксат берилген жок.',
	'core.policy.fullscreenDenied': 'Толук экран бул контекстте уруксат берилген жок.',
	'core.policy.wakeLockDenied': 'Ойнотуу учурунда экран күңүү болушу мүмкүн.',

	// Media
	'core.media.unsupported': 'Бул формат сиздин браузериңиз тарабынан колдоого алынбайт.',
	'core.media.decodeFailed': 'Ойнотуу ийгиликсиз болду — кийинки жеткиликтүү булакка которуу.',
	'core.media.allDecodeFailed': 'Бул мазмун үчүн ойнотула турган булак жок.',

	// DRM
	'core.drm.outputProtection': 'Сиздин дисплейиңиз бул мазмун үчүн коргоо талаптарын канааттандырбайт.',
	'core.drm.licenseFailed': 'Бул мазмун үчүн лицензия ала албадык.',
	'core.drm.keySystemUnsupported': 'Сиздин браузериңиз зарыл коргоо системасын колдоого албайт.',

	// State / dev
	'core.state.queueEmpty': 'Очереде эч нерсе жок.',
	'core.state.notReady': 'Ойноткуч әлі даяр эмес.',

	// A11y announcements
	'core.a11y.playing': '{title} ойнотулуп жатат',
	'core.a11y.paused': 'Паузалангыч',
	'core.a11y.stopped': 'Токтотулду',
	'core.a11y.seeking': '{time} که издөөдө',
	'core.a11y.trackChange': 'Азыр {title} ойнотулуп жатат',
	'core.a11y.error': 'Ойнотуу учурунда ката пайда болду',
	'core.a11y.muted': 'Үнсүз',
	'core.a11y.unmuted': 'Үн ачык',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Ойнотуу паузалангыч — башка ветка азыр ойнотулуп жатат.',
	'plugin.media-session.unsupported': 'ОС медиа элементтери бул браузерде жеткиликтүү эмес.',
};

export default kyTranslations;
