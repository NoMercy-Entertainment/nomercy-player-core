// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'ការថតមិនមាននៅលើឧបករណ៍នេះទេ។',
	'plugin.cast-sender.connecting': 'កំពុងភ្ជាប់ទៅ {device}…',
	'plugin.cast-sender.connected': 'កំពុងថតទៅ {device}',
	'plugin.cast-sender.disconnected': 'បានផ្ដាច់ពី {device}',
	'plugin.cast-sender.error.session-failed': 'មិនអាចចាប់ផ្ដើមវគ្គបញ្ជូនបានទេ។',
	'plugin.cast-sender.error.load-failed': 'ឧបករណ៍បញ្ជូនបានបដិសេធមេឌៀ។',
	'plugin.cast-sender.error.generic': 'មានកំហុសក្នុងការបញ្ជូន។',
	'plugin.cast-sender.action.connect': 'ខាស',
	'plugin.cast-sender.action.disconnect': 'បញ្ឈប់ការបញ្ជូន',
	'plugin.cast-sender.state.buffering': 'កំពុងផ្ទុក',
	'plugin.cast-sender.state.playing': 'កំពុងចាក់នៅលើ {device}',
	'plugin.cast-sender.state.paused': 'ផ្អាកនៅលើ {device}',
} satisfies Record<CastSenderTranslationKey, string>;
