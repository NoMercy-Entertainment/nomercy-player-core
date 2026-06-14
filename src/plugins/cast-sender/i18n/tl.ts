// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Hindi available ang casting sa device na ito.',
	'plugin.cast-sender.connecting': 'Kumokonekta sa {device}…',
	'plugin.cast-sender.connected': 'Kina-cast sa {device}',
	'plugin.cast-sender.disconnected': 'Nadiskonekta mula sa {device}',
	'plugin.cast-sender.error.session-failed': 'Hindi masimulan ang cast session.',
	'plugin.cast-sender.error.load-failed': 'Tinanggihan ng cast device ang media.',
	'plugin.cast-sender.error.generic': 'May naganap na cast error.',
	'plugin.cast-sender.action.connect': 'I-cast',
	'plugin.cast-sender.action.disconnect': 'Itigil ang cast',
	'plugin.cast-sender.state.buffering': 'Nagba-buffer',
	'plugin.cast-sender.state.playing': 'Pinapatugtog sa {device}',
	'plugin.cast-sender.state.paused': 'Naka-pause sa {device}',
} satisfies Record<CastSenderTranslationKey, string>;
