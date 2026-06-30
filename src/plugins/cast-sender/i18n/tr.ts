// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Bu cihazda yayınlama kullanılamıyor.',
	'plugin.cast-sender.connecting': '{device} cihazına bağlanılıyor…',
	'plugin.cast-sender.connected': '{device} cihazına yayınlanıyor',
	'plugin.cast-sender.disconnected': '{device} bağlantısı kesildi',
	'plugin.cast-sender.error.session-failed': 'Yayın oturumu başlatılamadı.',
	'plugin.cast-sender.error.load-failed': 'Yayın cihazı medyayı reddetti.',
	'plugin.cast-sender.error.generic': 'Bir yayın hatası oluştu.',
	'plugin.cast-sender.action.connect': 'Yayınla',
	'plugin.cast-sender.action.disconnect': 'Yayını durdur',
	'plugin.cast-sender.state.buffering': 'Arabelleğe alınıyor',
	'plugin.cast-sender.state.playing': '{device} cihazında oynatılıyor',
	'plugin.cast-sender.state.paused': '{device} cihazında duraklatıldı',
} satisfies Record<CastSenderTranslationKey, string>;
