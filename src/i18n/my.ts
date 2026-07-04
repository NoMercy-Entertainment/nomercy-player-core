// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Burmese core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'my',
 *   translations: {
 *     ...defaultTranslations,
 *     my: myTranslations,
 *   },
 * });
 */
export const myTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'အင်တာနက်ချိတ်ဆက်မှုမရှိ။',
	'core.network.timeout': 'ချိတ်ဆက်မှုအချိန်ကုန်။ ထပ်မံကြိုးစားနေသည်…',
	'core.network.serverError': 'ဆာဗာတွင်ပြဿနာရှိသည်။ အချိန်တိုအတွင်းထပ်မံကြိုးစားပါ။',
	'core.network.notFound': 'ဆိုင်းဖြင့်ခြင်း၏အပတ်ခွဲများကိုမတွေ့ရှိရန်မဟုတ်ပါ။',
	'core.network.rateLimited': 'အလွန်အများအပြင်ခ​ျစ်။ ကျေးဇူးပြု​ して​ ထည့်သွင်းပါ။',

	// Auth
	'core.auth.unauthenticated': 'သင်၏အခန်းကဏ္ဍကိုအဆင့်မြှင့်တင်ရန်ထပ်မံလည်းဝင်ပါ။',
	'core.auth.forbidden': 'သင်၏ဖြည့်စွက်ခြင်းကိုဤမည်တွင်သုံးခွင့်မရှိပါ။',
	'core.auth.refreshFailed': 'သင်၏အခန်းကဏ္ဍကိုအဆင့်မြှင့်တင်နိုင်ခြင်းမရှိ။ ထပ်မံလည်းဝင်ပါ။',

	// Browser policy
	'core.policy.autoplayBlocked': 'ကစားမှုမည်းကွင်းဖွင့်ရန်မည်သည့်နေရာတွင်ပဲည်ဖည်ပါ။',
	'core.policy.userGestureRequired': 'အသံပြုလုပ်ရန်ကစားပါ။',
	'core.policy.pipDenied': 'ဤသည့်အခြေအနေတွင်ပုံတွင်ပုံကိုခွင့်မြပါ။',
	'core.policy.fullscreenDenied': 'ဤသည့်အခြေအနေတွင်အားလုံးများကိုခွင့်မြပါ။',
	'core.policy.wakeLockDenied': 'ကစားစဉ်အကြင်းအခဲများမှာသိမ်းသည့်ဖန်လည်းချခြင်းခွင့်အတိုင်း။',

	// Media
	'core.media.unsupported': 'ဤမည်သည့်ပုံစံကိုအင်္ဂျင်တွင်မဖန်၍မရှိပါ။',
	'core.media.decodeFailed': 'ကစားမှုအမြင်လုံးလုံးမည်။ နောက်လည်း့သည့်အစုအစည်းကိုပြောင်းလဲ။',
	'core.media.allDecodeFailed': 'ဤမည်၌ကစားနိုင်သည့်အစုအစည်းမည်လည်းရှိပါ။',

	// DRM
	'core.drm.outputProtection': 'သင်၏ဖန်နှုတ်ပုံဆွဲကဤမည်၏ကာကွယ်မှုလိုအပ်ချက်များကိုမည်ပတ်။',
	'core.drm.licenseFailed': 'ဤမည်စာရွက်အတွက်လိုင်စင်ရရှိနိုင်ခြင်းမရှိ။',
	'core.drm.keySystemUnsupported': 'သင်၏ဘရောင်ဆာတွင်အလိုအလျောက်ကာကွယ်မှုစနစ်ကိုမဖန်၍မရှိပါ။',

	// State / dev
	'core.state.queueEmpty': 'အစီအစဉ်တွင်မည်လည်းမည།',
	'core.state.notReady': 'ကစားမူများတွင်အဆင်မြမည်လည်း။',

	// A11y announcements
	'core.a11y.playing': '{title}ကစားနေသည်',
	'core.a11y.paused': 'ခေတ်မီသည်',
	'core.a11y.stopped': 'ကျောင်းခုံရှုပ်ရှုပ်',
	'core.a11y.seeking': '{time}ကိုရှာဖွေ',
	'core.a11y.trackChange': 'လက်ရှိ{title}ကစားနေ',
	'core.a11y.error': 'ကစားစဉ်အမှားအခြားတစ်ခုအရှုံးခံရ',
	'core.a11y.muted': 'အသံလွှတ်ထုတ်',
	'core.a11y.unmuted': 'အသံဖွင့်',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'ကစားမှုခေတ်မီချခြင်း - အခြားစာမျက်နှာသည်ယခုကစားနေ၏။',
	'plugin.media-session.unsupported': 'OS ကဒ်မီဒီယာထိန်းချုပ်မှုအင်္ဂျင်သည်ဘရောင်ဆာတွင်မရှိပါ။',
};

export default myTranslations;
