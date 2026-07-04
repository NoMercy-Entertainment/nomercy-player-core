// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Galician core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'gl',
 *   translations: {
 *     ...defaultTranslations,
 *     gl: glTranslations,
 *   },
 * });
 */
export const glTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Sen conexión a Internet.',
	'core.network.timeout': 'Conexión caducada. Intentando de novo…',
	'core.network.serverError': 'O servidor ten problemas. Inténteo de novo en un momento.',
	'core.network.notFound': 'Non se pudo atopar ese contido.',
	'core.network.rateLimited': 'Demasiadas solicitudes. Por favor, ralentice.',

	// Auth
	'core.auth.unauthenticated': 'Inicie sesión de novo para actualizar a súa sesión.',
	'core.auth.forbidden': 'A túa conta non ten acceso a este contido.',
	'core.auth.refreshFailed': 'Non se pudo actualizar a súa sesión. Inicie sesión de novo.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Toque ou faga clic en calquera lugar para iniciar a reprodución.',
	'core.policy.userGestureRequired': 'Toque para activar o son.',
	'core.policy.pipDenied': 'A imaxe en imaxe non está permitida neste contexto.',
	'core.policy.fullscreenDenied': 'A pantalla completa non está permitida neste contexto.',
	'core.policy.wakeLockDenied': 'A pantalla pode escurecerse durante a reprodución.',

	// Media
	'core.media.unsupported': 'O teu navegador non admite este formato.',
	'core.media.decodeFailed': 'Reprodución fallida — cambio á seguinte fonte dispoñible.',
	'core.media.allDecodeFailed': 'Non hai ningunha fonte reproducible dispoñible para este contido.',

	// DRM
	'core.drm.outputProtection': 'A túa pantalla non cumpre os requisitos de protección para este contido.',
	'core.drm.licenseFailed': 'Non se pudo obter unha licencia para este contido.',
	'core.drm.keySystemUnsupported': 'O teu navegador non é compatible co sistema de protección necesario.',

	// State / dev
	'core.state.queueEmpty': 'Non hai nada na cola.',
	'core.state.notReady': 'O reproductor aínda non está listo.',

	// A11y announcements
	'core.a11y.playing': 'Reproducindo {title}',
	'core.a11y.paused': 'Pausado',
	'core.a11y.stopped': 'Detido',
	'core.a11y.seeking': 'Buscando a {time}',
	'core.a11y.trackChange': 'Reproducindo {title} agora',
	'core.a11y.error': 'Produciuse un erro durante a reprodución',
	'core.a11y.muted': 'Silenciado',
	'core.a11y.unmuted': 'Son activado',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Reprodución pausada — outro separador está reproducindo agora.',
	'plugin.media-session.unsupported': 'Os controis de medios do SO non están dispoñibles neste navegador.',
};

export default glTranslations;
