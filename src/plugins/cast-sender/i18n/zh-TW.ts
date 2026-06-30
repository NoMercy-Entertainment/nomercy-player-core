// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': '此裝置不支援投放。',
	'plugin.cast-sender.connecting': '正在連線到 {device}…',
	'plugin.cast-sender.connected': '正在投放到 {device}',
	'plugin.cast-sender.disconnected': '已中斷與 {device} 的連線',
	'plugin.cast-sender.error.session-failed': '無法啟動投放工作階段。',
	'plugin.cast-sender.error.load-failed': '投放裝置拒絕了該媒體。',
	'plugin.cast-sender.error.generic': '發生投放錯誤。',
	'plugin.cast-sender.action.connect': '投放',
	'plugin.cast-sender.action.disconnect': '停止投放',
	'plugin.cast-sender.state.buffering': '緩衝中',
	'plugin.cast-sender.state.playing': '正在 {device} 上播放',
	'plugin.cast-sender.state.paused': '已在 {device} 上暫停',
} satisfies Record<CastSenderTranslationKey, string>;
