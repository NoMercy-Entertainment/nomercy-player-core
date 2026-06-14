// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Odosielanie nie je na tomto zariadení k dispozícii.',
	'plugin.cast-sender.connecting': 'Pripája sa k {device}…',
	'plugin.cast-sender.connected': 'Odosiela sa do {device}',
	'plugin.cast-sender.disconnected': 'Odpojené od {device}',
	'plugin.cast-sender.error.session-failed': 'Reláciu prenosu sa nepodarilo spustiť.',
	'plugin.cast-sender.error.load-failed': 'Zariadenie na prenos odmietlo médium.',
	'plugin.cast-sender.error.generic': 'Vyskytla sa chyba prenosu.',
	'plugin.cast-sender.action.connect': 'Prenášať',
	'plugin.cast-sender.action.disconnect': 'Zastaviť prenos',
	'plugin.cast-sender.state.buffering': 'Načítavanie',
	'plugin.cast-sender.state.playing': 'Prehráva sa na {device}',
	'plugin.cast-sender.state.paused': 'Pozastavené na {device}',
} satisfies Record<CastSenderTranslationKey, string>;
