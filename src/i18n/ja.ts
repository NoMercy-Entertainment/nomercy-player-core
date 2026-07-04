// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Japanese core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ja',
 *   translations: {
 *     ...defaultTranslations,
 *     ja: jaTranslations,
 *   },
 * });
 */
export const jaTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'インターネット接続がありません。',
	'core.network.timeout': '接続がタイムアウトしました。再試行中…',
	'core.network.serverError': 'サーバーに問題があります。しばらくしてからもう一度お試しください。',
	'core.network.notFound': 'そのコンテンツが見つかりません。',
	'core.network.rateLimited': 'リクエストが多すぎます。スローダウンしてください。',

	// Auth
	'core.auth.unauthenticated': 'セッションを更新するために再度サインインしてください。',
	'core.auth.forbidden': 'アカウントにこのコンテンツへのアクセス権がありません。',
	'core.auth.refreshFailed': 'セッションを更新できませんでした。再度サインインしてください。',

	// Browser policy
	'core.policy.autoplayBlocked': '再生を開始するには、どこかをタップまたはクリックしてください。',
	'core.policy.userGestureRequired': 'タップして音声を有効にします。',
	'core.policy.pipDenied': 'このコンテキストでは、ピクチャインピクチャは許可されていません。',
	'core.policy.fullscreenDenied': 'このコンテキストではフルスクリーンは許可されていません。',
	'core.policy.wakeLockDenied': '再生中に画面が暗くなる可能性があります。',

	// Media
	'core.media.unsupported': 'この形式はブラウザでサポートされていません。',
	'core.media.decodeFailed': '再生に失敗しました — 次の利用可能なソースに切り替わります。',
	'core.media.allDecodeFailed': 'このコンテンツの再生可能ソースはありません。',

	// DRM
	'core.drm.outputProtection': 'ディスプレイはこのコンテンツの保護要件を満たしていません。',
	'core.drm.licenseFailed': 'このコンテンツのライセンスを取得できませんでした。',
	'core.drm.keySystemUnsupported': 'ブラウザは必要な保護システムをサポートしていません。',

	// State / dev
	'core.state.queueEmpty': 'キューには何もありません。',
	'core.state.notReady': 'プレーヤーはまだ準備ができていません。',

	// A11y announcements
	'core.a11y.playing': '{title}を再生中',
	'core.a11y.paused': '一時停止',
	'core.a11y.stopped': '停止',
	'core.a11y.seeking': '{time}をシーク中',
	'core.a11y.trackChange': '現在{title}を再生中',
	'core.a11y.error': '再生中にエラーが発生しました',
	'core.a11y.muted': 'ミュート',
	'core.a11y.unmuted': 'ミュート解除',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': '再生が一時停止されました — 別のタブが再生されています。',
	'plugin.media-session.unsupported': 'OSメディアコントロールはこのブラウザで利用できません。',
};

export default jaTranslations;
