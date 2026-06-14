// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Stuur is nie op hierdie toestel beskikbaar nie.',
	'plugin.cast-sender.connecting': 'Verbind tans met {device}…',
	'plugin.cast-sender.connected': 'Stuur tans na {device}',
	'plugin.cast-sender.disconnected': 'Verbinding met {device} verbreek',
	'plugin.cast-sender.error.session-failed': 'Kon nie die uitsaai-sessie begin nie.',
	'plugin.cast-sender.error.load-failed': 'Die uitsaaitoestel het die media geweier.',
	'plugin.cast-sender.error.generic': '\'n Uitsaaifout het voorgekom.',
	'plugin.cast-sender.action.connect': 'Gooi',
	'plugin.cast-sender.action.disconnect': 'Stop uitsaai',
	'plugin.cast-sender.state.buffering': 'Bufferend',
	'plugin.cast-sender.state.playing': 'Speel op {device}',
	'plugin.cast-sender.state.paused': 'Onderbreek op {device}',
} satisfies Record<CastSenderTranslationKey, string>;
