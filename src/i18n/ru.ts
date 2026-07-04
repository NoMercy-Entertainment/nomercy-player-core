// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Russian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ru',
 *   translations: {
 *     ...defaultTranslations,
 *     ru: ruTranslations,
 *   },
 * });
 */
export const ruTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Нет подключения к интернету.',
	'core.network.timeout': 'Истекло время подключения. Повторная попытка…',
	'core.network.serverError': 'На сервере возникли проблемы. Повторите попытку через момент.',
	'core.network.notFound': 'Этот контент не найден.',
	'core.network.rateLimited': 'Слишком много запросов. Пожалуйста, притормозите.',

	// Auth
	'core.auth.unauthenticated': 'Войдите снова, чтобы обновить сеанс.',
	'core.auth.forbidden': 'Ваша учетная запись не имеет доступа к этому контенту.',
	'core.auth.refreshFailed': 'Не удалось обновить сеанс. Войдите снова.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Коснитесь или щелкните где-нибудь, чтобы начать воспроизведение.',
	'core.policy.userGestureRequired': 'Коснитесь, чтобы включить звук.',
	'core.policy.pipDenied': 'Картинка в картинке не разрешена в этом контексте.',
	'core.policy.fullscreenDenied': 'Полноэкранный режим не разрешен в этом контексте.',
	'core.policy.wakeLockDenied': 'Экран может потемнеть во время воспроизведения.',

	// Media
	'core.media.unsupported': 'Этот формат не поддерживается вашим браузером.',
	'core.media.decodeFailed': 'Воспроизведение не удалось — переключение на следующий доступный источник.',
	'core.media.allDecodeFailed': 'Для этого контента нет доступного источника воспроизведения.',

	// DRM
	'core.drm.outputProtection': 'Ваш дисплей не соответствует требованиям защиты для этого контента.',
	'core.drm.licenseFailed': 'Не удалось получить лицензию на этот контент.',
	'core.drm.keySystemUnsupported': 'Ваш браузер не поддерживает требуемую систему защиты.',

	// State / dev
	'core.state.queueEmpty': 'В очереди ничего нет.',
	'core.state.notReady': 'Плеер еще не готов.',

	// A11y announcements
	'core.a11y.playing': 'Воспроизведение {title}',
	'core.a11y.paused': 'Приостановлено',
	'core.a11y.stopped': 'Остановлено',
	'core.a11y.seeking': 'Поиск по {time}',
	'core.a11y.trackChange': 'Сейчас воспроизводится {title}',
	'core.a11y.error': 'Во время воспроизведения произошла ошибка',
	'core.a11y.muted': 'Отключено',
	'core.a11y.unmuted': 'Звук включен',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Воспроизведение приостановлено — другая вкладка воспроизводится.',
	'plugin.media-session.unsupported': 'Элементы управления мультимедиа ОС недоступны в этом браузере.',
};

export default ruTranslations;
