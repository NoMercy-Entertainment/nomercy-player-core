// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Vietnamese core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'vi',
 *   translations: {
 *     ...defaultTranslations,
 *     vi: viTranslations,
 *   },
 * });
 */
export const viTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Không có kết nối Internet.',
	'core.network.timeout': 'Kết nối hết thời gian chờ. Đang thử lại…',
	'core.network.serverError': 'Máy chủ có sự cố. Vui lòng thử lại trong giây lát.',
	'core.network.notFound': 'Không tìm thấy nội dung đó.',
	'core.network.rateLimited': 'Quá nhiều yêu cầu. Vui lòng chậm lại.',

	// Auth
	'core.auth.unauthenticated': 'Đăng nhập lại để làm mới phiên của bạn.',
	'core.auth.forbidden': 'Tài khoản của bạn không có quyền truy cập vào nội dung này.',
	'core.auth.refreshFailed': 'Không thể làm mới phiên của bạn. Đăng nhập lại.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Chạm hoặc nhấp bất kỳ vị trí nào để bắt đầu phát lại.',
	'core.policy.userGestureRequired': 'Chạm để bật âm thanh.',
	'core.policy.pipDenied': 'Hình ảnh trong hình ảnh không được phép trong bối cảnh này.',
	'core.policy.fullscreenDenied': 'Toàn màn hình không được phép trong bối cảnh này.',
	'core.policy.wakeLockDenied': 'Màn hình có thể tắt trong quá trình phát lại.',

	// Media
	'core.media.unsupported': 'Trình duyệt của bạn không hỗ trợ định dạng này.',
	'core.media.decodeFailed': 'Phát lại không thành công — chuyển sang nguồn khả dụng tiếp theo.',
	'core.media.allDecodeFailed': 'Không có nguồn phát lại nào có sẵn cho nội dung này.',

	// DRM
	'core.drm.outputProtection': 'Màn hình của bạn không đáp ứng các yêu cầu bảo vệ cho nội dung này.',
	'core.drm.licenseFailed': 'Không thể nhận giấy phép cho nội dung này.',
	'core.drm.keySystemUnsupported': 'Trình duyệt của bạn không hỗ trợ hệ thống bảo vệ bắt buộc.',

	// State / dev
	'core.state.queueEmpty': 'Không có gì trong hàng đợi.',
	'core.state.notReady': 'Trình phát chưa sẵn sàng.',

	// A11y announcements
	'core.a11y.playing': 'Đang phát {title}',
	'core.a11y.paused': 'Tạm dừng',
	'core.a11y.stopped': 'Đã dừng',
	'core.a11y.seeking': 'Tìm kiếm {time}',
	'core.a11y.trackChange': 'Đang phát {title}',
	'core.a11y.error': 'Đã xảy ra lỗi trong quá trình phát lại',
	'core.a11y.muted': 'Tắt tiếng',
	'core.a11y.unmuted': 'Bật âm thanh',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Phát lại tạm dừng — tab khác đang phát ngay bây giờ.',
	'plugin.media-session.unsupported': 'Điều khiển phương tiện OS không available trong trình duyệt này.',
};

export default viTranslations;
