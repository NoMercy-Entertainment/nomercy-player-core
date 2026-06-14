// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Bu qurilmada uzatish mavjud emas.',
	'plugin.cast-sender.connecting': '{device} ga ulanmoqda…',
	'plugin.cast-sender.connected': '{device} ga uzatilmoqda',
	'plugin.cast-sender.disconnected': '{device} qurilmasidan uzildi',
	'plugin.cast-sender.error.session-failed': 'Translatsiya seansini boshlab boʻlmadi.',
	'plugin.cast-sender.error.load-failed': 'Translatsiya qurilmasi mediani rad etdi.',
	'plugin.cast-sender.error.generic': 'Translatsiya xatosi yuz berdi.',
	'plugin.cast-sender.action.connect': 'Uzatish',
	'plugin.cast-sender.action.disconnect': 'Translatsiyani toʻxtatish',
	'plugin.cast-sender.state.buffering': 'Buferlash',
	'plugin.cast-sender.state.playing': '{device} qurilmasida ijro etilmoqda',
	'plugin.cast-sender.state.paused': '{device} qurilmasida pauza qilindi',
} satisfies Record<CastSenderTranslationKey, string>;
