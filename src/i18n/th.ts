// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Thai core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'th',
 *   translations: {
 *     ...defaultTranslations,
 *     th: thTranslations,
 *   },
 * });
 */
export const thTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต',
	'core.network.timeout': 'หมดเวลาการเชื่อมต่อ กำลังลองใหม่…',
	'core.network.serverError': 'เซิร์ฟเวอร์มีปัญหา ลองใหม่ในไม่ช่วงนี้',
	'core.network.notFound': 'ไม่พบเนื้อหานั้น',
	'core.network.rateLimited': 'คำขอมากเกินไป โปรดช้าลง',

	// Auth
	'core.auth.unauthenticated': 'เข้าสู่ระบบอีกครั้งเพื่อรีเฟรชเซสชัน',
	'core.auth.forbidden': 'บัญชีของคุณไม่มีสิทธิ์เข้าถึงเนื้อหานี้',
	'core.auth.refreshFailed': 'ไม่สามารถรีเฟรชเซสชันของคุณ เข้าสู่ระบบอีกครั้ง',

	// Browser policy
	'core.policy.autoplayBlocked': 'แตะหรือคลิกที่ใดก็ได้เพื่อเริ่มการเล่น',
	'core.policy.userGestureRequired': 'แตะเพื่อเปิดใช้เสียง',
	'core.policy.pipDenied': 'ไม่อนุญาตให้ใช้รูปภาพในรูปภาพในบริบทนี้',
	'core.policy.fullscreenDenied': 'ไม่อนุญาตให้ใช้เต็มหน้าจออบ',
	'core.policy.wakeLockDenied': 'หน้าจออาจมืดลงในระหว่างการเล่น',

	// Media
	'core.media.unsupported': 'เบราว์เซอร์ของคุณไม่รองรับรูปแบบนี้',
	'core.media.decodeFailed': 'การเล่นล้มเหลว — การสลับไปยังแหล่งที่มาถัดไป',
	'core.media.allDecodeFailed': 'ไม่มีแหล่งที่มาสำหรับการเล่นที่ใช้ได้สำหรับเนื้อหานี้',

	// DRM
	'core.drm.outputProtection': 'จอแสดงผลของคุณไม่เป็นไปตามข้อกำหนดการป้องกันสำหรับเนื้อหานี้',
	'core.drm.licenseFailed': 'ไม่สามารถรับใบอนุญาตสำหรับเนื้อหานี้',
	'core.drm.keySystemUnsupported': 'เบราว์เซอร์ของคุณไม่รองรับระบบการป้องกันที่จำเป็น',

	// State / dev
	'core.state.queueEmpty': 'ไม่มีอะไรในคิว',
	'core.state.notReady': 'ผู้เล่นยังไม่พร้อม',

	// A11y announcements
	'core.a11y.playing': 'เล่น {title}',
	'core.a11y.paused': 'หยุดชั่วคราว',
	'core.a11y.stopped': 'หยุด',
	'core.a11y.seeking': 'ค้นหา {time}',
	'core.a11y.trackChange': 'เล่น {title} ในขณะนี้',
	'core.a11y.error': 'เกิดข้อผิดพลาดระหว่างการเล่น',
	'core.a11y.muted': 'ปิดเสียง',
	'core.a11y.unmuted': 'เสียงเปิด',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'การเล่นหยุดชั่วคราว — แท็บอื่นเล่นในขณะนี้',
	'plugin.media-session.unsupported': 'ควบคุมสื่อ OS ไม่พร้อมใช้งานในเบราว์เซอร์นี้',
};

export default thTranslations;
