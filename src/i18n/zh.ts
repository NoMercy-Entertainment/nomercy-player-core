// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Chinese (Simplified) core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'zh',
 *   translations: {
 *     ...defaultTranslations,
 *     zh: zhTranslations,
 *   },
 * });
 */
export const zhTranslations: Record<string, string> = {
	// Network
	'core.network.offline': '没有互联网连接。',
	'core.network.timeout': '连接超时。重试…',
	'core.network.serverError': '服务器出现问题。请稍候再试。',
	'core.network.notFound': '找不到该内容。',
	'core.network.rateLimited': '请求过多。请减速。',

	// Auth
	'core.auth.unauthenticated': '请重新登录以刷新您的会话。',
	'core.auth.forbidden': '您的帐户无权访问此内容。',
	'core.auth.refreshFailed': '无法刷新您的会话。请重新登录。',

	// Browser policy
	'core.policy.autoplayBlocked': '点击或轻触任意位置即可开始播放。',
	'core.policy.userGestureRequired': '轻触以启用音频。',
	'core.policy.pipDenied': '此上下文中不允许画中画。',
	'core.policy.fullscreenDenied': '此上下文中不允许全屏。',
	'core.policy.wakeLockDenied': '播放时屏幕可能会变暗。',

	// Media
	'core.media.unsupported': '您的浏览器不支持此格式。',
	'core.media.decodeFailed': '播放失败 — 切换到下一个可用的来源。',
	'core.media.allDecodeFailed': '此内容没有可播放的来源。',

	// DRM
	'core.drm.outputProtection': '您的显示器不符合此内容的保护要求。',
	'core.drm.licenseFailed': '无法获得此内容的许可证。',
	'core.drm.keySystemUnsupported': '您的浏览器不支持所需的保护系统。',

	// State / dev
	'core.state.queueEmpty': '队列中没有内容。',
	'core.state.notReady': '播放器尚未就绪。',

	// A11y announcements
	'core.a11y.playing': '播放 {title}',
	'core.a11y.paused': '已暂停',
	'core.a11y.stopped': '已停止',
	'core.a11y.seeking': '寻求 {time}',
	'core.a11y.trackChange': '现在播放 {title}',
	'core.a11y.error': '播放过程中出错',
	'core.a11y.muted': '已静音',
	'core.a11y.unmuted': '音频已启用',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': '播放已暂停 — 另一个选项卡现在正在播放。',
	'plugin.media-session.unsupported': '此浏览器中不提供操作系统媒体控件。',
};

export default zhTranslations;
