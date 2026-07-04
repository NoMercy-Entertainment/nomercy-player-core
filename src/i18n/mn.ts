// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Mongolian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'mn',
 *   translations: {
 *     ...defaultTranslations,
 *     mn: mnTranslations,
 *   },
 * });
 */
export const mnTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Интернет холболт байхгүй.',
	'core.network.timeout': 'Холболт хугацаа дуусчээ. Дахин оролдоож байна…',
	'core.network.serverError': 'Сервер асуудалтай байна. Хэл хугацаанд дахин оролдоно уу.',
	'core.network.notFound': 'Энэ контент олдсонгүй.',
	'core.network.rateLimited': 'Хэт олон хүсэлт. Сайн сайхан удаашруул.',

	// Auth
	'core.auth.unauthenticated': 'Сеансеа шинэчлэхийн тулд дахин нэвтрэн орно уу.',
	'core.auth.forbidden': 'Таны дансанд энэ контентт хандах хүсэлт байхгүй.',
	'core.auth.refreshFailed': 'Таны сеансеа шинэчлэх боломжгүй байна. Дахин нэвтрэн орно уу.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Тоглуулалтыг эхлүүлэхийн тулд хаа нэгтээ цохино эсвэл дарна уу.',
	'core.policy.userGestureRequired': 'Дуусыг идэвхжүүлэхийн тулд цохино.',
	'core.policy.pipDenied': 'Энэ контекстт зураг-дотор-зураг зөвшөөрөгдөхгүй.',
	'core.policy.fullscreenDenied': 'Энэ контекстт бүтэн дэлгэц зөвшөөрөгдөхгүй.',
	'core.policy.wakeLockDenied': 'Тоглуулалтын үеэр дэлгэц идэвхгүй болох магадлалтай.',

	// Media
	'core.media.unsupported': 'Энэ формат таны браузер дээр дэмжигдэхгүй.',
	'core.media.decodeFailed': 'Тоглуулалт амжилтгүй болсон — дараагийн боломжит эх сурвалж руу шилжүүлж байна.',
	'core.media.allDecodeFailed': 'Энэ контентт тоглуулах боломжтой эх сурвалж байхгүй.',

	// DRM
	'core.drm.outputProtection': 'Таны дэлгэц энэ контентт хамгаалалтын шаардлага хангаж байхгүй.',
	'core.drm.licenseFailed': 'Энэ контентт лицензи авах боломжгүй байсан.',
	'core.drm.keySystemUnsupported': 'Таны браузер шаардлагатай хамгаалалтын систем дэмжихгүй.',

	// State / dev
	'core.state.queueEmpty': 'Дараалалд юу ч байхгүй.',
	'core.state.notReady': 'Плеер өмнөх боловч бэлэн биш.',

	// A11y announcements
	'core.a11y.playing': '{title} тоглуулж байна',
	'core.a11y.paused': 'Түр停止',
	'core.a11y.stopped': 'Зогсоосон',
	'core.a11y.seeking': '{time} руу хайж байна',
	'core.a11y.trackChange': 'Одоо {title} тоглуулж байна',
	'core.a11y.error': 'Тоглуулалтын үеэр алдаа гарсан',
	'core.a11y.muted': 'Чимээгүй',
	'core.a11y.unmuted': 'Дуу асаалттай',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Тоглуулалт түр зөгсөгдсөн — өөр таб одоо тоглуулж байна.',
	'plugin.media-session.unsupported': 'ОС мултимедиа хянагч энэ браузер дээр боломжтой биш.',
};

export default mnTranslations;
