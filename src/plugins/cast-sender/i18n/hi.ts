// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'इस डिवाइस पर कास्टिंग उपलब्ध नहीं है।',
	'plugin.cast-sender.connecting': '{device} से कनेक्ट हो रहा है…',
	'plugin.cast-sender.connected': '{device} पर कास्ट हो रहा है',
	'plugin.cast-sender.disconnected': '{device} से कनेक्शन टूट गया',
	'plugin.cast-sender.error.session-failed': 'कास्ट सत्र शुरू नहीं किया जा सका।',
	'plugin.cast-sender.error.load-failed': 'कास्ट डिवाइस ने मीडिया अस्वीकार कर दिया।',
	'plugin.cast-sender.error.generic': 'एक कास्ट त्रुटि हुई।',
	'plugin.cast-sender.action.connect': 'कास्ट',
	'plugin.cast-sender.action.disconnect': 'कास्ट करना रोकें',
	'plugin.cast-sender.state.buffering': 'बफ़रिंग',
	'plugin.cast-sender.state.playing': '{device} पर चल रहा है',
	'plugin.cast-sender.state.paused': '{device} पर रोका गया',
} satisfies Record<CastSenderTranslationKey, string>;
