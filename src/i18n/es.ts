// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Spanish core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'es',
 *   translations: {
 *     ...defaultTranslations,
 *     es: esTranslations,
 *   },
 * });
 */
export const esTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Sin conexión a Internet.',
	'core.network.timeout': 'Conexión agotado el tiempo. Reintentar…',
	'core.network.serverError': 'El servidor tiene problemas. Vuelve a intentarlo en un momento.',
	'core.network.notFound': 'Ese contenido no se pudo encontrar.',
	'core.network.rateLimited': 'Demasiadas solicitudes. Por favor reduce la velocidad.',

	// Auth
	'core.auth.unauthenticated': 'Inicia sesión nuevamente para actualizar tu sesión.',
	'core.auth.forbidden': 'Tu cuenta no tiene acceso a este contenido.',
	'core.auth.refreshFailed': 'No se pudo actualizar tu sesión. Vuelve a iniciar sesión.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Toca o haz clic en cualquier lugar para iniciar la reproducción.',
	'core.policy.userGestureRequired': 'Toca para habilitar el audio.',
	'core.policy.pipDenied': 'La imagen dentro de imagen no está permitida en este contexto.',
	'core.policy.fullscreenDenied': 'Pantalla completa no está permitida en este contexto.',
	'core.policy.wakeLockDenied': 'La pantalla puede atenuarse durante la reproducción.',

	// Media
	'core.media.unsupported': 'Tu navegador no es compatible con este formato.',
	'core.media.decodeFailed': 'Reproducción fallida — cambio a la siguiente fuente disponible.',
	'core.media.allDecodeFailed': 'No hay fuente reproducible disponible para este contenido.',

	// DRM
	'core.drm.outputProtection': 'Tu pantalla no cumple con los requisitos de protección para este contenido.',
	'core.drm.licenseFailed': 'No se pudo obtener una licencia para este contenido.',
	'core.drm.keySystemUnsupported': 'Tu navegador no admite el sistema de protección requerido.',

	// State / dev
	'core.state.queueEmpty': 'No hay nada en la cola.',
	'core.state.notReady': 'El reproductor no está listo aún.',

	// A11y announcements
	'core.a11y.playing': 'Reproducción {title}',
	'core.a11y.paused': 'Pausado',
	'core.a11y.stopped': 'Detenido',
	'core.a11y.seeking': 'Buscando a {time}',
	'core.a11y.trackChange': 'Ahora se está reproduciendo {title}',
	'core.a11y.error': 'Se produjo un error durante la reproducción',
	'core.a11y.muted': 'Silenciado',
	'core.a11y.unmuted': 'Sonido activado',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Reproducción pausada — otra pestaña se está reproduciendo ahora.',
	'plugin.media-session.unsupported': 'Los controles de medios del sistema operativo no están disponibles en este navegador.',
};

export default esTranslations;
