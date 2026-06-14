// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'यस यन्त्रमा कास्टिङ उपलब्ध छैन।',
	'plugin.cast-sender.connecting': '{device} सँग जडान हुँदै…',
	'plugin.cast-sender.connected': '{device} मा कास्ट गर्दै',
	'plugin.cast-sender.disconnected': '{device} बाट विच्छेद भयो',
	'plugin.cast-sender.error.session-failed': 'कास्ट सत्र सुरु गर्न सकिएन।',
	'plugin.cast-sender.error.load-failed': 'कास्ट उपकरणले मिडिया अस्वीकार गर्‍यो।',
	'plugin.cast-sender.error.generic': 'कास्ट त्रुटि भयो।',
	'plugin.cast-sender.action.connect': 'कास्ट',
	'plugin.cast-sender.action.disconnect': 'कास्ट रोक्नुहोस्',
	'plugin.cast-sender.state.buffering': 'बफरिङ',
	'plugin.cast-sender.state.playing': '{device} मा प्ले हुँदै',
	'plugin.cast-sender.state.paused': '{device} मा पज गरिएको',
} satisfies Record<CastSenderTranslationKey, string>;
