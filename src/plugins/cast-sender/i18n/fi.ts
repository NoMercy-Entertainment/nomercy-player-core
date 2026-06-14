// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Lähetys ei ole käytettävissä tällä laitteella.',
	'plugin.cast-sender.connecting': 'Yhdistetään laitteeseen {device}…',
	'plugin.cast-sender.connected': 'Lähetetään laitteeseen {device}',
	'plugin.cast-sender.disconnected': 'Yhteys laitteeseen {device} katkaistu',
	'plugin.cast-sender.error.session-failed': 'Suoratoistoistuntoa ei voitu aloittaa.',
	'plugin.cast-sender.error.load-failed': 'Suoratoistolaite hylkäsi median.',
	'plugin.cast-sender.error.generic': 'Tapahtui suoratoistovirhe.',
	'plugin.cast-sender.action.connect': 'Toista laitteella',
	'plugin.cast-sender.action.disconnect': 'Lopeta suoratoisto',
	'plugin.cast-sender.state.buffering': 'Puskuroidaan',
	'plugin.cast-sender.state.playing': 'Toistetaan laitteella {device}',
	'plugin.cast-sender.state.paused': 'Keskeytetty laitteella {device}',
} satisfies Record<CastSenderTranslationKey, string>;
