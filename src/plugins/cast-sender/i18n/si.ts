// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'මෙම උපාංගයේ විකාශනය ලබා ගත නොහැක.',
	'plugin.cast-sender.connecting': '{device} වෙත සම්බන්ධ වෙමින්…',
	'plugin.cast-sender.connected': '{device} වෙත විකාශනය වෙමින්',
	'plugin.cast-sender.disconnected': '{device} වෙතින් විසන්ධි විය',
	'plugin.cast-sender.error.session-failed': 'කාස්ට් සැසිය ආරම්භ කළ නොහැකි විය.',
	'plugin.cast-sender.error.load-failed': 'කාස්ට් උපාංගය මාධ්‍ය ප්‍රතික්ෂේප කළේය.',
	'plugin.cast-sender.error.generic': 'කාස්ට් දෝෂයක් සිදු විය.',
	'plugin.cast-sender.action.connect': 'විකාශනය',
	'plugin.cast-sender.action.disconnect': 'කාස්ට් කිරීම නවත්වන්න',
	'plugin.cast-sender.state.buffering': 'බෆරනය',
	'plugin.cast-sender.state.playing': '{device} මත වාදනය වෙමින්',
	'plugin.cast-sender.state.paused': '{device} මත විරාම කර ඇත',
} satisfies Record<CastSenderTranslationKey, string>;
