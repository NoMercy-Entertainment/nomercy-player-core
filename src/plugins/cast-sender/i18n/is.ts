// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Sending er ekki í boði á þessu tæki.',
	'plugin.cast-sender.connecting': 'Tengist við {device}…',
	'plugin.cast-sender.connected': 'Sendir til {device}',
	'plugin.cast-sender.disconnected': 'Aftengt frá {device}',
	'plugin.cast-sender.error.session-failed': 'Ekki tókst að hefja útsendingu.',
	'plugin.cast-sender.error.load-failed': 'Útsendingartækið hafnaði efninu.',
	'plugin.cast-sender.error.generic': 'Útsendingarvilla kom upp.',
	'plugin.cast-sender.action.connect': 'Senda á skjá',
	'plugin.cast-sender.action.disconnect': 'Stöðva útsendingu',
	'plugin.cast-sender.state.buffering': 'Hleður í biðminni',
	'plugin.cast-sender.state.playing': 'Spilar á {device}',
	'plugin.cast-sender.state.paused': 'Í hléi á {device}',
} satisfies Record<CastSenderTranslationKey, string>;
