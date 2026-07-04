// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Bengali core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'bn',
 *   translations: {
 *     ...defaultTranslations,
 *     bn: bnTranslations,
 *   },
 * });
 */
export const bnTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'কোনো ইন্টারনেট সংযোগ নেই।',
	'core.network.timeout': 'সংযোগ সময়-সীমা হয়েছে। পুনরায় চেষ্টা করছি…',
	'core.network.serverError': 'সার্ভারের সমস্যা রয়েছে। একটি মুহূর্তে আবার চেষ্টা করুন।',
	'core.network.notFound': 'সেই সামগ্রী খুঁজে পাওয়া যায়নি।',
	'core.network.rateLimited': 'অনেক বেশি অনুরোধ। দয়া করে ধীরগতিতে করুন।',

	// Auth
	'core.auth.unauthenticated': 'আপনার সেশন রিফ্রেশ করতে আবার সাইন ইন করুন।',
	'core.auth.forbidden': 'আপনার অ্যাকাউন্টের এই সামগ্রীতে অ্যাক্সেস নেই।',
	'core.auth.refreshFailed': 'আপনার সেশন রিফ্রেশ করা যায়নি। আবার সাইন ইন করুন।',

	// Browser policy
	'core.policy.autoplayBlocked': 'প্লেব্যাক শুরু করতে যেকোনো জায়গায় ট্যাপ করুন বা ক্লিক করুন।',
	'core.policy.userGestureRequired': 'অডিও সক্ষম করতে ট্যাপ করুন।',
	'core.policy.pipDenied': 'এই প্রসঙ্গে পিকচার-ইন-পিকচার অনুমতি নেই।',
	'core.policy.fullscreenDenied': 'এই প্রসঙ্গে পূর্ণ পর্দা অনুমতি নেই।',
	'core.policy.wakeLockDenied': 'প্লেব্যাকের সময় স্ক্রিন ম্লান হতে পারে।',

	// Media
	'core.media.unsupported': 'এই ফর্ম্যাট আপনার ব্রাউজার দ্বারা সমর্থিত নয়।',
	'core.media.decodeFailed': 'প্লেব্যাক ব্যর্থ — পরবর্তী উপলব্ধ উৎসে স্যুইচ করছি।',
	'core.media.allDecodeFailed': 'এই সামগ্রীর জন্য কোনো প্লেব্যাক্সযোগ্য উৎস উপলব্ধ নেই।',

	// DRM
	'core.drm.outputProtection': 'আপনার ডিসপ্লে এই সামগ্রীর সুরক্ষা প্রয়োজনীয়তা পূরণ করে না।',
	'core.drm.licenseFailed': 'এই সামগ্রীর জন্য লাইসেন্স পাওয়া যায়নি।',
	'core.drm.keySystemUnsupported': 'আপনার ব্রাউজার প্রয়োজনীয় সুরক্ষা সিস্টেম সমর্থন করে না।',

	// State / dev
	'core.state.queueEmpty': 'কিউতে কিছুই নেই।',
	'core.state.notReady': 'প্লেয়ার এখনও প্রস্তুত নয়।',

	// A11y announcements
	'core.a11y.playing': '{title} চলছে',
	'core.a11y.paused': 'বিরতিপ্রাপ্ত',
	'core.a11y.stopped': 'বন্ধ',
	'core.a11y.seeking': '{time} এ খোঁজা হচ্ছে',
	'core.a11y.trackChange': 'এখন {title} চলছে',
	'core.a11y.error': 'প্লেব্যাকের সময় একটি ত্রুটি ঘটেছে',
	'core.a11y.muted': 'নিঃশব্দ',
	'core.a11y.unmuted': 'শব্দ চালু',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'প্লেব্যাক বিরত — অন্য ট্যাব এখন চলছে।',
	'plugin.media-session.unsupported': 'OS মিডিয়া নিয়ন্ত্রণ এই ব্রাউজারে উপলব্ধ নয়।',
};

export default bnTranslations;
