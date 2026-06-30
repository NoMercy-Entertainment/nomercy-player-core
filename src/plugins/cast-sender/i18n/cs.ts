// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Odesílání není na tomto zařízení k dispozici.',
	'plugin.cast-sender.connecting': 'Připojování k {device}…',
	'plugin.cast-sender.connected': 'Odesílání do {device}',
	'plugin.cast-sender.disconnected': 'Odpojeno od {device}',
	'plugin.cast-sender.error.session-failed': 'Relaci přenosu se nepodařilo spustit.',
	'plugin.cast-sender.error.load-failed': 'Zařízení pro přenos odmítlo médium.',
	'plugin.cast-sender.error.generic': 'Došlo k chybě přenosu.',
	'plugin.cast-sender.action.connect': 'Přenést',
	'plugin.cast-sender.action.disconnect': 'Zastavit přenos',
	'plugin.cast-sender.state.buffering': 'Načítání do vyrovnávací paměti',
	'plugin.cast-sender.state.playing': 'Přehrává se na {device}',
	'plugin.cast-sender.state.paused': 'Pozastaveno na {device}',
} satisfies Record<CastSenderTranslationKey, string>;
