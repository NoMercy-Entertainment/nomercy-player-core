// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Tính năng truyền không khả dụng trên thiết bị này.',
	'plugin.cast-sender.connecting': 'Đang kết nối với {device}…',
	'plugin.cast-sender.connected': 'Đang truyền tới {device}',
	'plugin.cast-sender.disconnected': 'Đã ngắt kết nối khỏi {device}',
	'plugin.cast-sender.error.session-failed': 'Không thể bắt đầu phiên truyền.',
	'plugin.cast-sender.error.load-failed': 'Thiết bị truyền đã từ chối nội dung.',
	'plugin.cast-sender.error.generic': 'Đã xảy ra lỗi truyền.',
	'plugin.cast-sender.action.connect': 'Phát trực tiếp',
	'plugin.cast-sender.action.disconnect': 'Dừng truyền',
	'plugin.cast-sender.state.buffering': 'Đang tải bộ đệm',
	'plugin.cast-sender.state.playing': 'Đang phát trên {device}',
	'plugin.cast-sender.state.paused': 'Đã tạm dừng trên {device}',
} satisfies Record<CastSenderTranslationKey, string>;
