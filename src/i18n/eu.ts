// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Basque core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'eu',
 *   translations: {
 *     ...defaultTranslations,
 *     eu: euTranslations,
 *   },
 * });
 */
export const euTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Interneterako konexiorik ez.',
	'core.network.timeout': 'Konexioa iraungi da. Berriro saiakuntza…',
	'core.network.serverError': 'Zerbitzariak arazoak ditu. Berriro saiatu denbora batean.',
	'core.network.notFound': 'Eduki hori ezin izan da aurkitu.',
	'core.network.rateLimited': 'Buru asko. Mesedez, moteldu.',

	// Auth
	'core.auth.unauthenticated': 'Saioa hasi berriro zure sesioa berritu ahal izateko.',
	'core.auth.forbidden': 'Zure kontua ez du eduki honetarako sarbiderik.',
	'core.auth.refreshFailed': 'Zure sesioa ezin izan da berritu. Saioa hasi berriro.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Sakatu edo klikatu nonbait erreprodukzioa hasteko.',
	'core.policy.userGestureRequired': 'Sakatu audioa gaitzeko.',
	'core.policy.pipDenied': 'Irudi-irudian ez dago baimenduta testuinguru honetan.',
	'core.policy.fullscreenDenied': 'Pantaila osoa ez dago baimenduta testuinguru honetan.',
	'core.policy.wakeLockDenied': 'Pantaila ilundu daiteke erreprodukzioan zehar.',

	// Media
	'core.media.unsupported': 'Formatu hau ez da zure nabigatzaileak onartzen.',
	'core.media.decodeFailed': 'Erreprodukzioa huts egin du — hurrengo iturri erabilgarrian aldatzen.',
	'core.media.allDecodeFailed': 'Ez dago erreproduziblerako iturririk eduki honen erabilgarri.',

	// DRM
	'core.drm.outputProtection': 'Zure pantailak ez ditu eduki honetarako babes-baldintzak betetzen.',
	'core.drm.licenseFailed': 'Eduki honen lizentzia ezin izan da lortu.',
	'core.drm.keySystemUnsupported': 'Zure nabigatzaileak ez du beharrezko babes-sistema onartzen.',

	// State / dev
	'core.state.queueEmpty': 'Ezer ez dago ilaran.',
	'core.state.notReady': 'Erreproduzigailua ez dago oraindik prest.',

	// A11y announcements
	'core.a11y.playing': '{title} erreproduzitzen',
	'core.a11y.paused': 'Pausatuta',
	'core.a11y.stopped': 'Geldiarazi da',
	'core.a11y.seeking': '{time}-ra bilatzen',
	'core.a11y.trackChange': '{title} erreproduzitzen ari da orain',
	'core.a11y.error': 'Errore bat gertatu da erreprodukzioan zehar',
	'core.a11y.muted': 'Isilatuta',
	'core.a11y.unmuted': 'Audioa gaitu',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Erreprodukzioa pausatuta — beste fitxa bat erreproduzitzen ari da orain.',
	'plugin.media-session.unsupported': 'SE-ko media-kontolak ez daude erabilgarri nabigatzaile honetan.',
};

export default euTranslations;
