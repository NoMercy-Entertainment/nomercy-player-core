// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'ტრანსლაცია ამ მოწყობილობაზე მიუწვდომელია.',
	'plugin.cast-sender.connecting': '{device}-თან დაკავშირება…',
	'plugin.cast-sender.connected': 'ტრანსლაცია {device}-ზე',
	'plugin.cast-sender.disconnected': '{device}-დან გათიშულია',
	'plugin.cast-sender.error.session-failed': 'ტრანსლაციის სესიის დაწყება ვერ მოხერხდა.',
	'plugin.cast-sender.error.load-failed': 'ტრანსლაციის მოწყობილობამ უარყო მედია.',
	'plugin.cast-sender.error.generic': 'მოხდა ტრანსლაციის შეცდომა.',
	'plugin.cast-sender.action.connect': 'გადაცემა',
	'plugin.cast-sender.action.disconnect': 'ტრანსლაციის შეჩერება',
	'plugin.cast-sender.state.buffering': 'ბუფერიზაცია',
	'plugin.cast-sender.state.playing': 'უკრავს {device}-ზე',
	'plugin.cast-sender.state.paused': 'შეჩერებულია {device}-ზე',
} satisfies Record<CastSenderTranslationKey, string>;
