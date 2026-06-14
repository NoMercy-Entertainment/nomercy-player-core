// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Ülekanne pole selles seadmes saadaval.',
	'plugin.cast-sender.connecting': 'Ühendamine seadmega {device}…',
	'plugin.cast-sender.connected': 'Ülekanne seadmesse {device}',
	'plugin.cast-sender.disconnected': 'Ühendus seadmega {device} katkestatud',
	'plugin.cast-sender.error.session-failed': 'Ülekandeseanssi ei õnnestunud käivitada.',
	'plugin.cast-sender.error.load-failed': 'Ülekandeseade keeldus meediumi vastu võtmast.',
	'plugin.cast-sender.error.generic': 'Tekkis ülekandeviga.',
	'plugin.cast-sender.action.connect': 'Ülekanne',
	'plugin.cast-sender.action.disconnect': 'Peata ülekanne',
	'plugin.cast-sender.state.buffering': 'Puhverdamine',
	'plugin.cast-sender.state.playing': 'Esitatakse seadmes {device}',
	'plugin.cast-sender.state.paused': 'Peatatud seadmes {device}',
} satisfies Record<CastSenderTranslationKey, string>;
