// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'El envío no está disponible en este dispositivo.',
	'plugin.cast-sender.connecting': 'Conectando con {device}…',
	'plugin.cast-sender.connected': 'Enviando a {device}',
	'plugin.cast-sender.disconnected': 'Desconectado de {device}',
	'plugin.cast-sender.error.session-failed': 'No se pudo iniciar la sesión de transmisión.',
	'plugin.cast-sender.error.load-failed': 'El dispositivo de transmisión rechazó el contenido.',
	'plugin.cast-sender.error.generic': 'Se produjo un error de transmisión.',
	'plugin.cast-sender.action.connect': 'Transmitir',
	'plugin.cast-sender.action.disconnect': 'Detener transmisión',
	'plugin.cast-sender.state.buffering': 'Cargando búfer',
	'plugin.cast-sender.state.playing': 'Reproduciendo en {device}',
	'plugin.cast-sender.state.paused': 'En pausa en {device}',
} satisfies Record<CastSenderTranslationKey, string>;
