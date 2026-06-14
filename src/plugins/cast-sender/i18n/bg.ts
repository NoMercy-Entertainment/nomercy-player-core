// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Предаването не е налично на това устройство.',
	'plugin.cast-sender.connecting': 'Свързване с {device}…',
	'plugin.cast-sender.connected': 'Предаване към {device}',
	'plugin.cast-sender.disconnected': 'Връзката с {device} е прекъсната',
	'plugin.cast-sender.error.session-failed': 'Сесията за предаване не можа да започне.',
	'plugin.cast-sender.error.load-failed': 'Устройството за предаване отхвърли мултимедията.',
	'plugin.cast-sender.error.generic': 'Възникна грешка при предаване.',
	'plugin.cast-sender.action.connect': 'Излъчване',
	'plugin.cast-sender.action.disconnect': 'Спиране на предаването',
	'plugin.cast-sender.state.buffering': 'Буфериране',
	'plugin.cast-sender.state.playing': 'Възпроизвежда се на {device}',
	'plugin.cast-sender.state.paused': 'Поставено на пауза на {device}',
} satisfies Record<CastSenderTranslationKey, string>;
