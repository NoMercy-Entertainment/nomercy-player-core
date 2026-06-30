// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': '此设备不支持投放。',
	'plugin.cast-sender.connecting': '正在连接到 {device}…',
	'plugin.cast-sender.connected': '正在投放到 {device}',
	'plugin.cast-sender.disconnected': '已断开与 {device} 的连接',
	'plugin.cast-sender.error.session-failed': '无法启动投放会话。',
	'plugin.cast-sender.error.load-failed': '投放设备拒绝了该媒体。',
	'plugin.cast-sender.error.generic': '发生投放错误。',
	'plugin.cast-sender.action.connect': '投屏',
	'plugin.cast-sender.action.disconnect': '停止投放',
	'plugin.cast-sender.state.buffering': '缓冲中',
	'plugin.cast-sender.state.playing': '正在 {device} 上播放',
	'plugin.cast-sender.state.paused': '已在 {device} 上暂停',
} satisfies Record<CastSenderTranslationKey, string>;
