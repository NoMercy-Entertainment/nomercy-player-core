// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'ການສົ່ງບໍ່ມີຢູ່ໃນອຸປະກອນນີ້.',
	'plugin.cast-sender.connecting': 'ກຳລັງເຊື່ອມຕໍ່ກັບ {device}…',
	'plugin.cast-sender.connected': 'ກຳລັງສົ່ງໄປຍັງ {device}',
	'plugin.cast-sender.disconnected': 'ຕັດການເຊື່ອມຕໍ່ຈາກ {device}',
	'plugin.cast-sender.error.session-failed': 'ບໍ່ສາມາດເລີ່ມເຊດຊັນການສົ່ງສັນຍານໄດ້.',
	'plugin.cast-sender.error.load-failed': 'ອຸປະກອນສົ່ງສັນຍານໄດ້ປະຕິເສດສື່.',
	'plugin.cast-sender.error.generic': 'ເກີດຂໍ້ຜິດພາດໃນການສົ່ງສັນຍານ.',
	'plugin.cast-sender.action.connect': 'ສົ່ງຫາໜ້າຈໍ',
	'plugin.cast-sender.action.disconnect': 'ຢຸດການສົ່ງສັນຍານ',
	'plugin.cast-sender.state.buffering': 'ກຳລັງໂຫຼດ',
	'plugin.cast-sender.state.playing': 'ກຳລັງຫຼິ້ນຢູ່ {device}',
	'plugin.cast-sender.state.paused': 'ຢຸດຊົ່ວຄາວຢູ່ {device}',
} satisfies Record<CastSenderTranslationKey, string>;
