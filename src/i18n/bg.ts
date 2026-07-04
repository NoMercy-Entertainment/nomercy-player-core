// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Bulgarian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'bg',
 *   translations: {
 *     ...defaultTranslations,
 *     bg: bgTranslations,
 *   },
 * });
 */
export const bgTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Няма интернет свързаност.',
	'core.network.timeout': 'Времето на свързване изтече. Повторен опит…',
	'core.network.serverError': 'Сървърът има проблеми. Опитайте отново за момент.',
	'core.network.notFound': 'Това съдържание не можеше да бъде намерено.',
	'core.network.rateLimited': 'Твърде много заявки. Моля, забавете.',

	// Auth
	'core.auth.unauthenticated': 'Влезте отново, за да опресните сеанса си.',
	'core.auth.forbidden': 'Вашият акаунт нямаше достъп до това съдържание.',
	'core.auth.refreshFailed': 'Не можеше да опресните сеанса си. Влезте отново.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Докоснете или щракнете където и да е, за да стартирате възпроизвеждането.',
	'core.policy.userGestureRequired': 'Докоснете, за да активирате звука.',
	'core.policy.pipDenied': 'Картина в картина не е разрешена в този контекст.',
	'core.policy.fullscreenDenied': 'Пълният екран не е разрешен в този контекст.',
	'core.policy.wakeLockDenied': 'Екранът може да потъмнее по време на възпроизвеждане.',

	// Media
	'core.media.unsupported': 'Този формат не се поддържа от вашия браузър.',
	'core.media.decodeFailed': 'Възпроизвеждането неуспешно — превключване към следващия достъпен източник.',
	'core.media.allDecodeFailed': 'Няма налични възможни за възпроизвеждане източници за това съдържание.',

	// DRM
	'core.drm.outputProtection': 'Вашият дисплей не отговаря на изискванията за защита на това съдържание.',
	'core.drm.licenseFailed': 'Не можеше да се получи лицензия за това съдържание.',
	'core.drm.keySystemUnsupported': 'Вашият браузър не поддържа необходимата система за защита.',

	// State / dev
	'core.state.queueEmpty': 'Няма нищо в опашката.',
	'core.state.notReady': 'Плейърът все още не е готов.',

	// A11y announcements
	'core.a11y.playing': 'Възпроизвеждане {title}',
	'core.a11y.paused': 'На пауза',
	'core.a11y.stopped': 'Спранен',
	'core.a11y.seeking': 'Търсене на {time}',
	'core.a11y.trackChange': 'Сега се възпроизвежда {title}',
	'core.a11y.error': 'Възникна грешка по време на възпроизвеждане',
	'core.a11y.muted': 'Заглушен',
	'core.a11y.unmuted': 'Разглушен',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Възпроизвеждането е паузирано — друг раздел сега възпроизвежда.',
	'plugin.media-session.unsupported': 'Управлението на медиите на ОС не е налично в този браузър.',
};

export default bgTranslations;
