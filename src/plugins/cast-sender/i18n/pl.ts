// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Przesyłanie nie jest dostępne na tym urządzeniu.',
	'plugin.cast-sender.connecting': 'Łączenie z {device}…',
	'plugin.cast-sender.connected': 'Przesyłanie do {device}',
	'plugin.cast-sender.disconnected': 'Rozłączono z {device}',
	'plugin.cast-sender.error.session-failed': 'Nie udało się rozpocząć sesji przesyłania.',
	'plugin.cast-sender.error.load-failed': 'Urządzenie do przesyłania odrzuciło multimedia.',
	'plugin.cast-sender.error.generic': 'Wystąpił błąd przesyłania.',
	'plugin.cast-sender.action.connect': 'Rzuć',
	'plugin.cast-sender.action.disconnect': 'Zatrzymaj przesyłanie',
	'plugin.cast-sender.state.buffering': 'Buforowanie',
	'plugin.cast-sender.state.playing': 'Odtwarzanie na {device}',
	'plugin.cast-sender.state.paused': 'Wstrzymano na {device}',
} satisfies Record<CastSenderTranslationKey, string>;
