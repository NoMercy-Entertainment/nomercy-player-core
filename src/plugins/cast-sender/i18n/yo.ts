// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Cast kò sí lórí ẹ̀rọ yìí.',
	'plugin.cast-sender.connecting': 'Ń sopọ̀ sí {device}…',
	'plugin.cast-sender.connected': 'Ń ṣe Cast sí {device}',
	'plugin.cast-sender.disconnected': 'Ti ya kúrò lọ́dọ̀ {device}',
	'plugin.cast-sender.error.session-failed': 'Kò lè bẹ̀rẹ̀ ìpàdé ìgbóhùnsáfẹ́fẹ́.',
	'plugin.cast-sender.error.load-failed': 'Ẹ̀rọ ìgbóhùnsáfẹ́fẹ́ kọ media náà.',
	'plugin.cast-sender.error.generic': 'Àṣìṣe ìgbóhùnsáfẹ́fẹ́ kan ṣẹlẹ̀.',
	'plugin.cast-sender.action.connect': 'Tẹ̀léfísọ̀n',
	'plugin.cast-sender.action.disconnect': 'Dúró ìgbóhùnsáfẹ́fẹ́',
	'plugin.cast-sender.state.buffering': 'N ṣe àfipamọ́',
	'plugin.cast-sender.state.playing': 'Ń ṣiṣẹ́ lórí {device}',
	'plugin.cast-sender.state.paused': 'Dúró fún ìgbà díẹ̀ lórí {device}',
} satisfies Record<CastSenderTranslationKey, string>;
