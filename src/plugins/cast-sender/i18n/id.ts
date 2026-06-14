// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Transmisi tidak tersedia di perangkat ini.',
	'plugin.cast-sender.connecting': 'Menghubungkan ke {device}…',
	'plugin.cast-sender.connected': 'Mentransmisikan ke {device}',
	'plugin.cast-sender.disconnected': 'Terputus dari {device}',
	'plugin.cast-sender.error.session-failed': 'Tidak dapat memulai sesi cast.',
	'plugin.cast-sender.error.load-failed': 'Perangkat cast menolak media.',
	'plugin.cast-sender.error.generic': 'Terjadi kesalahan cast.',
	'plugin.cast-sender.action.connect': 'Transmisikan',
	'plugin.cast-sender.action.disconnect': 'Hentikan cast',
	'plugin.cast-sender.state.buffering': 'Memuat buffer',
	'plugin.cast-sender.state.playing': 'Memutar di {device}',
	'plugin.cast-sender.state.paused': 'Dijeda di {device}',
} satisfies Record<CastSenderTranslationKey, string>;
