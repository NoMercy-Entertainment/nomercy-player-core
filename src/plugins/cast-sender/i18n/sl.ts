// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Predvajanje v tej napravi ni na voljo.',
	'plugin.cast-sender.connecting': 'Povezovanje z {device}…',
	'plugin.cast-sender.connected': 'Predvajanje na {device}',
	'plugin.cast-sender.disconnected': 'Prekinjena povezava z {device}',
	'plugin.cast-sender.error.session-failed': 'Seje predvajanja ni bilo mogoče začeti.',
	'plugin.cast-sender.error.load-failed': 'Naprava za predvajanje je zavrnila medij.',
	'plugin.cast-sender.error.generic': 'Prišlo je do napake pri predvajanju.',
	'plugin.cast-sender.action.connect': 'Predvajaj na TV',
	'plugin.cast-sender.action.disconnect': 'Ustavi predvajanje',
	'plugin.cast-sender.state.buffering': 'Medpomnjenje',
	'plugin.cast-sender.state.playing': 'Predvaja se na {device}',
	'plugin.cast-sender.state.paused': 'Zaustavljeno na {device}',
} satisfies Record<CastSenderTranslationKey, string>;
