// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'આ ઉપકરણ પર કાસ્ટિંગ ઉપલબ્ધ નથી.',
	'plugin.cast-sender.connecting': '{device} સાથે કનેક્ટ થઈ રહ્યું છે…',
	'plugin.cast-sender.connected': '{device} પર કાસ્ટ થઈ રહ્યું છે',
	'plugin.cast-sender.disconnected': '{device} થી જોડાણ તૂટી ગયું',
	'plugin.cast-sender.error.session-failed': 'કાસ્ટ સત્ર શરૂ કરી શકાયું નહીં.',
	'plugin.cast-sender.error.load-failed': 'કાસ્ટ ઉપકરણે મીડિયા નકારી દીધું.',
	'plugin.cast-sender.error.generic': 'કાસ્ટ ભૂલ આવી.',
	'plugin.cast-sender.action.connect': 'કાસ્ટ',
	'plugin.cast-sender.action.disconnect': 'કાસ્ટ કરવાનું બંધ કરો',
	'plugin.cast-sender.state.buffering': 'બફરિંગ',
	'plugin.cast-sender.state.playing': '{device} પર ચાલી રહ્યું છે',
	'plugin.cast-sender.state.paused': '{device} પર થોભાવ્યું',
} satisfies Record<CastSenderTranslationKey, string>;
