// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Weşandin li ser vê amûrê tune.',
	'plugin.cast-sender.connecting': 'Bi {device} ve girêdan…',
	'plugin.cast-sender.connected': 'Li {device} tê weşandin',
	'plugin.cast-sender.disconnected': 'Ji {device} qut bû',
	'plugin.cast-sender.error.session-failed': 'Danişîna weşandinê dest pê nekir.',
	'plugin.cast-sender.error.load-failed': 'Amûra weşandinê medya red kir.',
	'plugin.cast-sender.error.generic': 'Çewtiyeke weşandinê çêbû.',
	'plugin.cast-sender.action.connect': 'Cast',
	'plugin.cast-sender.action.disconnect': 'Weşandinê rawestîne',
	'plugin.cast-sender.state.buffering': 'Barkirin',
	'plugin.cast-sender.state.playing': 'Li ser {device} tê lêdan',
	'plugin.cast-sender.state.paused': 'Li ser {device} hate rawestandin',
} satisfies Record<CastSenderTranslationKey, string>;
