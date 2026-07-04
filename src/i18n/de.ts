// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * German core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'de',
 *   translations: {
 *     ...defaultTranslations,
 *     de: deTranslations,
 *   },
 * });
 */
export const deTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Keine Internetverbindung.',
	'core.network.timeout': 'Verbindungszeitüberschreitung. Erneut versuchen…',
	'core.network.serverError': 'Der Server hat Probleme. Versuchen Sie es in einem Moment erneut.',
	'core.network.notFound': 'Dieser Inhalt konnte nicht gefunden werden.',
	'core.network.rateLimited': 'Zu viele Anfragen. Bitte verlangsamen Sie.',

	// Auth
	'core.auth.unauthenticated': 'Melden Sie sich erneut an, um Ihre Sitzung zu aktualisieren.',
	'core.auth.forbidden': 'Ihr Konto hat keinen Zugriff auf diesen Inhalt.',
	'core.auth.refreshFailed': 'Ihre Sitzung konnte nicht aktualisiert werden. Melden Sie sich erneut an.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Tippen oder klicken Sie überall, um die Wiedergabe zu starten.',
	'core.policy.userGestureRequired': 'Tippen Sie, um Audio zu aktivieren.',
	'core.policy.pipDenied': 'Bild-in-Bild ist in diesem Kontext nicht zulässig.',
	'core.policy.fullscreenDenied': 'Vollbildmodus ist in diesem Kontext nicht zulässig.',
	'core.policy.wakeLockDenied': 'Der Bildschirm kann sich während der Wiedergabe verdunkeln.',

	// Media
	'core.media.unsupported': 'Dieses Format wird von Ihrem Browser nicht unterstützt.',
	'core.media.decodeFailed': 'Wiedergabe fehlgeschlagen — Wechsel zur nächsten verfügbaren Quelle.',
	'core.media.allDecodeFailed': 'Für diesen Inhalt ist keine abspielbare Quelle verfügbar.',

	// DRM
	'core.drm.outputProtection': 'Ihre Anzeige erfüllt nicht die Schutzanforderungen für diesen Inhalt.',
	'core.drm.licenseFailed': 'Konnte keine Lizenz für diesen Inhalt erhalten.',
	'core.drm.keySystemUnsupported': 'Ihr Browser unterstützt das erforderliche Schutzsystem nicht.',

	// State / dev
	'core.state.queueEmpty': 'Es gibt nichts in der Warteschlange.',
	'core.state.notReady': 'Der Player ist noch nicht bereit.',

	// A11y announcements
	'core.a11y.playing': 'Wiedergabe {title}',
	'core.a11y.paused': 'Pausiert',
	'core.a11y.stopped': 'Gestoppt',
	'core.a11y.seeking': 'Suche zu {time}',
	'core.a11y.trackChange': 'Jetzt wird {title} abgespielt',
	'core.a11y.error': 'Während der Wiedergabe ist ein Fehler aufgetreten',
	'core.a11y.muted': 'Stummgeschaltet',
	'core.a11y.unmuted': 'Stummschaltung aufgehoben',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Wiedergabe angehalten — ein anderes Tab wird jetzt abgespielt.',
	'plugin.media-session.unsupported': 'OS-Mediensteuerungen sind in diesem Browser nicht verfügbar.',
};

export default deTranslations;
