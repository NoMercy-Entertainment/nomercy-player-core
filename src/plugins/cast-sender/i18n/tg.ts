// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Пахш дар ин дастгоҳ дастрас нест.',
	'plugin.cast-sender.connecting': 'Пайвастшавӣ ба {device}…',
	'plugin.cast-sender.connected': 'Пахш ба {device}',
	'plugin.cast-sender.disconnected': 'Аз {device} ҷудо шуд',
	'plugin.cast-sender.error.session-failed': 'Оғози ҷаласаи интиқол имконнопазир аст.',
	'plugin.cast-sender.error.load-failed': 'Дастгоҳи интиқол медиаро рад кард.',
	'plugin.cast-sender.error.generic': 'Хатои интиқол рух дод.',
	'plugin.cast-sender.action.connect': 'Пахш кардан',
	'plugin.cast-sender.action.disconnect': 'Қатъи интиқол',
	'plugin.cast-sender.state.buffering': 'Буферкунӣ',
	'plugin.cast-sender.state.playing': 'Дар {device} пахш мешавад',
	'plugin.cast-sender.state.paused': 'Дар {device} таваққуф шуд',
} satisfies Record<CastSenderTranslationKey, string>;
