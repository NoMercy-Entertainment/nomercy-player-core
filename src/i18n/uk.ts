// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Ukrainian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'uk',
 *   translations: {
 *     ...defaultTranslations,
 *     uk: ukTranslations,
 *   },
 * });
 */
export const ukTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Немає підключення до Інтернету.',
	'core.network.timeout': 'Вичерпано час очікування з\'єднання. Повторна спроба…',
	'core.network.serverError': 'Сервер має проблеми. Повторіть спробу за момент.',
	'core.network.notFound': 'Цей вміст не знайдено.',
	'core.network.rateLimited': 'Надто багато запитів. Будь ласка, повільніше.',

	// Auth
	'core.auth.unauthenticated': 'Увійдіть ще раз, щоб оновити сеанс.',
	'core.auth.forbidden': 'Ваш обліковий запис не має доступу до цього вмісту.',
	'core.auth.refreshFailed': 'Не вдалося оновити сеанс. Увійдіть ще раз.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Торкніться або клацніть будь-де, щоб почати відтворення.',
	'core.policy.userGestureRequired': 'Торкніться, щоб увімкнути звук.',
	'core.policy.pipDenied': 'Картинка в картинці не дозволена в цьому контексті.',
	'core.policy.fullscreenDenied': 'На весь екран не дозволено в цьому контексті.',
	'core.policy.wakeLockDenied': 'Екран може потемніти під час відтворення.',

	// Media
	'core.media.unsupported': 'Цей формат не підтримується вашим браузером.',
	'core.media.decodeFailed': 'Відтворення не вдалося — перехід до наступного доступного джерела.',
	'core.media.allDecodeFailed': 'Для цього вмісту немає доступного джерела для відтворення.',

	// DRM
	'core.drm.outputProtection': 'Ваш дисплей не відповідає вимогам захисту для цього вмісту.',
	'core.drm.licenseFailed': 'Не вдалося отримати ліцензію на цей вміст.',
	'core.drm.keySystemUnsupported': 'Ваш браузер не підтримує необхідну систему захисту.',

	// State / dev
	'core.state.queueEmpty': 'У черзі нічого нема.',
	'core.state.notReady': 'Плеєр поки не готовий.',

	// A11y announcements
	'core.a11y.playing': '{title} відтворюється',
	'core.a11y.paused': 'Зупинено',
	'core.a11y.stopped': 'Зупинено',
	'core.a11y.seeking': 'Пошук до {time}',
	'core.a11y.trackChange': 'Зараз відтворюється {title}',
	'core.a11y.error': 'Під час відтворення сталася помилка',
	'core.a11y.muted': 'Без звуку',
	'core.a11y.unmuted': 'Звук увімкнений',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Відтворення призупинено — інша вкладка зараз відтворюється.',
	'plugin.media-session.unsupported': 'Елементи керування медіа ОС недоступні в цьому браузері.',
};

export default ukTranslations;
