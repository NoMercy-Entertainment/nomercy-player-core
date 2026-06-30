// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'このデバイスではキャストを利用できません。',
	'plugin.cast-sender.connecting': '{device} に接続中…',
	'plugin.cast-sender.connected': '{device} にキャスト中',
	'plugin.cast-sender.disconnected': '{device} から切断されました',
	'plugin.cast-sender.error.session-failed': 'キャストセッションを開始できませんでした。',
	'plugin.cast-sender.error.load-failed': 'キャストデバイスがメディアを拒否しました。',
	'plugin.cast-sender.error.generic': 'キャストエラーが発生しました。',
	'plugin.cast-sender.action.connect': 'キャスト',
	'plugin.cast-sender.action.disconnect': 'キャストを停止',
	'plugin.cast-sender.state.buffering': 'バッファリング中',
	'plugin.cast-sender.state.playing': '{device} で再生中',
	'plugin.cast-sender.state.paused': '{device} で一時停止中',
} satisfies Record<CastSenderTranslationKey, string>;
