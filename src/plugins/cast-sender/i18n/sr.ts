// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Емитовање није доступно на овом уређају.',
	'plugin.cast-sender.connecting': 'Повезивање са {device}…',
	'plugin.cast-sender.connected': 'Емитовање на {device}',
	'plugin.cast-sender.disconnected': 'Веза са {device} је прекинута',
	'plugin.cast-sender.error.session-failed': 'Сесија преноса није могла да се покрене.',
	'plugin.cast-sender.error.load-failed': 'Уређај за пренос је одбио медиј.',
	'plugin.cast-sender.error.generic': 'Дошло је до грешке у преносу.',
	'plugin.cast-sender.action.connect': 'Емитовање',
	'plugin.cast-sender.action.disconnect': 'Заустави пренос',
	'plugin.cast-sender.state.buffering': 'Баферовање',
	'plugin.cast-sender.state.playing': 'Репродукује се на {device}',
	'plugin.cast-sender.state.paused': 'Паузирано на {device}',
} satisfies Record<CastSenderTranslationKey, string>;
