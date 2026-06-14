// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Casting är inte tillgängligt på den här enheten.',
	'plugin.cast-sender.connecting': 'Ansluter till {device}…',
	'plugin.cast-sender.connected': 'Castar till {device}',
	'plugin.cast-sender.disconnected': 'Frånkopplad från {device}',
	'plugin.cast-sender.error.session-failed': 'Det gick inte att starta castningssessionen.',
	'plugin.cast-sender.error.load-failed': 'Castningsenheten avvisade mediet.',
	'plugin.cast-sender.error.generic': 'Ett castningsfel inträffade.',
	'plugin.cast-sender.action.connect': 'Sändning',
	'plugin.cast-sender.action.disconnect': 'Stoppa castning',
	'plugin.cast-sender.state.buffering': 'Buffrar',
	'plugin.cast-sender.state.playing': 'Spelas upp på {device}',
	'plugin.cast-sender.state.paused': 'Pausad på {device}',
} satisfies Record<CastSenderTranslationKey, string>;
