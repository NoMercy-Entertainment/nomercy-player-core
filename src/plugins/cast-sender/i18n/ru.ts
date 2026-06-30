// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Трансляция недоступна на этом устройстве.',
	'plugin.cast-sender.connecting': 'Подключение к {device}…',
	'plugin.cast-sender.connected': 'Трансляция на {device}',
	'plugin.cast-sender.disconnected': 'Отключено от {device}',
	'plugin.cast-sender.error.session-failed': 'Не удалось запустить сеанс трансляции.',
	'plugin.cast-sender.error.load-failed': 'Устройство трансляции отклонило медиафайл.',
	'plugin.cast-sender.error.generic': 'Произошла ошибка трансляции.',
	'plugin.cast-sender.action.connect': 'Трансляция',
	'plugin.cast-sender.action.disconnect': 'Остановить трансляцию',
	'plugin.cast-sender.state.buffering': 'Буферизация',
	'plugin.cast-sender.state.playing': 'Воспроизводится на {device}',
	'plugin.cast-sender.state.paused': 'Приостановлено на {device}',
} satisfies Record<CastSenderTranslationKey, string>;
