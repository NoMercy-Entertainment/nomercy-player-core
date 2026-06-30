// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Бул түзмөктө таратуу жеткиликсиз.',
	'plugin.cast-sender.connecting': '{device} түзмөгүнө туташууда…',
	'plugin.cast-sender.connected': '{device} түзмөгүнө таратылууда',
	'plugin.cast-sender.disconnected': '{device} түзмөгүнөн ажыратылды',
	'plugin.cast-sender.error.session-failed': 'Тарату сеансын баштоо мүмкүн болгон жок.',
	'plugin.cast-sender.error.load-failed': 'Тарату түзмөгү медианы четке какты.',
	'plugin.cast-sender.error.generic': 'Тарату катасы пайда болду.',
	'plugin.cast-sender.action.connect': 'Трансляциялоо',
	'plugin.cast-sender.action.disconnect': 'Таратууну токтотуу',
	'plugin.cast-sender.state.buffering': 'Буферлөө',
	'plugin.cast-sender.state.playing': '{device} түзмөгүндө ойнотулууда',
	'plugin.cast-sender.state.paused': '{device} түзмөгүндө тындырылды',
} satisfies Record<CastSenderTranslationKey, string>;
