// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Arabic core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ar',
 *   translations: {
 *     ...defaultTranslations,
 *     ar: arTranslations,
 *   },
 * });
 */
export const arTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'لا توجد اتصالات إنترنت.',
	'core.network.timeout': 'انتهت مهلة الاتصال. جاري إعادة المحاولة…',
	'core.network.serverError': 'يواجه الخادم مشاكل. حاول مرة أخرى بعد قليل.',
	'core.network.notFound': 'لم يتم العثور على هذا المحتوى.',
	'core.network.rateLimited': 'عدد الطلبات كثير جداً. يرجى تقليل السرعة.',

	// Auth
	'core.auth.unauthenticated': 'قم بتسجيل الدخول مرة أخرى لتحديث جلستك.',
	'core.auth.forbidden': 'حسابك ليس لديه إمكانية الوصول إلى هذا المحتوى.',
	'core.auth.refreshFailed': 'تعذّر تحديث جلستك. يرجى تسجيل الدخول مرة أخرى.',

	// Browser policy
	'core.policy.autoplayBlocked': 'انقر أي مكان لبدء التشغيل.',
	'core.policy.userGestureRequired': 'انقر لتفعيل الصوت.',
	'core.policy.pipDenied': 'الصورة ضمن صورة غير مسموحة في هذا السياق.',
	'core.policy.fullscreenDenied': 'ملء الشاشة غير مسموح به في هذا السياق.',
	'core.policy.wakeLockDenied': 'قد تنخفض إضاءة الشاشة أثناء التشغيل.',

	// Media
	'core.media.unsupported': 'هذا الصيغة غير مدعومة من قبل متصفحك.',
	'core.media.decodeFailed': 'فشل التشغيل — جاري التبديل إلى المصدر التالي المتاح.',
	'core.media.allDecodeFailed': 'لا يوجد مصدر قابل للتشغيل متاح لهذا المحتوى.',

	// DRM
	'core.drm.outputProtection': 'شاشتك لا تفي بمتطلبات الحماية لهذا المحتوى.',
	'core.drm.licenseFailed': 'تعذّر الحصول على رخصة لهذا المحتوى.',
	'core.drm.keySystemUnsupported': 'متصفحك لا يدعم نظام الحماية المطلوب.',

	// State / dev
	'core.state.queueEmpty': 'لا شيء في قائمة الانتظار.',
	'core.state.notReady': 'مشغل الوسائط ليس جاهزاً بعد.',

	// A11y announcements
	'core.a11y.playing': 'جاري تشغيل {title}',
	'core.a11y.paused': 'متوقف مؤقتاً',
	'core.a11y.stopped': 'متوقف',
	'core.a11y.seeking': 'جاري البحث إلى {time}',
	'core.a11y.trackChange': 'جاري تشغيل {title} الآن',
	'core.a11y.error': 'حدث خطأ أثناء التشغيل',
	'core.a11y.muted': 'مكتوم',
	'core.a11y.unmuted': 'غير مكتوم',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'تم إيقاف التشغيل مؤقتاً — علامة تبويب أخرى تشغل الآن.',
	'plugin.media-session.unsupported': 'عناصر تحكم الوسائط بنظام التشغيل غير متاحة في هذا المتصفح.',
};

export default arTranslations;
