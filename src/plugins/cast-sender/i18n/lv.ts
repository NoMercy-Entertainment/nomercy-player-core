// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Apraide šajā ierīcē nav pieejama.',
	'plugin.cast-sender.connecting': 'Notiek savienojums ar {device}…',
	'plugin.cast-sender.connected': 'Tiek apraidīts uz {device}',
	'plugin.cast-sender.disconnected': 'Atvienots no {device}',
	'plugin.cast-sender.error.session-failed': 'Neizdevās sākt apraides sesiju.',
	'plugin.cast-sender.error.load-failed': 'Apraides ierīce noraidīja saturu.',
	'plugin.cast-sender.error.generic': 'Radās apraides kļūda.',
	'plugin.cast-sender.action.connect': 'Straumēt uz ierīci',
	'plugin.cast-sender.action.disconnect': 'Apturēt apraidi',
	'plugin.cast-sender.state.buffering': 'Buferizēšana',
	'plugin.cast-sender.state.playing': 'Atskaņo ierīcē {device}',
	'plugin.cast-sender.state.paused': 'Pauzēts ierīcē {device}',
} satisfies Record<CastSenderTranslationKey, string>;
