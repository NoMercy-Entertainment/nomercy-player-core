// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Nid yw castio ar gael ar y ddyfais hon.',
	'plugin.cast-sender.connecting': 'Yn cysylltu â {device}…',
	'plugin.cast-sender.connected': 'Castio i {device}',
	'plugin.cast-sender.disconnected': 'Datgysylltwyd o {device}',
	'plugin.cast-sender.error.session-failed': 'Methwyd dechrau\'r sesiwn castio.',
	'plugin.cast-sender.error.load-failed': 'Gwrthododd y ddyfais gastio\'r cyfrwng.',
	'plugin.cast-sender.error.generic': 'Digwyddodd gwall castio.',
	'plugin.cast-sender.action.connect': 'Bwrw',
	'plugin.cast-sender.action.disconnect': 'Stopio castio',
	'plugin.cast-sender.state.buffering': 'Bwffro',
	'plugin.cast-sender.state.playing': 'Yn chwarae ar {device}',
	'plugin.cast-sender.state.paused': 'Wedi\'i oedi ar {device}',
} satisfies Record<CastSenderTranslationKey, string>;
