// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'העברה אינה זמינה במכשיר זה.',
	'plugin.cast-sender.connecting': 'מתחבר אל {device}…',
	'plugin.cast-sender.connected': 'מעביר אל {device}',
	'plugin.cast-sender.disconnected': 'החיבור אל {device} נותק',
	'plugin.cast-sender.error.session-failed': 'לא ניתן היה להתחיל את הפעלת ההזרמה.',
	'plugin.cast-sender.error.load-failed': 'מכשיר ההזרמה דחה את המדיה.',
	'plugin.cast-sender.error.generic': 'אירעה שגיאת הזרמה.',
	'plugin.cast-sender.action.connect': 'שידור',
	'plugin.cast-sender.action.disconnect': 'הפסקת ההזרמה',
	'plugin.cast-sender.state.buffering': 'טוען למאגר',
	'plugin.cast-sender.state.playing': 'מתנגן ב-{device}',
	'plugin.cast-sender.state.paused': 'מושהה ב-{device}',
} satisfies Record<CastSenderTranslationKey, string>;
