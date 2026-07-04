// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Occitan core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'oc',
 *   translations: {
 *     ...defaultTranslations,
 *     oc: ocTranslations,
 *   },
 * });
 */
export const ocTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Pas de connexion Internet.',
	'core.network.timeout': 'Connexion estirada. Torno a prebar…',
	'core.network.serverError': 'Lo servidor a de problèmas. Tornatz prebar dins un moment.',
	'core.network.notFound': 'Aqueu contengut a pas pogut èstre trovat.',
	'core.network.rateLimited': 'Tròp de demandas. Se vos plai, vos ralentissètz.',

	// Auth
	'core.auth.unauthenticated': 'Connexionatz de nòu per actualizar vòstra sesilha.',
	'core.auth.forbidden': 'Vòstre compte a pas d\'accès a aqueu contengut.',
	'core.auth.refreshFailed': 'Aurà pas pogut actualizar vòstra sesilha. Connexionatz de nòu.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Toquetz o clicatz pertot per aicí per comensar la lectura.',
	'core.policy.userGestureRequired': 'Toquetz per activar l\'àudio.',
	'core.policy.pipDenied': 'Imatge dins imatge es pas autorizat dins aqueu contèxt.',
	'core.policy.fullscreenDenied': 'Ecran complet es pas autorizat dins aqueu contèxt.',
	'core.policy.wakeLockDenied': 'L\'ecran pòt escurcir durant la lectura.',

	// Media
	'core.media.unsupported': 'Aqueu format es pas suportat per vòstre navegador.',
	'core.media.decodeFailed': 'Lectura fracassada — basculament a la font disponibla seguenta.',
	'core.media.allDecodeFailed': 'Pas de font lecabla disponibla per aqueu contengut.',

	// DRM
	'core.drm.outputProtection': 'Vòstra écran satisfai pas als recuèissions de proteccion per aqueu contengut.',
	'core.drm.licenseFailed': 'Aurà pas pogut obtenir una licéncia per aqueu contengut.',
	'core.drm.keySystemUnsupported': 'Vòstre navegador suporta pas lo sistèma de proteccion requit.',

	// State / dev
	'core.state.queueEmpty': 'I a res dins la cua.',
	'core.state.notReady': 'Lo lecor es pas encòra prèst.',

	// A11y announcements
	'core.a11y.playing': 'Lectura {title}',
	'core.a11y.paused': 'En pauza',
	'core.a11y.stopped': 'Arrestat',
	'core.a11y.seeking': 'Recèrca {time}',
	'core.a11y.trackChange': 'Lectura {title}',
	'core.a11y.error': 'Una error s\'es producha durant la lectura',
	'core.a11y.muted': 'Muet',
	'core.a11y.unmuted': 'Son activat',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Lectura en pauza — un autre onglet es ara en lectura.',
	'plugin.media-session.unsupported': 'Los controles de mèdia de l\'OS son pas disponibles dins aqueu navegador.',
};

export default ocTranslations;
