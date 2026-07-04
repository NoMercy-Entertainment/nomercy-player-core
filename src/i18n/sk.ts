// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slovak core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'sk',
 *   translations: {
 *     ...defaultTranslations,
 *     sk: skTranslations,
 *   },
 * });
 */
export const skTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Žiadne internetové pripojenie.',
	'core.network.timeout': 'Uplynulo pripojenie. Opakujem sa…',
	'core.network.serverError': 'Server má problémy. Skúste znova za chvíľu.',
	'core.network.notFound': 'Tento obsah sa nepodarilo nájsť.',
	'core.network.rateLimited': 'Príliš veľa požiadaviek. Prosím, spomalte.',

	// Auth
	'core.auth.unauthenticated': 'Prihláste sa znova, aby ste obnovili reláciu.',
	'core.auth.forbidden': 'Váš účet nemá prístup k tomuto obsahu.',
	'core.auth.refreshFailed': 'Nepodarilo sa obnoviť vašu reláciu. Prihláste sa znova.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Dotknite sa alebo kliknite kdekoľvek, aby ste spustili prehrávanie.',
	'core.policy.userGestureRequired': 'Dotknite sa, aby ste povolili zvuk.',
	'core.policy.pipDenied': 'Obrázok v obrázku nie je v tomto kontexte povolený.',
	'core.policy.fullscreenDenied': 'Celá obrazovka nie je v tomto kontexte povolená.',
	'core.policy.wakeLockDenied': 'Obrazovka sa môže počas prehrávania stmavnúť.',

	// Media
	'core.media.unsupported': 'Váš prehliadač nepodporuje tento formát.',
	'core.media.decodeFailed': 'Prehrávanie zlyhalo — prepínanie na ďalší dostupný zdroj.',
	'core.media.allDecodeFailed': 'Pre tento obsah nie je k dispozícii žiadny zdrojový zdroj.',

	// DRM
	'core.drm.outputProtection': 'Váš displej nespĺňa požiadavky na ochranu pre tento obsah.',
	'core.drm.licenseFailed': 'Nepodarilo sa získať licenciu pre tento obsah.',
	'core.drm.keySystemUnsupported': 'Váš prehliadač nepodporuje požadovaný bezpečnostný systém.',

	// State / dev
	'core.state.queueEmpty': 'Vo fronte nie je nič.',
	'core.state.notReady': 'Prehrávač zatiaľ nie je pripravený.',

	// A11y announcements
	'core.a11y.playing': 'Prehrávanie {title}',
	'core.a11y.paused': 'Pozastavené',
	'core.a11y.stopped': 'Zastavené',
	'core.a11y.seeking': 'Hľadám {time}',
	'core.a11y.trackChange': 'Teraz sa prehrávuje {title}',
	'core.a11y.error': 'Počas prehrávania došlo k chybe',
	'core.a11y.muted': 'Stlmený',
	'core.a11y.unmuted': 'Zvuk zapnutý',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Prehrávanie bolo pozastavené — ďalšia karta sa teraz prehrávaBB.',
	'plugin.media-session.unsupported': 'Ovládacích prvkov médií OS nie sú v tomto prehliadači dostupné.',
};

export default skTranslations;
