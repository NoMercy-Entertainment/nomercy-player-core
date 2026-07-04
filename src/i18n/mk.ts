// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Macedonian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'mk',
 *   translations: {
 *     ...defaultTranslations,
 *     mk: mkTranslations,
 *   },
 * });
 */
export const mkTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Нема интернет врска.',
	'core.network.timeout': 'Врската истече. Се обидувам…',
	'core.network.serverError': 'Серверот има проблеми. Обидете се пак за момент.',
	'core.network.notFound': 'Тој содржи не можа да се најде.',
	'core.network.rateLimited': 'Премногу барања. Ве молам, забавете.',

	// Auth
	'core.auth.unauthenticated': 'Пријавете се повторно за да го освежите вашата сесија.',
	'core.auth.forbidden': 'Вашата сметка нема пристап до овој садржај.',
	'core.auth.refreshFailed': 'Не можев да го освежам вашата сесија. Пријавете се повторно.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Допрете или кликнете каде било за да ја започнете репродукцијата.',
	'core.policy.userGestureRequired': 'Допрете за да го овозможите звукот.',
	'core.policy.pipDenied': 'Слика во слика не е дозволена во овој контекст.',
	'core.policy.fullscreenDenied': 'Целиот екран не е дозволен во овој контекст.',
	'core.policy.wakeLockDenied': 'Екранот може да потемнее за време на репродукција.',

	// Media
	'core.media.unsupported': 'Овој формат не е поддржан од вашиот прелистувач.',
	'core.media.decodeFailed': 'Репродукцијата не успеа — преминување на следното достапно извор.',
	'core.media.allDecodeFailed': 'Нема достапен извор за репродукција за овој садржај.',

	// DRM
	'core.drm.outputProtection': 'Вашиот екран не ги исполнува требленијата за заштита за овој садржај.',
	'core.drm.licenseFailed': 'Не можев да добијам лиценца за овој садржај.',
	'core.drm.keySystemUnsupported': 'Вашиот прелистувач не го поддржува потребниот систем за заштита.',

	// State / dev
	'core.state.queueEmpty': 'Нема ништо во редица.',
	'core.state.notReady': 'Плеерот сеуште не е готов.',

	// A11y announcements
	'core.a11y.playing': 'Репродукција {title}',
	'core.a11y.paused': 'Паузиран',
	'core.a11y.stopped': 'Запрен',
	'core.a11y.seeking': 'Барање за {time}',
	'core.a11y.trackChange': 'Сега се репродуцира {title}',
	'core.a11y.error': 'Дошло до грешка за време на репродукција',
	'core.a11y.muted': 'Утишано',
	'core.a11y.unmuted': 'Звук вклучен',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Репродукцијата е паузирана — други завирткае сега се репродуцира.',
	'plugin.media-session.unsupported': 'Медиумските контроли на ОС не се достапни во овој прелистувач.',
};

export default mkTranslations;
