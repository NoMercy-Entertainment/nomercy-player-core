// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Casting er ikke tilgjengelig på denne enheten.',
	'plugin.cast-sender.connecting': 'Kobler til {device}…',
	'plugin.cast-sender.connected': 'Caster til {device}',
	'plugin.cast-sender.disconnected': 'Koblet fra {device}',
	'plugin.cast-sender.error.session-failed': 'Kunne ikke starte cast-økten.',
	'plugin.cast-sender.error.load-failed': 'Cast-enheten avviste mediet.',
	'plugin.cast-sender.error.generic': 'Det oppstod en cast-feil.',
	'plugin.cast-sender.action.connect': 'Cast',
	'plugin.cast-sender.action.disconnect': 'Stopp cast',
	'plugin.cast-sender.state.buffering': 'Laster inn',
	'plugin.cast-sender.state.playing': 'Spiller av på {device}',
	'plugin.cast-sender.state.paused': 'Satt på pause på {device}',
} satisfies Record<CastSenderTranslationKey, string>;
