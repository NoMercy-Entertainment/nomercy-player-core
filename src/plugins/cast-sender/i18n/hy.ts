// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Հեռարձակումը հասանելի չէ այս սարքում:',
	'plugin.cast-sender.connecting': 'Միացում {device}-ին…',
	'plugin.cast-sender.connected': 'Հեռարձակում {device}-ին',
	'plugin.cast-sender.disconnected': '{device}-ից անջատվել է',
	'plugin.cast-sender.error.session-failed': 'Չհաջողվեց սկսել հեռարձակման սեանսը։',
	'plugin.cast-sender.error.load-failed': 'Հեռարձակման սարքը մերժեց մեդիան։',
	'plugin.cast-sender.error.generic': 'Տեղի ունեցավ հեռարձակման սխալ։',
	'plugin.cast-sender.action.connect': 'Հերարացել',
	'plugin.cast-sender.action.disconnect': 'Դադարեցնել հեռարձակումը',
	'plugin.cast-sender.state.buffering': 'Բաֆերացում',
	'plugin.cast-sender.state.playing': 'Նվագարկվում է {device}-ում',
	'plugin.cast-sender.state.paused': 'Դադարեցված է {device}-ում',
} satisfies Record<CastSenderTranslationKey, string>;
