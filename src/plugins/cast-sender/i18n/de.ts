// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Streaming ist auf diesem Gerät nicht verfügbar.',
	'plugin.cast-sender.connecting': 'Verbindung mit {device} wird hergestellt…',
	'plugin.cast-sender.connected': 'Streaming an {device}',
	'plugin.cast-sender.disconnected': 'Verbindung zu {device} getrennt',
	'plugin.cast-sender.error.session-failed': 'Die Cast-Sitzung konnte nicht gestartet werden.',
	'plugin.cast-sender.error.load-failed': 'Das Cast-Gerät hat die Medien abgelehnt.',
	'plugin.cast-sender.error.generic': 'Ein Cast-Fehler ist aufgetreten.',
	'plugin.cast-sender.action.connect': 'Übertragen',
	'plugin.cast-sender.action.disconnect': 'Cast beenden',
	'plugin.cast-sender.state.buffering': 'Puffern',
	'plugin.cast-sender.state.playing': 'Wiedergabe auf {device}',
	'plugin.cast-sender.state.paused': 'Pausiert auf {device}',
} satisfies Record<CastSenderTranslationKey, string>;
