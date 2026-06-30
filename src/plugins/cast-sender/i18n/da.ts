// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Casting er ikke tilgængelig på denne enhed.',
	'plugin.cast-sender.connecting': 'Opretter forbindelse til {device}…',
	'plugin.cast-sender.connected': 'Caster til {device}',
	'plugin.cast-sender.disconnected': 'Afbrudt fra {device}',
	'plugin.cast-sender.error.session-failed': 'Cast-sessionen kunne ikke startes.',
	'plugin.cast-sender.error.load-failed': 'Cast-enheden afviste mediet.',
	'plugin.cast-sender.error.generic': 'Der opstod en cast-fejl.',
	'plugin.cast-sender.action.connect': 'Cast',
	'plugin.cast-sender.action.disconnect': 'Stop cast',
	'plugin.cast-sender.state.buffering': 'Indlæser i buffer',
	'plugin.cast-sender.state.playing': 'Afspiller på {device}',
	'plugin.cast-sender.state.paused': 'Sat på pause på {device}',
} satisfies Record<CastSenderTranslationKey, string>;
