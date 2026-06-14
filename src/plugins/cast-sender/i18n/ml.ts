// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'ഈ ഉപകരണത്തിൽ കാസ്റ്റിംഗ് ലഭ്യമല്ല.',
	'plugin.cast-sender.connecting': '{device} ലേക്ക് കണക്റ്റ് ചെയ്യുന്നു…',
	'plugin.cast-sender.connected': '{device} ലേക്ക് കാസ്റ്റ് ചെയ്യുന്നു',
	'plugin.cast-sender.disconnected': '{device} എന്നതിൽ നിന്ന് വിച്ഛേദിച്ചു',
	'plugin.cast-sender.error.session-failed': 'കാസ്റ്റ് സെഷൻ ആരംഭിക്കാനായില്ല.',
	'plugin.cast-sender.error.load-failed': 'കാസ്റ്റ് ഉപകരണം മീഡിയ നിരസിച്ചു.',
	'plugin.cast-sender.error.generic': 'ഒരു കാസ്റ്റ് പിശക് സംഭവിച്ചു.',
	'plugin.cast-sender.action.connect': 'കാസ്റ്റ്',
	'plugin.cast-sender.action.disconnect': 'കാസ്റ്റ് ചെയ്യുന്നത് നിർത്തുക',
	'plugin.cast-sender.state.buffering': 'ബഫറിംഗ്',
	'plugin.cast-sender.state.playing': '{device}-ൽ പ്ലേ ചെയ്യുന്നു',
	'plugin.cast-sender.state.paused': '{device}-ൽ താൽക്കാലികമായി നിർത്തി',
} satisfies Record<CastSenderTranslationKey, string>;
