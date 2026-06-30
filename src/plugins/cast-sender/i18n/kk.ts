// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Бұл құрылғыда тарату қолжетімсіз.',
	'plugin.cast-sender.connecting': '{device} құрылғысына қосылуда…',
	'plugin.cast-sender.connected': '{device} құрылғысына таратылуда',
	'plugin.cast-sender.disconnected': '{device} құрылғысынан ажыратылды',
	'plugin.cast-sender.error.session-failed': 'Тарату сеансын бастау мүмкін болмады.',
	'plugin.cast-sender.error.load-failed': 'Тарату құрылғысы медиадан бас тартты.',
	'plugin.cast-sender.error.generic': 'Тарату қатесі орын алды.',
	'plugin.cast-sender.action.connect': 'Трансляциялау',
	'plugin.cast-sender.action.disconnect': 'Таратуды тоқтату',
	'plugin.cast-sender.state.buffering': 'Буферлеу',
	'plugin.cast-sender.state.playing': '{device} құрылғысында ойнатылуда',
	'plugin.cast-sender.state.paused': '{device} құрылғысында кідіртілген',
} satisfies Record<CastSenderTranslationKey, string>;
