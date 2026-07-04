// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Turkish core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'tr',
 *   translations: {
 *     ...defaultTranslations,
 *     tr: trTranslations,
 *   },
 * });
 */
export const trTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'İnternet bağlantısı yok.',
	'core.network.timeout': 'Bağlantı zaman aşımına uğradı. Yeniden deniyor…',
	'core.network.serverError': 'Sunucunun sorunları var. Biraz sonra yeniden deneyin.',
	'core.network.notFound': 'Bu içerik bulunamadı.',
	'core.network.rateLimited': 'Çok fazla istek. Lütfen yavaşlayın.',

	// Auth
	'core.auth.unauthenticated': 'Oturumunuzu yenilemek için yeniden oturum açın.',
	'core.auth.forbidden': 'Hesabınız bu içeriğe erişim izni yoktur.',
	'core.auth.refreshFailed': 'Oturumunuz yenilenemedi. Yeniden oturum açın.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Oynatmayı başlatmak için herhangi bir yere dokunun veya tıklayın.',
	'core.policy.userGestureRequired': 'Sesi etkinleştirmek için dokunun.',
	'core.policy.pipDenied': 'Bu bağlamda resim içinde resim izin verilmiyor.',
	'core.policy.fullscreenDenied': 'Bu bağlamda tam ekran izin verilmiyor.',
	'core.policy.wakeLockDenied': 'Oynatma sırasında ekran kararabilir.',

	// Media
	'core.media.unsupported': 'Bu biçim tarayıcınız tarafından desteklenmiyor.',
	'core.media.decodeFailed': 'Oynatma başarısız oldu — sonraki kullanılabilir kaynağa geçiliyor.',
	'core.media.allDecodeFailed': 'Bu içerik için oynatılabilir kaynak yok.',

	// DRM
	'core.drm.outputProtection': 'Ekranınız bu içerik için koruma gereksinimlerini karşılamıyor.',
	'core.drm.licenseFailed': 'Bu içerik için lisans alınamadı.',
	'core.drm.keySystemUnsupported': 'Tarayıcınız gerekli koruma sistemini desteklemiyor.',

	// State / dev
	'core.state.queueEmpty': 'Kuyrukta hiçbir şey yok.',
	'core.state.notReady': 'Oynatıcı henüz hazır değil.',

	// A11y announcements
	'core.a11y.playing': '{title} oynatılıyor',
	'core.a11y.paused': 'Duraklatıldı',
	'core.a11y.stopped': 'Durduruldu',
	'core.a11y.seeking': '{time}\'e aranıyor',
	'core.a11y.trackChange': 'Şimdi {title} oynatılıyor',
	'core.a11y.error': 'Oynatma sırasında bir hata oluştu',
	'core.a11y.muted': 'Sessiz',
	'core.a11y.unmuted': 'Ses açık',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Oynatma duraklatıldı — başka bir sekme şimdi oynatılıyor.',
	'plugin.media-session.unsupported': 'OS medya denetçileri bu tarayıcıda kullanılamıyor.',
};

export default trTranslations;
