// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Malay core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ms',
 *   translations: {
 *     ...defaultTranslations,
 *     ms: msTranslations,
 *   },
 * });
 */
export const msTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Tiada sambungan Internet.',
	'core.network.timeout': 'Hadnya sambungan. Sedang mencuba semula…',
	'core.network.serverError': 'Pelayan mempunyai masalah. Cuba lagi dalam seketika.',
	'core.network.notFound': 'Kandungan itu tidak dapat ditemui.',
	'core.network.rateLimited': 'Terlalu banyak permintaan. Sila perlahan.',

	// Auth
	'core.auth.unauthenticated': 'Daftar masuk lagi untuk menyegarkan sesi anda.',
	'core.auth.forbidden': 'Akaun anda tidak mempunyai akses ke kandungan ini.',
	'core.auth.refreshFailed': 'Tidak dapat menyegarkan sesi anda. Daftar masuk lagi.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Sentuh atau klik di mana sahaja untuk memulai pemutaran.',
	'core.policy.userGestureRequired': 'Sentuh untuk mengaktifkan audio.',
	'core.policy.pipDenied': 'Gambar dalam gambar tidak dibenarkan dalam konteks ini.',
	'core.policy.fullscreenDenied': 'Layar penuh tidak dibenarkan dalam konteks ini.',
	'core.policy.wakeLockDenied': 'Skrin mungkin menjadi gelap semasa pemutaran.',

	// Media
	'core.media.unsupported': 'Format ini tidak disokong oleh penyemak imbas anda.',
	'core.media.decodeFailed': 'Pemutaran gagal — beralih ke sumber seterusnya yang tersedia.',
	'core.media.allDecodeFailed': 'Tiada sumber pemutaran tersedia untuk kandungan ini.',

	// DRM
	'core.drm.outputProtection': 'Paparan anda tidak memenuhi keperluan perlindungan untuk kandungan ini.',
	'core.drm.licenseFailed': 'Tidak dapat mendapatkan lesen untuk kandungan ini.',
	'core.drm.keySystemUnsupported': 'Penyemak imbas anda tidak menyokong sistem perlindungan yang diperlukan.',

	// State / dev
	'core.state.queueEmpty': 'Tiada apa-apa dalam giliran.',
	'core.state.notReady': 'Pemain belum bersedia.',

	// A11y announcements
	'core.a11y.playing': 'Memainkan {title}',
	'core.a11y.paused': 'Dijeda',
	'core.a11y.stopped': 'Dihentikan',
	'core.a11y.seeking': 'Mencari {time}',
	'core.a11y.trackChange': 'Kini memainkan {title}',
	'core.a11y.error': 'Ralat berlaku semasa pemutaran',
	'core.a11y.muted': 'Senyap',
	'core.a11y.unmuted': 'Bunyi aktif',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Pemutaran dijeda — tab lain kini bermain.',
	'plugin.media-session.unsupported': 'Kawalan media OS tidak tersedia dalam penyemak imbas ini.',
};

export default msTranslations;
