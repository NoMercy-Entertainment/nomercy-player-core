// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Indonesian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'id',
 *   translations: {
 *     ...defaultTranslations,
 *     id: idTranslations,
 *   },
 * });
 */
export const idTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Tidak ada koneksi internet.',
	'core.network.timeout': 'Koneksi habis waktu. Mencoba lagi…',
	'core.network.serverError': 'Server mengalami masalah. Coba lagi dalam sebentar.',
	'core.network.notFound': 'Konten itu tidak dapat ditemukan.',
	'core.network.rateLimited': 'Terlalu banyak permintaan. Silakan perlambat.',

	// Auth
	'core.auth.unauthenticated': 'Masuk kembali untuk menyegarkan sesi Anda.',
	'core.auth.forbidden': 'Akun Anda tidak memiliki akses ke konten ini.',
	'core.auth.refreshFailed': 'Tidak dapat menyegarkan sesi Anda. Masuk kembali.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Ketuk atau klik di mana saja untuk memulai pemutaran.',
	'core.policy.userGestureRequired': 'Ketuk untuk mengaktifkan audio.',
	'core.policy.pipDenied': 'Gambar dalam gambar tidak diizinkan dalam konteks ini.',
	'core.policy.fullscreenDenied': 'Layar penuh tidak diizinkan dalam konteks ini.',
	'core.policy.wakeLockDenied': 'Layar mungkin meredup selama pemutaran.',

	// Media
	'core.media.unsupported': 'Format ini tidak didukung oleh browser Anda.',
	'core.media.decodeFailed': 'Pemutaran gagal — beralih ke sumber tersedia berikutnya.',
	'core.media.allDecodeFailed': 'Tidak ada sumber yang dapat diputar tersedia untuk konten ini.',

	// DRM
	'core.drm.outputProtection': 'Tampilan Anda tidak memenuhi persyaratan perlindungan untuk konten ini.',
	'core.drm.licenseFailed': 'Tidak dapat memperoleh lisensi untuk konten ini.',
	'core.drm.keySystemUnsupported': 'Browser Anda tidak mendukung sistem perlindungan yang diperlukan.',

	// State / dev
	'core.state.queueEmpty': 'Tidak ada apa-apa dalam antrian.',
	'core.state.notReady': 'Pemutar belum siap.',

	// A11y announcements
	'core.a11y.playing': 'Memutar {title}',
	'core.a11y.paused': 'Dijeda',
	'core.a11y.stopped': 'Dihentikan',
	'core.a11y.seeking': 'Mencari ke {time}',
	'core.a11y.trackChange': 'Sedang memutar {title}',
	'core.a11y.error': 'Terjadi kesalahan selama pemutaran',
	'core.a11y.muted': 'Bisu',
	'core.a11y.unmuted': 'Suara aktif',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Pemutaran dijeda — tab lain sekarang memutar.',
	'plugin.media-session.unsupported': 'Kontrol media OS tidak tersedia di browser ini.',
};

export default idTranslations;
