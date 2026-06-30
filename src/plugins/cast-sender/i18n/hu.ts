// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Az átküldés nem érhető el ezen az eszközön.',
	'plugin.cast-sender.connecting': 'Csatlakozás a következőhöz: {device}…',
	'plugin.cast-sender.connected': 'Átküldés a következőre: {device}',
	'plugin.cast-sender.disconnected': 'Lecsatlakozva a következőről: {device}',
	'plugin.cast-sender.error.session-failed': 'A casttelés nem indítható el.',
	'plugin.cast-sender.error.load-failed': 'A casteszköz elutasította a médiát.',
	'plugin.cast-sender.error.generic': 'Casthiba történt.',
	'plugin.cast-sender.action.connect': 'Közvetítés',
	'plugin.cast-sender.action.disconnect': 'Castelés leállítása',
	'plugin.cast-sender.state.buffering': 'Pufferelés',
	'plugin.cast-sender.state.playing': 'Lejátszás itt: {device}',
	'plugin.cast-sender.state.paused': 'Szüneteltetve itt: {device}',
} satisfies Record<CastSenderTranslationKey, string>;
