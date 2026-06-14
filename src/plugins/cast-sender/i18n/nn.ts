// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Casting er ikkje tilgjengeleg på denne eininga.',
	'plugin.cast-sender.connecting': 'Koplar til {device}…',
	'plugin.cast-sender.connected': 'Castar til {device}',
	'plugin.cast-sender.disconnected': 'Kopla frå {device}',
	'plugin.cast-sender.error.session-failed': 'Kunne ikkje starte cast-økta.',
	'plugin.cast-sender.error.load-failed': 'Cast-eininga avviste mediet.',
	'plugin.cast-sender.error.generic': 'Det oppstod ein cast-feil.',
	'plugin.cast-sender.action.connect': 'Cast',
	'plugin.cast-sender.action.disconnect': 'Stopp cast',
	'plugin.cast-sender.state.buffering': 'Lastar inn',
	'plugin.cast-sender.state.playing': 'Spelar av på {device}',
	'plugin.cast-sender.state.paused': 'Sett på pause på {device}',
} satisfies Record<CastSenderTranslationKey, string>;
