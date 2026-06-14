// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Ukusakaza akutholakali kule divayisi.',
	'plugin.cast-sender.connecting': 'Kuxhumana ne-{device}…',
	'plugin.cast-sender.connected': 'Kusakazwa ku-{device}',
	'plugin.cast-sender.disconnected': 'Inqamukile ku-{device}',
	'plugin.cast-sender.error.session-failed': 'Ayikwazanga ukuqala iseshini yokusakaza.',
	'plugin.cast-sender.error.load-failed': 'Idivayisi yokusakaza yenqabe imidiya.',
	'plugin.cast-sender.error.generic': 'Kwenzeke iphutha lokusakaza.',
	'plugin.cast-sender.action.connect': 'Thumela',
	'plugin.cast-sender.action.disconnect': 'Misa ukusakaza',
	'plugin.cast-sender.state.buffering': 'Iyalayisha',
	'plugin.cast-sender.state.playing': 'Kudlala ku-{device}',
	'plugin.cast-sender.state.paused': 'Kumiswe okwesikhashana ku-{device}',
} satisfies Record<CastSenderTranslationKey, string>;
