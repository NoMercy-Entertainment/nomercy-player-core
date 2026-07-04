// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Uzbek core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'uz',
 *   translations: {
 *     ...defaultTranslations,
 *     uz: uzTranslations,
 *   },
 * });
 */
export const uzTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Internet ulanishi yo\'q.',
	'core.network.timeout': 'Ulanish vaqti tugadi. Qaytadan harakat…',
	'core.network.serverError': 'Serverde muammolar bor. Bir munuta ichida qaytadan urinib ko\'ring.',
	'core.network.notFound': 'Bu kontent topilmadi.',
	'core.network.rateLimited': 'Juda ko\'p so\'rovlar. Iltimos, sekinlashtiring.',

	// Auth
	'core.auth.unauthenticated': 'Sizning seansni yangilash uchun qaytadan kiriting.',
	'core.auth.forbidden': 'Sizning akkauntda bu kontentga kirish yo\'q.',
	'core.auth.refreshFailed': 'Seansni yangilash mumkin bo\'lmadi. Qaytadan kiriting.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Ijroani boshlash uchun istalgan joyni toqun yoki bosing.',
	'core.policy.userGestureRequired': 'Audiodni yoqish uchun toqun.',
	'core.policy.pipDenied': 'Rasm rasmda bu kontekstda ruxsat berilmagan.',
	'core.policy.fullscreenDenied': 'To\'liq ekran bu kontekstda ruxsat berilmagan.',
	'core.policy.wakeLockDenied': 'Ijro vaqtida ekran qorong\'i bo\'lishi mumkin.',

	// Media
	'core.media.unsupported': 'Bu format sizning brauzer tomonidan qo\'llanilmaydi.',
	'core.media.decodeFailed': 'Ijro muvaffaqiyatsiz - keyingi mavjud manba sifatida o\'tish.',
	'core.media.allDecodeFailed': 'Bu kontent uchun ijro qilish mumkin bo\'lgan manba yo\'q.',

	// DRM
	'core.drm.outputProtection': 'Sizning displeyi bu kontent uchun himoya talablarini qondirmaydi.',
	'core.drm.licenseFailed': 'Bu kontent uchun litsenziya olmali bo\'lmadi.',
	'core.drm.keySystemUnsupported': 'Sizning brauzer kerakli himoya tizimini qo\'llamaydi.',

	// State / dev
	'core.state.queueEmpty': 'Navbatda hech nima yo\'q.',
	'core.state.notReady': 'Plejyer hali tayyar emas.',

	// A11y announcements
	'core.a11y.playing': '{title} ijro etilyapti',
	'core.a11y.paused': 'To\'xtatildi',
	'core.a11y.stopped': 'Bekor qilindi',
	'core.a11y.seeking': '{time}ni qidirish',
	'core.a11y.trackChange': 'Endi {title} ijro etilyapti',
	'core.a11y.error': 'Ijro vaqtida xato yuz berdi',
	'core.a11y.muted': 'Sumsiz',
	'core.a11y.unmuted': 'Ovoz yoqilgan',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Ijro to\'xtatildi - boshqa varaq hozir ijro etilyapti.',
	'plugin.media-session.unsupported': 'Operatsion tizim media boshqaruvi bu brauzerda mavjud emas.',
};

export default uzTranslations;
