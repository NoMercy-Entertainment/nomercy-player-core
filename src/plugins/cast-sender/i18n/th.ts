// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'ไม่สามารถแคสต์บนอุปกรณ์นี้ได้',
	'plugin.cast-sender.connecting': 'กำลังเชื่อมต่อกับ {device}…',
	'plugin.cast-sender.connected': 'กำลังแคสต์ไปยัง {device}',
	'plugin.cast-sender.disconnected': 'ตัดการเชื่อมต่อจาก {device} แล้ว',
	'plugin.cast-sender.error.session-failed': 'ไม่สามารถเริ่มเซสชันการแคสต์ได้',
	'plugin.cast-sender.error.load-failed': 'อุปกรณ์แคสต์ปฏิเสธสื่อ',
	'plugin.cast-sender.error.generic': 'เกิดข้อผิดพลาดในการแคสต์',
	'plugin.cast-sender.action.connect': 'แคสต์',
	'plugin.cast-sender.action.disconnect': 'หยุดแคสต์',
	'plugin.cast-sender.state.buffering': 'กำลังบัฟเฟอร์',
	'plugin.cast-sender.state.playing': 'กำลังเล่นบน {device}',
	'plugin.cast-sender.state.paused': 'หยุดชั่วคราวบน {device}',
} satisfies Record<CastSenderTranslationKey, string>;
