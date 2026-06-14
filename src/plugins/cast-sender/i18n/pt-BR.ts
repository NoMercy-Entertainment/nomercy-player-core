// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'A transmissão não está disponível neste dispositivo.',
	'plugin.cast-sender.connecting': 'Conectando a {device}…',
	'plugin.cast-sender.connected': 'Transmitindo para {device}',
	'plugin.cast-sender.disconnected': 'Desconectado de {device}',
	'plugin.cast-sender.error.session-failed': 'Não foi possível iniciar a sessão de transmissão.',
	'plugin.cast-sender.error.load-failed': 'O dispositivo de transmissão recusou a mídia.',
	'plugin.cast-sender.error.generic': 'Ocorreu um erro de transmissão.',
	'plugin.cast-sender.action.connect': 'Transmitir',
	'plugin.cast-sender.action.disconnect': 'Parar transmissão',
	'plugin.cast-sender.state.buffering': 'Carregando',
	'plugin.cast-sender.state.playing': 'Reproduzindo em {device}',
	'plugin.cast-sender.state.paused': 'Pausado em {device}',
} satisfies Record<CastSenderTranslationKey, string>;
