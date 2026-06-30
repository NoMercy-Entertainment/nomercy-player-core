// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'البث غير متاح على هذا الجهاز.',
	'plugin.cast-sender.connecting': 'جارٍ الاتصال بـ {device}…',
	'plugin.cast-sender.connected': 'البث إلى {device}',
	'plugin.cast-sender.disconnected': 'تم قطع الاتصال بـ {device}',
	'plugin.cast-sender.error.session-failed': 'تعذّر بدء جلسة الإرسال.',
	'plugin.cast-sender.error.load-failed': 'رفض جهاز الإرسال الوسائط.',
	'plugin.cast-sender.error.generic': 'حدث خطأ في الإرسال.',
	'plugin.cast-sender.action.connect': 'بث',
	'plugin.cast-sender.action.disconnect': 'إيقاف الإرسال',
	'plugin.cast-sender.state.buffering': 'جارٍ التحميل المؤقت',
	'plugin.cast-sender.state.playing': 'قيد التشغيل على {device}',
	'plugin.cast-sender.state.paused': 'متوقف مؤقتًا على {device}',
} satisfies Record<CastSenderTranslationKey, string>;
