// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'এই ডিভাইসে কাস্টিং উপলব্ধ নয়।',
	'plugin.cast-sender.connecting': '{device}-এ সংযোগ করা হচ্ছে…',
	'plugin.cast-sender.connected': '{device}-এ কাস্ট করা হচ্ছে',
	'plugin.cast-sender.disconnected': '{device} থেকে সংযোগ বিচ্ছিন্ন হয়েছে',
	'plugin.cast-sender.error.session-failed': 'কাস্ট সেশন শুরু করা যায়নি।',
	'plugin.cast-sender.error.load-failed': 'কাস্ট ডিভাইসটি মিডিয়া প্রত্যাখ্যান করেছে।',
	'plugin.cast-sender.error.generic': 'একটি কাস্ট ত্রুটি ঘটেছে।',
	'plugin.cast-sender.action.connect': 'কাস্ট',
	'plugin.cast-sender.action.disconnect': 'কাস্ট করা বন্ধ করুন',
	'plugin.cast-sender.state.buffering': 'বাফারিং',
	'plugin.cast-sender.state.playing': '{device}-এ চলছে',
	'plugin.cast-sender.state.paused': '{device}-এ বিরতি দেওয়া হয়েছে',
} satisfies Record<CastSenderTranslationKey, string>;
