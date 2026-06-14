// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'La difusion es pas disponibla sus aqueste aparelh.',
	'plugin.cast-sender.connecting': 'Connexion a {device}…',
	'plugin.cast-sender.connected': 'Difusion cap a {device}',
	'plugin.cast-sender.disconnected': 'Desconnectat de {device}',
	'plugin.cast-sender.error.session-failed': 'Impossible d\'aviar la session de difusion.',
	'plugin.cast-sender.error.load-failed': 'L\'aparelh de difusion a refusat lo mèdia.',
	'plugin.cast-sender.error.generic': 'Una error de difusion s\'es producha.',
	'plugin.cast-sender.action.connect': 'Emetre',
	'plugin.cast-sender.action.disconnect': 'Arrestar la difusion',
	'plugin.cast-sender.state.buffering': 'Cargament',
	'plugin.cast-sender.state.playing': 'Lectura sus {device}',
	'plugin.cast-sender.state.paused': 'En pausa sus {device}',
} satisfies Record<CastSenderTranslationKey, string>;
