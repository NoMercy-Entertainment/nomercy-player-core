// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Chinese (Traditional) core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'zh-TW',
 *   translations: {
 *     ...defaultTranslations,
 *     zh-TW: zhTwTranslations,
 *   },
 * });
 */
export const zhTwTranslations: Record<string, string> = {
	// Network
	'core.network.offline': '沒有網際網路連線。',
	'core.network.timeout': '連線逾時。正在重試…',
	'core.network.serverError': '伺服器出現問題。請稍候再試。',
	'core.network.notFound': '找不到該內容。',
	'core.network.rateLimited': '請求過多。請減速。',

	// Auth
	'core.auth.unauthenticated': '請重新登入以重新整理您的工作階段。',
	'core.auth.forbidden': '您的帳戶無權存取此內容。',
	'core.auth.refreshFailed': '無法重新整理您的工作階段。請重新登入。',

	// Browser policy
	'core.policy.autoplayBlocked': '按一下或輕觸任意位置即可開始播放。',
	'core.policy.userGestureRequired': '輕觸以啟用音訊。',
	'core.policy.pipDenied': '此內容中不允許使用子母畫面。',
	'core.policy.fullscreenDenied': '此內容中不允許全螢幕。',
	'core.policy.wakeLockDenied': '播放時螢幕可能會變暗。',

	// Media
	'core.media.unsupported': '您的瀏覽器不支援此格式。',
	'core.media.decodeFailed': '播放失敗 — 切換到下一個可用的來源。',
	'core.media.allDecodeFailed': '此內容沒有可播放的來源。',

	// DRM
	'core.drm.outputProtection': '您的顯示器不符合此內容的保護要求。',
	'core.drm.licenseFailed': '無法取得此內容的授權。',
	'core.drm.keySystemUnsupported': '您的瀏覽器不支援所需的保護系統。',

	// State / dev
	'core.state.queueEmpty': '佇列中沒有項目。',
	'core.state.notReady': '播放器尚未就緒。',

	// A11y announcements
	'core.a11y.playing': '播放 {title}',
	'core.a11y.paused': '已暫停',
	'core.a11y.stopped': '已停止',
	'core.a11y.seeking': '尋求 {time}',
	'core.a11y.trackChange': '現在播放 {title}',
	'core.a11y.error': '播放期間發生錯誤',
	'core.a11y.muted': '已靜音',
	'core.a11y.unmuted': '音訊已啟用',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': '播放已暫停 — 另一個標籤現在正在播放。',
	'plugin.media-session.unsupported': '此瀏覽器中無法使用作業系統媒體控制。',
};

export default zhTwTranslations;
