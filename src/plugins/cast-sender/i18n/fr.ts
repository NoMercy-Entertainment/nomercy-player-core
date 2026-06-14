// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'La diffusion n\'est pas disponible sur cet appareil.',
	'plugin.cast-sender.connecting': 'Connexion à {device}…',
	'plugin.cast-sender.connected': 'Diffusion vers {device}',
	'plugin.cast-sender.disconnected': 'Déconnecté de {device}',
	'plugin.cast-sender.error.session-failed': 'Impossible de démarrer la session de diffusion.',
	'plugin.cast-sender.error.load-failed': 'L\'appareil de diffusion a refusé le média.',
	'plugin.cast-sender.error.generic': 'Une erreur de diffusion s\'est produite.',
	'plugin.cast-sender.action.connect': 'Diffusion',
	'plugin.cast-sender.action.disconnect': 'Arrêter la diffusion',
	'plugin.cast-sender.state.buffering': 'Mise en mémoire tampon',
	'plugin.cast-sender.state.playing': 'Lecture sur {device}',
	'plugin.cast-sender.state.paused': 'En pause sur {device}',
} satisfies Record<CastSenderTranslationKey, string>;
