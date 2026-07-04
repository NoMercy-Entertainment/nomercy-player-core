// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Persian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'fa',
 *   translations: {
 *     ...defaultTranslations,
 *     fa: faTranslations,
 *   },
 * });
 */
export const faTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'بدون اتصال اینترنتی.',
	'core.network.timeout': 'اتصال منقضی شد. دوباره تلاش…',
	'core.network.serverError': 'سرور دارای مشکل است. لحظه ای بعد دوباره امحاولهکنید.',
	'core.network.notFound': 'آن محتوا پیدا نشد.',
	'core.network.rateLimited': 'درخواست های زیادی. لطفا آهسته تر انجام دهید.',

	// Auth
	'core.auth.unauthenticated': 'دوباره وارد شوید تا نشست خود را تازه کنید.',
	'core.auth.forbidden': 'حساب شما دسترسی به این محتوا ندارد.',
	'core.auth.refreshFailed': 'نشست شما را نتوانست تازه کنید. دوباره وارد شوید.',

	// Browser policy
	'core.policy.autoplayBlocked': 'برای شروع پخش، هر جایی را لمس یا کلیک کنید.',
	'core.policy.userGestureRequired': 'برای فعال کردن صدا لمس کنید.',
	'core.policy.pipDenied': 'تصویر در تصویر در این زمینه مجاز نیست.',
	'core.policy.fullscreenDenied': 'تمام صفحه در این زمینه مجاز نیست.',
	'core.policy.wakeLockDenied': 'صفحه ممکن است در حین پخش تاریک شود.',

	// Media
	'core.media.unsupported': 'این قالب توسط مرورگر شما پشتیبانی نمی شود.',
	'core.media.decodeFailed': 'پخش ناموفق — تغییر به منبع بعدی موجود.',
	'core.media.allDecodeFailed': 'هیچ منبع پخش شدنی برای این محتوا موجود نیست.',

	// DRM
	'core.drm.outputProtection': 'نمایشگر شما الزامات حفاظت این محتوا را برآورده نمی کند.',
	'core.drm.licenseFailed': 'نتوانست مجوز برای این محتوا دریافت کند.',
	'core.drm.keySystemUnsupported': 'مرورگر شما سیستم حفاظت مورد نیاز را پشتیبانی نمی کند.',

	// State / dev
	'core.state.queueEmpty': 'چیزی در صف نیست.',
	'core.state.notReady': 'پخش کننده هنوز آماده نیست.',

	// A11y announcements
	'core.a11y.playing': 'پخش {title}',
	'core.a11y.paused': 'درحالتوقف',
	'core.a11y.stopped': 'متوقف شد',
	'core.a11y.seeking': 'در حال جستجو {time}',
	'core.a11y.trackChange': 'اکنون {title} پخش می شود',
	'core.a11y.error': 'خطایی در حین پخش رخ داد',
	'core.a11y.muted': 'بی صدا',
	'core.a11y.unmuted': 'صدا روشن',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'پخش متوقف شد — برگه دیگری اکنون درحال پخش است.',
	'plugin.media-session.unsupported': 'کنترل های رسانه سیستم عامل در این مرورگر موجود نیستند.',
};

export default faTranslations;
