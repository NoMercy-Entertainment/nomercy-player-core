// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Hungarian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'hu',
 *   translations: {
 *     ...defaultTranslations,
 *     hu: huTranslations,
 *   },
 * });
 */
export const huTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Nincs internetkapcsolat.',
	'core.network.timeout': 'A kapcsolat időtúllépésbe ment. Újra próbálok…',
	'core.network.serverError': 'A szerver hibákat talál. Próbálkozzon később.',
	'core.network.notFound': 'Ez a tartalom nem található.',
	'core.network.rateLimited': 'Túl sok kérés. Kérjük, lassítsa.',

	// Auth
	'core.auth.unauthenticated': 'Jelentkezzen be újra a munkamenet frissítéséhez.',
	'core.auth.forbidden': 'Az Ön fiókjának nincs hozzáférése ehhez a tartalomhoz.',
	'core.auth.refreshFailed': 'A munkamenetet nem sikerült frissíteni. Jelentkezzen be újra.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Érintsen meg vagy kattintson bárhol a lejátszás megkezdéséhez.',
	'core.policy.userGestureRequired': 'Érintse meg a hang engedélyezéséhez.',
	'core.policy.pipDenied': 'A kép a képben nem engedélyezett ebben a kontextusban.',
	'core.policy.fullscreenDenied': 'A teljes képernyő nem engedélyezett ebben a kontextusban.',
	'core.policy.wakeLockDenied': 'A képernyő a lejátszás során elsötétedhet.',

	// Media
	'core.media.unsupported': 'A böngészője nem támogatja ezt a formátumot.',
	'core.media.decodeFailed': 'A lejátszás sikertelen — váltás a következő elérhető forrásra.',
	'core.media.allDecodeFailed': 'Ehhez a tartalomhoz nincs elérhető lejátszható forrás.',

	// DRM
	'core.drm.outputProtection': 'A kijelzője nem felel meg a tartalom védelmi követelményeinek.',
	'core.drm.licenseFailed': 'Nem sikerült licencet szerezni ehhez a tartalomhoz.',
	'core.drm.keySystemUnsupported': 'A böngészője nem támogatja a szükséges védelmi rendszert.',

	// State / dev
	'core.state.queueEmpty': 'Semmi sincs a sorban.',
	'core.state.notReady': 'A lejátszó még nem áll készen.',

	// A11y announcements
	'core.a11y.playing': '{title} lejátszása',
	'core.a11y.paused': 'Szüneteltetve',
	'core.a11y.stopped': 'Leállítva',
	'core.a11y.seeking': 'Keresés a(z) {time} időponton',
	'core.a11y.trackChange': 'Most {title} lejátszása',
	'core.a11y.error': 'Hiba történt a lejátszás során',
	'core.a11y.muted': 'Néma',
	'core.a11y.unmuted': 'Hang bekapcsolva',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Lejátszás szüneteltetve — egy másik lap most játszik.',
	'plugin.media-session.unsupported': 'Az operációs rendszer médiaellenőrzése nem érhető el ebben a böngészőben.',
};

export default huTranslations;
