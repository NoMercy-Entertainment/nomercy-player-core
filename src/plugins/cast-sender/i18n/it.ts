// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'La trasmissione non è disponibile su questo dispositivo.',
	'plugin.cast-sender.connecting': 'Connessione a {device}…',
	'plugin.cast-sender.connected': 'Trasmissione su {device}',
	'plugin.cast-sender.disconnected': 'Disconnesso da {device}',
	'plugin.cast-sender.error.session-failed': 'Impossibile avviare la sessione di trasmissione.',
	'plugin.cast-sender.error.load-failed': 'Il dispositivo di trasmissione ha rifiutato il contenuto.',
	'plugin.cast-sender.error.generic': 'Si è verificato un errore di trasmissione.',
	'plugin.cast-sender.action.connect': 'Cast',
	'plugin.cast-sender.action.disconnect': 'Interrompi trasmissione',
	'plugin.cast-sender.state.buffering': 'Buffering',
	'plugin.cast-sender.state.playing': 'In riproduzione su {device}',
	'plugin.cast-sender.state.paused': 'In pausa su {device}',
} satisfies Record<CastSenderTranslationKey, string>;
