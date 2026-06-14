// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Transmetimi nuk është i disponueshëm në këtë pajisje.',
	'plugin.cast-sender.connecting': 'Po lidhet me {device}…',
	'plugin.cast-sender.connected': 'Po transmetohet te {device}',
	'plugin.cast-sender.disconnected': 'U shkëput nga {device}',
	'plugin.cast-sender.error.session-failed': 'Sesioni i transmetimit nuk mund të niste.',
	'plugin.cast-sender.error.load-failed': 'Pajisja e transmetimit e refuzoi median.',
	'plugin.cast-sender.error.generic': 'Ndodhi një gabim transmetimi.',
	'plugin.cast-sender.action.connect': 'Transmetim',
	'plugin.cast-sender.action.disconnect': 'Ndalo transmetimin',
	'plugin.cast-sender.state.buffering': 'Duke ngarkuar',
	'plugin.cast-sender.state.playing': 'Po luhet në {device}',
	'plugin.cast-sender.state.paused': 'Në pauzë në {device}',
} satisfies Record<CastSenderTranslationKey, string>;
