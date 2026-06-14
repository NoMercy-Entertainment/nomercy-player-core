// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Igorpena ez dago erabilgarri gailu honetan.',
	'plugin.cast-sender.connecting': '{device}(e)ra konektatzen…',
	'plugin.cast-sender.connected': '{device}(e)ra igortzen',
	'plugin.cast-sender.disconnected': '{device} gailutik deskonektatuta',
	'plugin.cast-sender.error.session-failed': 'Ezin izan da igorpen-saioa hasi.',
	'plugin.cast-sender.error.load-failed': 'Igorpen-gailuak multimedia errefusatu du.',
	'plugin.cast-sender.error.generic': 'Igorpen-errore bat gertatu da.',
	'plugin.cast-sender.action.connect': 'Igorri',
	'plugin.cast-sender.action.disconnect': 'Gelditu igorpena',
	'plugin.cast-sender.state.buffering': 'Bufferra kargatzen',
	'plugin.cast-sender.state.playing': '{device} gailuan erreproduzitzen',
	'plugin.cast-sender.state.paused': '{device} gailuan pausatuta',
} satisfies Record<CastSenderTranslationKey, string>;
