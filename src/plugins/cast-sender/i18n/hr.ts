// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Emitiranje nije dostupno na ovom uređaju.',
	'plugin.cast-sender.connecting': 'Povezivanje s {device}…',
	'plugin.cast-sender.connected': 'Emitiranje na {device}',
	'plugin.cast-sender.disconnected': 'Prekinuta veza s {device}',
	'plugin.cast-sender.error.session-failed': 'Nije moguće pokrenuti sesiju emitiranja.',
	'plugin.cast-sender.error.load-failed': 'Uređaj za emitiranje odbio je medij.',
	'plugin.cast-sender.error.generic': 'Došlo je do pogreške emitiranja.',
	'plugin.cast-sender.action.connect': 'Emitiranje',
	'plugin.cast-sender.action.disconnect': 'Zaustavi emitiranje',
	'plugin.cast-sender.state.buffering': 'Spremanje u međuspremnik',
	'plugin.cast-sender.state.playing': 'Reproducira se na {device}',
	'plugin.cast-sender.state.paused': 'Pauzirano na {device}',
} satisfies Record<CastSenderTranslationKey, string>;
