// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Urdu core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ur',
 *   translations: {
 *     ...defaultTranslations,
 *     ur: urTranslations,
 *   },
 * });
 */
export const urTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'کوئی انٹرنیٹ کنکشن نہیں۔',
	'core.network.timeout': 'کنکشن ختم ہو گیا۔ دوبارہ کوشش کر رہے ہیں…',
	'core.network.serverError': 'سرور میں مسائل ہیں۔ لمحہ میں دوبارہ کوشش کریں۔',
	'core.network.notFound': 'وہ مواد نہیں ملا۔',
	'core.network.rateLimited': 'بہت ساری درخواستیں۔ براہ کرم سست ہو جائیں۔',

	// Auth
	'core.auth.unauthenticated': 'اپنے سیشن کو تازہ کرنے کے لیے دوبارہ سائن ان کریں۔',
	'core.auth.forbidden': 'آپ کے اکاؤنٹ کو اس مواد تک رسائی نہیں ہے۔',
	'core.auth.refreshFailed': 'آپ کے سیشن کو تازہ نہیں کیا جا سکا۔ دوبارہ سائن ان کریں۔',

	// Browser policy
	'core.policy.autoplayBlocked': 'چلانا شروع کرنے کے لیے کہیں بھی ٹیپ یا کلک کریں۔',
	'core.policy.userGestureRequired': 'آڈیو فعال کرنے کے لیے ٹیپ کریں۔',
	'core.policy.pipDenied': 'اس سیاق و سباق میں تصویر میں تصویر کی اجازت نہیں ہے۔',
	'core.policy.fullscreenDenied': 'اس سیاق و سباق میں پوری اسکرین کی اجازت نہیں ہے۔',
	'core.policy.wakeLockDenied': 'چلانے کے دوران اسکرین بند ہو سکتی ہے۔',

	// Media
	'core.media.unsupported': 'یہ شکل آپ کے براؤزر کے ذریعے سپورٹ نہیں ہے۔',
	'core.media.decodeFailed': 'چلانا ناکام - اگلے دستیاب ذریعہ پر سوئچ کر رہے ہیں۔',
	'core.media.allDecodeFailed': 'اس مواد کے لیے کوئی چلنے والا ذریعہ دستیاب نہیں ہے۔',

	// DRM
	'core.drm.outputProtection': 'آپ کی ڈسپلے اس مواد کے تحفظ کی ضروریات کو پورا نہیں کرتی۔',
	'core.drm.licenseFailed': 'اس مواد کے لیے لائسنس حاصل نہیں کیا جا سکا۔',
	'core.drm.keySystemUnsupported': 'آپ کا براؤزر ضروری حفاظتی نظام کو سپورٹ نہیں کرتا۔',

	// State / dev
	'core.state.queueEmpty': 'قطار میں کوئی چیز نہیں ہے۔',
	'core.state.notReady': 'پلیئر ابھی تک تیار نہیں ہے۔',

	// A11y announcements
	'core.a11y.playing': '{title} چل رہا ہے',
	'core.a11y.paused': 'موقوف',
	'core.a11y.stopped': 'رک گیا',
	'core.a11y.seeking': '{time} کے لیے تلاش کر رہے ہیں',
	'core.a11y.trackChange': 'اب {title} چل رہا ہے',
	'core.a11y.error': 'چلنے کے دوران ایک خرابی واقع ہوئی',
	'core.a11y.muted': 'خاموش',
	'core.a11y.unmuted': 'آڈیو آن',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'چلانا موقوف کیا گیا - دوسری ٹیب اب چل رہی ہے۔',
	'plugin.media-session.unsupported': 'OS میڈیا کنٹرول اس براؤزر میں دستیاب نہیں ہیں۔',
};

export default urTranslations;
