// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Η μετάδοση δεν είναι διαθέσιμη σε αυτή τη συσκευή.',
	'plugin.cast-sender.connecting': 'Σύνδεση με {device}…',
	'plugin.cast-sender.connected': 'Μετάδοση σε {device}',
	'plugin.cast-sender.disconnected': 'Αποσυνδέθηκε από {device}',
	'plugin.cast-sender.error.session-failed': 'Δεν ήταν δυνατή η έναρξη της μετάδοσης.',
	'plugin.cast-sender.error.load-failed': 'Η συσκευή μετάδοσης απέρριψε το πολυμέσο.',
	'plugin.cast-sender.error.generic': 'Παρουσιάστηκε σφάλμα μετάδοσης.',
	'plugin.cast-sender.action.connect': 'Προβολή σε τηλεόραση',
	'plugin.cast-sender.action.disconnect': 'Διακοπή μετάδοσης',
	'plugin.cast-sender.state.buffering': 'Αποθήκευση στη μνήμη',
	'plugin.cast-sender.state.playing': 'Αναπαραγωγή σε {device}',
	'plugin.cast-sender.state.paused': 'Σε παύση στο {device}',
} satisfies Record<CastSenderTranslationKey, string>;
