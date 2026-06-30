// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'ਇਸ ਡਿਵਾਈਸ \'ਤੇ ਕਾਸਟਿੰਗ ਉਪਲਬਧ ਨਹੀਂ ਹੈ।',
	'plugin.cast-sender.connecting': '{device} ਨਾਲ ਕਨੈਕਟ ਹੋ ਰਿਹਾ ਹੈ…',
	'plugin.cast-sender.connected': '{device} \'ਤੇ ਕਾਸਟ ਹੋ ਰਿਹਾ ਹੈ',
	'plugin.cast-sender.disconnected': '{device} ਤੋਂ ਕਨੈਕਸ਼ਨ ਟੁੱਟ ਗਿਆ',
	'plugin.cast-sender.error.session-failed': 'ਕਾਸਟ ਸੈਸ਼ਨ ਸ਼ੁਰੂ ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਿਆ।',
	'plugin.cast-sender.error.load-failed': 'ਕਾਸਟ ਡਿਵਾਈਸ ਨੇ ਮੀਡੀਆ ਅਸਵੀਕਾਰ ਕਰ ਦਿੱਤਾ।',
	'plugin.cast-sender.error.generic': 'ਇੱਕ ਕਾਸਟ ਗਲਤੀ ਆਈ।',
	'plugin.cast-sender.action.connect': 'ਕਾਸਟ',
	'plugin.cast-sender.action.disconnect': 'ਕਾਸਟ ਕਰਨਾ ਬੰਦ ਕਰੋ',
	'plugin.cast-sender.state.buffering': 'ਬਫਰਿੰਗ',
	'plugin.cast-sender.state.playing': '{device} \'ਤੇ ਚੱਲ ਰਿਹਾ ਹੈ',
	'plugin.cast-sender.state.paused': '{device} \'ਤੇ ਰੋਕਿਆ ਗਿਆ',
} satisfies Record<CastSenderTranslationKey, string>;
