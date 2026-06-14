// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Ukusasaza akufumaneki kwesi sixhobo.',
	'plugin.cast-sender.connecting': 'Kuqhagamshelwa ku-{device}…',
	'plugin.cast-sender.connected': 'Kusasazwa ku-{device}',
	'plugin.cast-sender.disconnected': 'Inqunyulwe kwi-{device}',
	'plugin.cast-sender.error.session-failed': 'Ayikwazanga ukuqalisa iseshoni yokusasaza.',
	'plugin.cast-sender.error.load-failed': 'Isixhobo sokusasaza siyalile imidiya.',
	'plugin.cast-sender.error.generic': 'Kwenzeke impazamo yokusasaza.',
	'plugin.cast-sender.action.connect': 'Thumela',
	'plugin.cast-sender.action.disconnect': 'Yeka ukusasaza',
	'plugin.cast-sender.state.buffering': 'Iyalayisha',
	'plugin.cast-sender.state.playing': 'Idlala kwi-{device}',
	'plugin.cast-sender.state.paused': 'Inqunyanyisiwe kwi-{device}',
} satisfies Record<CastSenderTranslationKey, string>;
