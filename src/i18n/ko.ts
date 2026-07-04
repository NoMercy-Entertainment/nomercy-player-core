// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Korean core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ko',
 *   translations: {
 *     ...defaultTranslations,
 *     ko: koTranslations,
 *   },
 * });
 */
export const koTranslations: Record<string, string> = {
	// Network
	'core.network.offline': '인터넷 연결이 없습니다.',
	'core.network.timeout': '연결 시간 초과. 다시 시도 중…',
	'core.network.serverError': '서버에 문제가 있습니다. 잠시 후 다시 시도하세요.',
	'core.network.notFound': '해당 콘텐츠를 찾을 수 없습니다.',
	'core.network.rateLimited': '요청이 너무 많습니다. 속도를 낮추세요.',

	// Auth
	'core.auth.unauthenticated': '세션을 새로 고치려면 다시 로그인하세요.',
	'core.auth.forbidden': '계정이 이 콘텐츠에 액세스할 수 없습니다.',
	'core.auth.refreshFailed': '세션을 새로 고칠 수 없습니다. 다시 로그인하세요.',

	// Browser policy
	'core.policy.autoplayBlocked': '재생을 시작하려면 아무데나 탭하거나 클릭하세요.',
	'core.policy.userGestureRequired': '오디오를 활성화하려면 탭하세요.',
	'core.policy.pipDenied': '이 컨텍스트에서는 화면 속 화면이 허용되지 않습니다.',
	'core.policy.fullscreenDenied': '이 컨텍스트에서는 전체 화면이 허용되지 않습니다.',
	'core.policy.wakeLockDenied': '재생 중에 화면이 어두워질 수 있습니다.',

	// Media
	'core.media.unsupported': '브라우저가 이 형식을 지원하지 않습니다.',
	'core.media.decodeFailed': '재생 실패 — 다음 사용 가능한 소스로 전환 중입니다.',
	'core.media.allDecodeFailed': '이 콘텐츠에 사용 가능한 재생 가능한 소스가 없습니다.',

	// DRM
	'core.drm.outputProtection': '디스플레이가 이 콘텐츠의 보호 요구 사항을 충족하지 않습니다.',
	'core.drm.licenseFailed': '이 콘텐츠에 대한 라이선스를 얻을 수 없습니다.',
	'core.drm.keySystemUnsupported': '브라우저가 필요한 보호 시스템을 지원하지 않습니다.',

	// State / dev
	'core.state.queueEmpty': '큐에 아무것도 없습니다.',
	'core.state.notReady': '플레이어가 아직 준비되지 않았습니다.',

	// A11y announcements
	'core.a11y.playing': '{title} 재생 중',
	'core.a11y.paused': '일시 중지됨',
	'core.a11y.stopped': '중지됨',
	'core.a11y.seeking': '{time}으로 검색 중',
	'core.a11y.trackChange': '현재 {title} 재생 중',
	'core.a11y.error': '재생 중 오류가 발생했습니다',
	'core.a11y.muted': '음소거',
	'core.a11y.unmuted': '음소거 해제',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': '재생이 일시 중지됨 — 다른 탭이 지금 재생 중입니다.',
	'plugin.media-session.unsupported': 'OS 미디어 컨트롤을 이 브라우저에서 사용할 수 없습니다.',
};

export default koTranslations;
