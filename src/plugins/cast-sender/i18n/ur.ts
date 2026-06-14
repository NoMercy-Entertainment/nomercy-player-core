// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'اس ڈیوائس پر کاسٹنگ دستیاب نہیں ہے۔',
	'plugin.cast-sender.connecting': '{device} سے منسلک ہو رہا ہے…',
	'plugin.cast-sender.connected': '{device} پر کاسٹ ہو رہا ہے',
	'plugin.cast-sender.disconnected': '{device} سے منقطع ہو گیا',
	'plugin.cast-sender.error.session-failed': 'کاسٹ سیشن شروع نہیں کیا جا سکا۔',
	'plugin.cast-sender.error.load-failed': 'کاسٹ ڈیوائس نے میڈیا مسترد کر دیا۔',
	'plugin.cast-sender.error.generic': 'کاسٹ کی خرابی پیش آئی۔',
	'plugin.cast-sender.action.connect': 'نشر کریں',
	'plugin.cast-sender.action.disconnect': 'کاسٹ کرنا بند کریں',
	'plugin.cast-sender.state.buffering': 'بفرنگ',
	'plugin.cast-sender.state.playing': '{device} پر چل رہا ہے',
	'plugin.cast-sender.state.paused': '{device} پر روکا گیا',
} satisfies Record<CastSenderTranslationKey, string>;
