// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Энэ төхөөрөмж дээр дамжуулах боломжгүй.',
	'plugin.cast-sender.connecting': '{device}-д холбогдож байна…',
	'plugin.cast-sender.connected': '{device}-д дамжуулж байна',
	'plugin.cast-sender.disconnected': '{device}-с салгагдсан',
	'plugin.cast-sender.error.session-failed': 'Дамжуулах сессийг эхлүүлж чадсангүй.',
	'plugin.cast-sender.error.load-failed': 'Дамжуулах төхөөрөмж медиаг татгалзлаа.',
	'plugin.cast-sender.error.generic': 'Дамжуулах алдаа гарлаа.',
	'plugin.cast-sender.action.connect': 'Дамжуулах',
	'plugin.cast-sender.action.disconnect': 'Дамжуулахыг зогсоох',
	'plugin.cast-sender.state.buffering': 'Ачааллаж байна',
	'plugin.cast-sender.state.playing': '{device} дээр тоглуулж байна',
	'plugin.cast-sender.state.paused': '{device} дээр түр зогсоосон',
} satisfies Record<CastSenderTranslationKey, string>;
