// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Perdavimas šiame įrenginyje nepasiekiamas.',
	'plugin.cast-sender.connecting': 'Jungiamasi prie {device}…',
	'plugin.cast-sender.connected': 'Perduodama į {device}',
	'plugin.cast-sender.disconnected': 'Atjungta nuo {device}',
	'plugin.cast-sender.error.session-failed': 'Nepavyko pradėti perdavimo seanso.',
	'plugin.cast-sender.error.load-failed': 'Perdavimo įrenginys atmetė mediją.',
	'plugin.cast-sender.error.generic': 'Įvyko perdavimo klaida.',
	'plugin.cast-sender.action.connect': 'Transliuoti',
	'plugin.cast-sender.action.disconnect': 'Stabdyti perdavimą',
	'plugin.cast-sender.state.buffering': 'Buferizuojama',
	'plugin.cast-sender.state.playing': 'Atkuriama įrenginyje {device}',
	'plugin.cast-sender.state.paused': 'Pristabdyta įrenginyje {device}',
} satisfies Record<CastSenderTranslationKey, string>;
