// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Czech core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'cs',
 *   translations: {
 *     ...defaultTranslations,
 *     cs: csTranslations,
 *   },
 * });
 */
export const csTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Žádné připojení k internetu.',
	'core.network.timeout': 'Vypršel časový limit připojení. Opakuji pokus…',
	'core.network.serverError': 'Server má problémy. Zkuste to za chvíli.',
	'core.network.notFound': 'Obsah se nepodařilo najít.',
	'core.network.rateLimited': 'Příliš mnoho žádostí. Zpomalte prosím.',

	// Auth
	'core.auth.unauthenticated': 'Přihlaste se znovu, aby se vaše relace obnovila.',
	'core.auth.forbidden': 'Váš účet nemá přístup k tomuto obsahu.',
	'core.auth.refreshFailed': 'Vaši relaci se nepodařilo obnovit. Přihlaste se znovu.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Klepnutím nebo kliknutím kamkoli začněte přehrávání.',
	'core.policy.userGestureRequired': 'Klepnutím povolte zvuk.',
	'core.policy.pipDenied': 'Obraz v obraze není v tomto kontextu povolena.',
	'core.policy.fullscreenDenied': 'Celá obrazovka není v tomto kontextu povolena.',
	'core.policy.wakeLockDenied': 'Obrazovka se během přehrávání může ztmavit.',

	// Media
	'core.media.unsupported': 'Tento formát není podporován vaším prohlížečem.',
	'core.media.decodeFailed': 'Přehrávání se nezdařilo — přechod na další dostupný zdroj.',
	'core.media.allDecodeFailed': 'Pro tento obsah není k dispozici žádný přehrávací zdroj.',

	// DRM
	'core.drm.outputProtection': 'Váš displej nesplňuje požadavky na ochranu tohoto obsahu.',
	'core.drm.licenseFailed': 'Pro tento obsah se nepodařilo získat licenci.',
	'core.drm.keySystemUnsupported': 'Váš prohlížeč nepodporuje požadovaný systém ochrany.',

	// State / dev
	'core.state.queueEmpty': 'Ve frontě není nic.',
	'core.state.notReady': 'Přehrávač není zatím připraven.',

	// A11y announcements
	'core.a11y.playing': 'Přehrávání {title}',
	'core.a11y.paused': 'Pozastaveno',
	'core.a11y.stopped': 'Zastaveno',
	'core.a11y.seeking': 'Hledání na {time}',
	'core.a11y.trackChange': 'Nyní se přehrává {title}',
	'core.a11y.error': 'Během přehrávání došlo k chybě',
	'core.a11y.muted': 'Vypnuto',
	'core.a11y.unmuted': 'Zapnuto',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Přehrávání pozastaveno — nyní se přehrává jiná karta.',
	'plugin.media-session.unsupported': 'Ovládací prvky médií operačního systému nejsou v tomto prohlížeči dostupné.',
};

export default csTranslations;
