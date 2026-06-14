// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Níl caitheamh ar fáil ar an ngléas seo.',
	'plugin.cast-sender.connecting': 'Ag nascadh le {device}…',
	'plugin.cast-sender.connected': 'Á chaitheamh chuig {device}',
	'plugin.cast-sender.disconnected': 'Dícheangailte ó {device}',
	'plugin.cast-sender.error.session-failed': 'Níorbh fhéidir an seisiún teilgean a thosú.',
	'plugin.cast-sender.error.load-failed': 'Dhiúltaigh an gléas teilgean don mheán.',
	'plugin.cast-sender.error.generic': 'Tharla earráid teilgean.',
	'plugin.cast-sender.action.connect': 'Teilg',
	'plugin.cast-sender.action.disconnect': 'Stop teilgean',
	'plugin.cast-sender.state.buffering': 'Ag maolánú',
	'plugin.cast-sender.state.playing': 'Á sheinm ar {device}',
	'plugin.cast-sender.state.paused': 'Ar sos ar {device}',
} satisfies Record<CastSenderTranslationKey, string>;
