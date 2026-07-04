// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Catalan core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ca',
 *   translations: {
 *     ...defaultTranslations,
 *     ca: caTranslations,
 *   },
 * });
 */
export const caTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Sense connexió a internet.',
	'core.network.timeout': 'Connexió esgotat el temps. Reintentat…',
	'core.network.serverError': 'El servidor té problemes. Torna a intentar-ho en un moment.',
	'core.network.notFound': 'Aquell contingut no s\'ha pogut trobar.',
	'core.network.rateLimited': 'Massa sol·licituds. Torna a reduir la velocitat.',

	// Auth
	'core.auth.unauthenticated': 'Torna a iniciar sessió per actualitzar la teva sessió.',
	'core.auth.forbidden': 'El teu compte no té accés a aquest contingut.',
	'core.auth.refreshFailed': 'No s\'ha pogut actualitzar la teva sessió. Torna a iniciar sessió.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Toca o fes clic a qualsevol lloc per iniciar la reproducció.',
	'core.policy.userGestureRequired': 'Toca per habilitar l\'àudio.',
	'core.policy.pipDenied': 'La imatge en imatge no és permet en aquest context.',
	'core.policy.fullscreenDenied': 'Pantalla completa no és permit en aquest context.',
	'core.policy.wakeLockDenied': 'La pantalla es pot enfosquir durant la reproducció.',

	// Media
	'core.media.unsupported': 'Aquest format no és compatible amb el teu navegador.',
	'core.media.decodeFailed': 'La reproducció ha fallat — canvi a la següent font disponible.',
	'core.media.allDecodeFailed': 'No hi ha cap font reproduïble disponible per a aquest contingut.',

	// DRM
	'core.drm.outputProtection': 'La teva pantalla no compleix els requisits de protecció per a aquest contingut.',
	'core.drm.licenseFailed': 'No s\'ha pogut obtenir una llicència per a aquest contingut.',
	'core.drm.keySystemUnsupported': 'El teu navegador no admet el sistema de protecció requerit.',

	// State / dev
	'core.state.queueEmpty': 'No hi ha res a la cua.',
	'core.state.notReady': 'El reproductor no està preparat encara.',

	// A11y announcements
	'core.a11y.playing': 'Reproducció {title}',
	'core.a11y.paused': 'Pausat',
	'core.a11y.stopped': 'Detingut',
	'core.a11y.seeking': 'Cercant a {time}',
	'core.a11y.trackChange': 'Ara s\'està reproduint {title}',
	'core.a11y.error': 'S\'ha produït un error durant la reproducció',
	'core.a11y.muted': 'Silenciat',
	'core.a11y.unmuted': 'Apagat',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Reproducció pausada — una altra pestanya està reproduint ara.',
	'plugin.media-session.unsupported': 'Els controls de mitjans del SO no estan disponibles en aquest navegador.',
};

export default caTranslations;
