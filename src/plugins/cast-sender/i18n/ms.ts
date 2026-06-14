// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Penghantaran tidak tersedia pada peranti ini.',
	'plugin.cast-sender.connecting': 'Menyambung ke {device}…',
	'plugin.cast-sender.connected': 'Menghantar ke {device}',
	'plugin.cast-sender.disconnected': 'Diputuskan daripada {device}',
	'plugin.cast-sender.error.session-failed': 'Tidak dapat memulakan sesi cast.',
	'plugin.cast-sender.error.load-failed': 'Peranti cast menolak media.',
	'plugin.cast-sender.error.generic': 'Ralat cast berlaku.',
	'plugin.cast-sender.action.connect': 'Hantar',
	'plugin.cast-sender.action.disconnect': 'Hentikan cast',
	'plugin.cast-sender.state.buffering': 'Penimbalan',
	'plugin.cast-sender.state.playing': 'Bermain di {device}',
	'plugin.cast-sender.state.paused': 'Dijeda di {device}',
} satisfies Record<CastSenderTranslationKey, string>;
