// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'ဤစက်ပစ္စည်းတွင် Cast လုပ်၍မရပါ။',
	'plugin.cast-sender.connecting': '{device} သို့ ချိတ်ဆက်နေသည်…',
	'plugin.cast-sender.connected': '{device} သို့ Cast လုပ်နေသည်',
	'plugin.cast-sender.disconnected': '{device} မှ ချိတ်ဆက်မှု ပြတ်တောက်သွားသည်',
	'plugin.cast-sender.error.session-failed': 'Cast session ကို စတင်၍မရပါ။',
	'plugin.cast-sender.error.load-failed': 'Cast စက်ပစ္စည်းက မီဒီယာကို ငြင်းပယ်လိုက်သည်။',
	'plugin.cast-sender.error.generic': 'Cast အမှားတစ်ခု ဖြစ်ပွားခဲ့သည်။',
	'plugin.cast-sender.action.connect': 'ထုတ်လွှင့်',
	'plugin.cast-sender.action.disconnect': 'Cast ရပ်ရန်',
	'plugin.cast-sender.state.buffering': 'ဘာဖာလုပ်နေသည်',
	'plugin.cast-sender.state.playing': '{device} တွင် ဖွင့်နေသည်',
	'plugin.cast-sender.state.paused': '{device} တွင် ခေတ္တရပ်ထားသည်',
} satisfies Record<CastSenderTranslationKey, string>;
