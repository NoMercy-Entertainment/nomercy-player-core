// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Italian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'it',
 *   translations: {
 *     ...defaultTranslations,
 *     it: itTranslations,
 *   },
 * });
 */
export const itTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Nessuna connessione Internet.',
	'core.network.timeout': 'Timeout della connessione. Riprovando…',
	'core.network.serverError': 'Il server ha problemi. Riprova tra un momento.',
	'core.network.notFound': 'Quel contenuto non è stato trovato.',
	'core.network.rateLimited': 'Troppe richieste. Per favore rallenta.',

	// Auth
	'core.auth.unauthenticated': 'Accedi di nuovo per aggiornare la tua sessione.',
	'core.auth.forbidden': 'Il tuo account non ha accesso a questo contenuto.',
	'core.auth.refreshFailed': 'Non è stato possibile aggiornare la tua sessione. Accedi di nuovo.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Tocca o fai clic ovunque per iniziare la riproduzione.',
	'core.policy.userGestureRequired': 'Tocca per abilitare l\'audio.',
	'core.policy.pipDenied': 'Immagine nell\'immagine non è consentita in questo contesto.',
	'core.policy.fullscreenDenied': 'Lo schermo intero non è consentito in questo contesto.',
	'core.policy.wakeLockDenied': 'Lo schermo potrebbe oscurarsi durante la riproduzione.',

	// Media
	'core.media.unsupported': 'Questo formato non è supportato dal tuo browser.',
	'core.media.decodeFailed': 'Riproduzione non riuscita — passaggio alla prossima fonte disponibile.',
	'core.media.allDecodeFailed': 'Nessuna fonte riproducibile disponibile per questo contenuto.',

	// DRM
	'core.drm.outputProtection': 'Il tuo display non soddisfa i requisiti di protezione per questo contenuto.',
	'core.drm.licenseFailed': 'Non è stato possibile ottenere una licenza per questo contenuto.',
	'core.drm.keySystemUnsupported': 'Il tuo browser non supporta il sistema di protezione richiesto.',

	// State / dev
	'core.state.queueEmpty': 'Non c\'è nulla in coda.',
	'core.state.notReady': 'Il lettore non è ancora pronto.',

	// A11y announcements
	'core.a11y.playing': 'Riproduzione {title}',
	'core.a11y.paused': 'In pausa',
	'core.a11y.stopped': 'Fermato',
	'core.a11y.seeking': 'Ricerca su {time}',
	'core.a11y.trackChange': 'Riproduzione {title}',
	'core.a11y.error': 'Si è verificato un errore durante la riproduzione',
	'core.a11y.muted': 'Silenziato',
	'core.a11y.unmuted': 'Audio attivato',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Riproduzione sospesa — un\'altra scheda sta riproducendo.',
	'plugin.media-session.unsupported': 'I controlli media del sistema operativo non sono disponibili in questo browser.',
};

export default itTranslations;
