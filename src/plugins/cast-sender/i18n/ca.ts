// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'L\'emissió no està disponible en aquest dispositiu.',
	'plugin.cast-sender.connecting': 'S\'està connectant a {device}…',
	'plugin.cast-sender.connected': 'S\'està emetent a {device}',
	'plugin.cast-sender.disconnected': 'S\'ha desconnectat de {device}',
	'plugin.cast-sender.error.session-failed': 'No s\'ha pogut iniciar la sessió de transmissió.',
	'plugin.cast-sender.error.load-failed': 'El dispositiu de transmissió ha rebutjat el contingut.',
	'plugin.cast-sender.error.generic': 'S\'ha produït un error de transmissió.',
	'plugin.cast-sender.action.connect': 'Emetre',
	'plugin.cast-sender.action.disconnect': 'Atura la transmissió',
	'plugin.cast-sender.state.buffering': 'Carregant memòria intermèdia',
	'plugin.cast-sender.state.playing': 'S\'està reproduint a {device}',
	'plugin.cast-sender.state.paused': 'En pausa a {device}',
} satisfies Record<CastSenderTranslationKey, string>;
