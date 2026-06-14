// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'या डिव्हाइसवर कास्टिंग उपलब्ध नाही.',
	'plugin.cast-sender.connecting': '{device} शी कनेक्ट होत आहे…',
	'plugin.cast-sender.connected': '{device} वर कास्ट होत आहे',
	'plugin.cast-sender.disconnected': '{device} पासून कनेक्शन तुटले',
	'plugin.cast-sender.error.session-failed': 'कास्ट सत्र सुरू करता आले नाही.',
	'plugin.cast-sender.error.load-failed': 'कास्ट उपकरणाने मीडिया नाकारला.',
	'plugin.cast-sender.error.generic': 'कास्ट त्रुटी आली.',
	'plugin.cast-sender.action.connect': 'कास्ट',
	'plugin.cast-sender.action.disconnect': 'कास्ट करणे थांबवा',
	'plugin.cast-sender.state.buffering': 'बफरिंग',
	'plugin.cast-sender.state.playing': '{device} वर वाजत आहे',
	'plugin.cast-sender.state.paused': '{device} वर थांबवले',
} satisfies Record<CastSenderTranslationKey, string>;
