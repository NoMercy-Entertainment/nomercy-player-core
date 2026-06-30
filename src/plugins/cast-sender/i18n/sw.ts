// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Utumaji haupatikani kwenye kifaa hiki.',
	'plugin.cast-sender.connecting': 'Inaunganisha kwenye {device}…',
	'plugin.cast-sender.connected': 'Inatuma kwa {device}',
	'plugin.cast-sender.disconnected': 'Imekatwa kutoka {device}',
	'plugin.cast-sender.error.session-failed': 'Imeshindwa kuanzisha kipindi cha kutangaza.',
	'plugin.cast-sender.error.load-failed': 'Kifaa cha kutangaza kilikataa media.',
	'plugin.cast-sender.error.generic': 'Hitilafu ya kutangaza imetokea.',
	'plugin.cast-sender.action.connect': 'Tuma',
	'plugin.cast-sender.action.disconnect': 'Acha kutangaza',
	'plugin.cast-sender.state.buffering': 'Inapakia',
	'plugin.cast-sender.state.playing': 'Inacheza kwenye {device}',
	'plugin.cast-sender.state.paused': 'Imesimamishwa kwenye {device}',
} satisfies Record<CastSenderTranslationKey, string>;
