// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Transmiterea nu este disponibilă pe acest dispozitiv.',
	'plugin.cast-sender.connecting': 'Se conectează la {device}…',
	'plugin.cast-sender.connected': 'Se transmite către {device}',
	'plugin.cast-sender.disconnected': 'Deconectat de la {device}',
	'plugin.cast-sender.error.session-failed': 'Sesiunea de difuzare nu a putut fi pornită.',
	'plugin.cast-sender.error.load-failed': 'Dispozitivul de difuzare a refuzat conținutul media.',
	'plugin.cast-sender.error.generic': 'A apărut o eroare de difuzare.',
	'plugin.cast-sender.action.connect': 'Redare',
	'plugin.cast-sender.action.disconnect': 'Oprește difuzarea',
	'plugin.cast-sender.state.buffering': 'Se încarcă',
	'plugin.cast-sender.state.playing': 'Se redă pe {device}',
	'plugin.cast-sender.state.paused': 'În pauză pe {device}',
} satisfies Record<CastSenderTranslationKey, string>;
