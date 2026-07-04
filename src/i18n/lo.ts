// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Lao core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'lo',
 *   translations: {
 *     ...defaultTranslations,
 *     lo: loTranslations,
 *   },
 * });
 */
export const loTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'ບໍ່ມີການເຊື່ອມຕໍ່ອິນເຕີເນັດ.',
	'core.network.timeout': 'ການເຊື່ອມຕໍ່ຫมົດອາຍຸ. ກຳລັງລອງໃຫມ່…',
	'core.network.serverError': 'ເຊີບເວີມີບັນຫາ. ລອງໃຫມ່ເປັນເວລາໜ້ອຍ.',
	'core.network.notFound': 'ບໍ່ພົບເນື້ອຫາດັ່ງກ່າວ.',
	'core.network.rateLimited': 'ຮ້ອງຂໍຫຼາຍເກີນໄປ. ກະລຸນາຊ້າລົງ.',

	// Auth
	'core.auth.unauthenticated': 'ເຂົ້າສູ່ລະບົບຄືນໃໝ່ເພື່ອຣີເຟຣຊເຊສຊັນຂອງທ່ານ.',
	'core.auth.forbidden': 'ບັນຊີຂອງທ່ານບໍ່ມີສິດເຂົ້າເຖິງເນື້ອຫານີ້.',
	'core.auth.refreshFailed': 'ບໍ່ສາມາດຣີເຟຣຊເຊສຊັນຂອງທ່ານໄດ້. ເຂົ້າສູ່ລະບົບຄືນໃໝ່.',

	// Browser policy
	'core.policy.autoplayBlocked': 'ແຕະ ຫຼື ຄລິກຢູ່ໃດກໍ່ໄດ້ເພື່ອເລີ່ມຕົ້ນການຫລິ້ນ.',
	'core.policy.userGestureRequired': 'ແຕະເພື່ອເປີດໃຊ້ສຽງ.',
	'core.policy.pipDenied': 'ຮູບໃນຮູບບໍ່ຖືກອະນຸຍາດໃນສະພາບແວດລ້ອມນີ້.',
	'core.policy.fullscreenDenied': 'ເต็ມໜ້າຈໍບໍ່ຖືກອະນຸຍາດໃນສະພາບແວດລ້ອມນີ້.',
	'core.policy.wakeLockDenied': 'ໜ້າຈໍອາດມືດລົງໃນລະຫວ່າງການຫລິ້ນ.',

	// Media
	'core.media.unsupported': 'ຮູບແບບນີ້ບໍ່ຖືກສະຫນັບສະຫນູນໂດຍບຣາວເຊີຂອງທ່ານ.',
	'core.media.decodeFailed': 'ການຫລິ້ນລົ້ມເຫລວ — ກະเພາະສະພາບຕໍ່ໄປທີ່ມີຢູ່.',
	'core.media.allDecodeFailed': 'ບໍ່ມີແຫຼ່ງທີ່ຫລິ້ນໄດ້ສໍາລັບເນື້ອຫາເນື້ອນີ້.',

	// DRM
	'core.drm.outputProtection': 'ຈໍສະສະແຫຼງຂອງທ່ານບໍ່ຕອບສະຫນອງຄວາມຕ້ອງການການປົກປ້ອງສໍາລັບເນື້ອຫາເນື້ອນີ້.',
	'core.drm.licenseFailed': 'ບໍ່ສາມາດໄດ້ໃບອະນຸຍາດສໍາລັບເນື້ອຫາເນື້ອນີ້.',
	'core.drm.keySystemUnsupported': 'ບຣາວເຊີຂອງທ່ານບໍ່ສະຫນັບສະຫນູນລະບົບການປົກປ້ອງທີ່ຕ້ອງການ.',

	// State / dev
	'core.state.queueEmpty': 'ບໍ່ມີຫຍັງໃນຄິວ.',
	'core.state.notReady': 'ຜູ້ຫລິ້ນຍັງບໍ່ພ້ອມ.',

	// A11y announcements
	'core.a11y.playing': 'ກຳລັງຫລິ້ນ {title}',
	'core.a11y.paused': 'ชั່วชี่',
	'core.a11y.stopped': '停止',
	'core.a11y.seeking': 'ກຳລັງຊອກຫາ {time}',
	'core.a11y.trackChange': 'ຕອນນີ້ກຳລັງຫລິ້ນ {title}',
	'core.a11y.error': 'ມີຂໍ້ຜິດພາດເກີດຂື້ນໃນລະຫວ່າງການຫລິ້ນ',
	'core.a11y.muted': 'ສະກັດສຽງ',
	'core.a11y.unmuted': 'ສຽງເປີດ',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'ການຫລິ້ນได້ຢຸດຊั່ວຄາວ — ແຖບອື່ນຕອນນີ້ກຳລັງຫລິ້ນ.',
	'plugin.media-session.unsupported': 'ການຄວບຄຸມສື່ OS ບໍ່ສາມາດໃຊ້ໄດ້ໃນບຣາວເຊີນີ້.',
};

export default loTranslations;
