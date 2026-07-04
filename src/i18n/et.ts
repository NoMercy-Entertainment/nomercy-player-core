// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Estonian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'et',
 *   translations: {
 *     ...defaultTranslations,
 *     et: etTranslations,
 *   },
 * });
 */
export const etTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Internetiühendus puudub.',
	'core.network.timeout': 'Ühenduse aeg saigi täis. Proovitakse uuesti…',
	'core.network.serverError': 'Serveril on probleemid. Proovige hetke pärast uuesti.',
	'core.network.notFound': 'Seda sisu ei leitud.',
	'core.network.rateLimited': 'Liiga palju taotlusi. Palun vähendage kiirust.',

	// Auth
	'core.auth.unauthenticated': 'Logige sisse uuesti, et oma seanss värskendada.',
	'core.auth.forbidden': 'Teie kontol pole juurdepääsu sellele sisule.',
	'core.auth.refreshFailed': 'Teie seanssi ei saanud värskendada. Logige uuesti sisse.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Puudutage või klõpsake kuskil esitamise alustamiseks.',
	'core.policy.userGestureRequired': 'Heli lubamiseks puudutage.',
	'core.policy.pipDenied': 'Pilt pildis ei ole selles kontekstis lubatud.',
	'core.policy.fullscreenDenied': 'Täisekraan pole selles kontekstis lubatud.',
	'core.policy.wakeLockDenied': 'Ekraan võib esitamise ajal tuhmuda.',

	// Media
	'core.media.unsupported': 'Seda vormingut teie brauser ei toeta.',
	'core.media.decodeFailed': 'Esitamine ebaõnnestus — lülitus järgmisele saadaolevale allikale.',
	'core.media.allDecodeFailed': 'Selle sisu jaoks pole saadaolevat esitavat allikat.',

	// DRM
	'core.drm.outputProtection': 'Teie kuvar ei vasta selle sisu kaitsevajadusele.',
	'core.drm.licenseFailed': 'Selle sisu litsentsi ei õnnestunud saada.',
	'core.drm.keySystemUnsupported': 'Teie brauser ei toeta nõutavat kaitseüsteemi.',

	// State / dev
	'core.state.queueEmpty': 'Järjekorras pole midagi.',
	'core.state.notReady': 'Pleier pole veel valmis.',

	// A11y announcements
	'core.a11y.playing': '{title} esitamine',
	'core.a11y.paused': 'Peatatud',
	'core.a11y.stopped': 'Peatatud',
	'core.a11y.seeking': 'Otsing aadressile {time}',
	'core.a11y.trackChange': 'Nüüd esitatakse {title}',
	'core.a11y.error': 'Esitamise ajal tekkis tõrge',
	'core.a11y.muted': 'Helivaikne',
	'core.a11y.unmuted': 'Heli sisse',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Esitamine on peatatud — teine vahekaart esitatakse nüüd.',
	'plugin.media-session.unsupported': 'OS-i meediakontrollid pole selles brauseris saadaval.',
};

export default etTranslations;
