// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'ಈ ಸಾಧನದಲ್ಲಿ ಕಾಸ್ಟಿಂಗ್ ಲಭ್ಯವಿಲ್ಲ.',
	'plugin.cast-sender.connecting': '{device} ಗೆ ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ…',
	'plugin.cast-sender.connected': '{device} ಗೆ ಕಾಸ್ಟ್ ಮಾಡಲಾಗುತ್ತಿದೆ',
	'plugin.cast-sender.disconnected': '{device} ನಿಂದ ಸಂಪರ್ಕ ಕಡಿತಗೊಂಡಿದೆ',
	'plugin.cast-sender.error.session-failed': 'ಕಾಸ್ಟ್ ಅವಧಿಯನ್ನು ಪ್ರಾರಂಭಿಸಲಾಗಲಿಲ್ಲ.',
	'plugin.cast-sender.error.load-failed': 'ಕಾಸ್ಟ್ ಸಾಧನವು ಮಾಧ್ಯಮವನ್ನು ನಿರಾಕರಿಸಿತು.',
	'plugin.cast-sender.error.generic': 'ಕಾಸ್ಟ್ ದೋಷ ಸಂಭವಿಸಿದೆ.',
	'plugin.cast-sender.action.connect': 'ಕಾಸ್ಟ್',
	'plugin.cast-sender.action.disconnect': 'ಕಾಸ್ಟ್ ನಿಲ್ಲಿಸಿ',
	'plugin.cast-sender.state.buffering': 'ಬಫರಿಂಗ್',
	'plugin.cast-sender.state.playing': '{device} ನಲ್ಲಿ ಪ್ಲೇ ಆಗುತ್ತಿದೆ',
	'plugin.cast-sender.state.paused': '{device} ನಲ್ಲಿ ವಿರಾಮಗೊಂಡಿದೆ',
} satisfies Record<CastSenderTranslationKey, string>;
