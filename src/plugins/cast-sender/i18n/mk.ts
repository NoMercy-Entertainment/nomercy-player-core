// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Емитувањето не е достапно на овој уред.',
	'plugin.cast-sender.connecting': 'Поврзување со {device}…',
	'plugin.cast-sender.connected': 'Се емитува на {device}',
	'plugin.cast-sender.disconnected': 'Прекината врска со {device}',
	'plugin.cast-sender.error.session-failed': 'Сесијата за пренос не можеше да започне.',
	'plugin.cast-sender.error.load-failed': 'Уредот за пренос го одби медиумот.',
	'plugin.cast-sender.error.generic': 'Се појави грешка при пренос.',
	'plugin.cast-sender.action.connect': 'Емитувај',
	'plugin.cast-sender.action.disconnect': 'Запри пренос',
	'plugin.cast-sender.state.buffering': 'Баферирање',
	'plugin.cast-sender.state.playing': 'Се репродуцира на {device}',
	'plugin.cast-sender.state.paused': 'Паузирано на {device}',
} satisfies Record<CastSenderTranslationKey, string>;
