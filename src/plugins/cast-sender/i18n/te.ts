// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'ఈ పరికరంలో కాస్టింగ్ అందుబాటులో లేదు.',
	'plugin.cast-sender.connecting': '{device} కు కనెక్ట్ అవుతోంది…',
	'plugin.cast-sender.connected': '{device} కు కాస్ట్ చేస్తోంది',
	'plugin.cast-sender.disconnected': '{device} నుండి డిస్‌కనెక్ట్ చేయబడింది',
	'plugin.cast-sender.error.session-failed': 'క్యాస్ట్ సెషన్‌ను ప్రారంభించలేకపోయాం.',
	'plugin.cast-sender.error.load-failed': 'క్యాస్ట్ పరికరం మీడియాను తిరస్కరించింది.',
	'plugin.cast-sender.error.generic': 'క్యాస్ట్ లోపం సంభవించింది.',
	'plugin.cast-sender.action.connect': 'ప్రసారించు',
	'plugin.cast-sender.action.disconnect': 'క్యాస్ట్ ఆపండి',
	'plugin.cast-sender.state.buffering': 'బఫరింగ్',
	'plugin.cast-sender.state.playing': '{device}లో ప్లే అవుతోంది',
	'plugin.cast-sender.state.paused': '{device}లో పాజ్ చేయబడింది',
} satisfies Record<CastSenderTranslationKey, string>;
