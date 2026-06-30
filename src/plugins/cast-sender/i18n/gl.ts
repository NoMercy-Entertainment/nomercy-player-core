// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'A emisión non está dispoñible neste dispositivo.',
	'plugin.cast-sender.connecting': 'Conectando con {device}…',
	'plugin.cast-sender.connected': 'Emitindo a {device}',
	'plugin.cast-sender.disconnected': 'Desconectado de {device}',
	'plugin.cast-sender.error.session-failed': 'Non se puido iniciar a sesión de emisión.',
	'plugin.cast-sender.error.load-failed': 'O dispositivo de emisión rexeitou o contido.',
	'plugin.cast-sender.error.generic': 'Produciuse un erro de emisión.',
	'plugin.cast-sender.action.connect': 'Transmitir',
	'plugin.cast-sender.action.disconnect': 'Deter a emisión',
	'plugin.cast-sender.state.buffering': 'Cargando búfer',
	'plugin.cast-sender.state.playing': 'Reproducindo en {device}',
	'plugin.cast-sender.state.paused': 'En pausa en {device}',
} satisfies Record<CastSenderTranslationKey, string>;
