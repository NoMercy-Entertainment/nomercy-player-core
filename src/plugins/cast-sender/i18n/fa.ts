// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'ارسال در این دستگاه در دسترس نیست.',
	'plugin.cast-sender.connecting': 'در حال اتصال به {device}…',
	'plugin.cast-sender.connected': 'در حال ارسال به {device}',
	'plugin.cast-sender.disconnected': 'ارتباط با {device} قطع شد',
	'plugin.cast-sender.error.session-failed': 'نمی‌توان جلسهٔ پخش را آغاز کرد.',
	'plugin.cast-sender.error.load-failed': 'دستگاه پخش رسانه را رد کرد.',
	'plugin.cast-sender.error.generic': 'خطایی در پخش رخ داد.',
	'plugin.cast-sender.action.connect': 'ارسال به دستگاه',
	'plugin.cast-sender.action.disconnect': 'توقف پخش',
	'plugin.cast-sender.state.buffering': 'بارگذاری بافر',
	'plugin.cast-sender.state.playing': 'در حال پخش روی {device}',
	'plugin.cast-sender.state.paused': 'متوقف‌شده روی {device}',
} satisfies Record<CastSenderTranslationKey, string>;
