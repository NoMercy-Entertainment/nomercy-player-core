// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': '이 기기에서는 캐스트를 사용할 수 없습니다.',
	'plugin.cast-sender.connecting': '{device}에 연결 중…',
	'plugin.cast-sender.connected': '{device}에 캐스트 중',
	'plugin.cast-sender.disconnected': '{device}에서 연결이 끊어졌습니다',
	'plugin.cast-sender.error.session-failed': '캐스트 세션을 시작할 수 없습니다.',
	'plugin.cast-sender.error.load-failed': '캐스트 기기가 미디어를 거부했습니다.',
	'plugin.cast-sender.error.generic': '캐스트 오류가 발생했습니다.',
	'plugin.cast-sender.action.connect': '캐스트',
	'plugin.cast-sender.action.disconnect': '캐스트 중지',
	'plugin.cast-sender.state.buffering': '버퍼링',
	'plugin.cast-sender.state.playing': '{device}에서 재생 중',
	'plugin.cast-sender.state.paused': '{device}에서 일시정지됨',
} satisfies Record<CastSenderTranslationKey, string>;
