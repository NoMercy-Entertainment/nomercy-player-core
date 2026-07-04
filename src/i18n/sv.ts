// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Swedish core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'sv',
 *   translations: {
 *     ...defaultTranslations,
 *     sv: svTranslations,
 *   },
 * });
 */
export const svTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Ingen internetanslutning.',
	'core.network.timeout': 'Anslutningen hade timeout. Försöker igen…',
	'core.network.serverError': 'Servern har problem. Försök igen om en stund.',
	'core.network.notFound': 'Det innehållet kunde inte hittas.',
	'core.network.rateLimited': 'För många begäranden. Vänligen sakta ned.',

	// Auth
	'core.auth.unauthenticated': 'Logga in igen för att uppdatera din session.',
	'core.auth.forbidden': 'Ditt konto har ingen åtkomst till detta innehål.',
	'core.auth.refreshFailed': 'Kunde inte uppdatera din session. Logga in igen.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Rör eller klicka någonstans för att starta uppspelning.',
	'core.policy.userGestureRequired': 'Rör för att aktivera ljud.',
	'core.policy.pipDenied': 'Bild-i-bild är inte tillåten i detta sammanhang.',
	'core.policy.fullscreenDenied': 'Helskärm är inte tillåten i detta sammanhang.',
	'core.policy.wakeLockDenied': 'Skärmen kan bli svagare under uppspelning.',

	// Media
	'core.media.unsupported': 'Det här formatet stöds inte av din webbläsare.',
	'core.media.decodeFailed': 'Uppspelning misslyckades — växlar till nästa tillgängliga källa.',
	'core.media.allDecodeFailed': 'Ingen avspelningsbar källa är tillgänglig för detta innehål.',

	// DRM
	'core.drm.outputProtection': 'Din display uppfyller inte skyddskraven för detta innehål.',
	'core.drm.licenseFailed': 'Kunde inte få en licens för detta innehål.',
	'core.drm.keySystemUnsupported': 'Din webbläsare stöder inte det erforderliga skyddssystemet.',

	// State / dev
	'core.state.queueEmpty': 'Det finns inget i kön.',
	'core.state.notReady': 'Spelaren är inte klar än.',

	// A11y announcements
	'core.a11y.playing': 'Spelar {title}',
	'core.a11y.paused': 'Pausad',
	'core.a11y.stopped': 'Stoppad',
	'core.a11y.seeking': 'Söker till {time}',
	'core.a11y.trackChange': 'Spelar nu {title}',
	'core.a11y.error': 'Ett fel uppstod under uppspelning',
	'core.a11y.muted': 'Tystnad',
	'core.a11y.unmuted': 'Ljud på',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Uppspelningen pausades — en annan flik spelas nu.',
	'plugin.media-session.unsupported': 'OS-mediekontroller är inte tillgängliga i denna webbläsare.',
};

export default svTranslations;
