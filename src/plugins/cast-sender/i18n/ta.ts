// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'இந்த சாதனத்தில் காஸ்டிங் கிடைக்கவில்லை.',
	'plugin.cast-sender.connecting': '{device} உடன் இணைக்கப்படுகிறது…',
	'plugin.cast-sender.connected': '{device} க்கு அனுப்பப்படுகிறது',
	'plugin.cast-sender.disconnected': '{device} இலிருந்து துண்டிக்கப்பட்டது',
	'plugin.cast-sender.error.session-failed': 'காஸ்ட் அமர்வைத் தொடங்க முடியவில்லை.',
	'plugin.cast-sender.error.load-failed': 'காஸ்ட் சாதனம் ஊடகத்தை நிராகரித்தது.',
	'plugin.cast-sender.error.generic': 'ஒரு காஸ்ட் பிழை ஏற்பட்டது.',
	'plugin.cast-sender.action.connect': 'அனுப்பு',
	'plugin.cast-sender.action.disconnect': 'காஸ்ட் செய்வதை நிறுத்து',
	'plugin.cast-sender.state.buffering': 'இடையகப்படுத்துகிறது',
	'plugin.cast-sender.state.playing': '{device} இல் இயக்கப்படுகிறது',
	'plugin.cast-sender.state.paused': '{device} இல் இடைநிறுத்தப்பட்டது',
} satisfies Record<CastSenderTranslationKey, string>;
