// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Danish core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'da',
 *   translations: {
 *     ...defaultTranslations,
 *     da: daTranslations,
 *   },
 * });
 */
export const daTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Ingen internetforbindelse.',
	'core.network.timeout': 'Forbindelsen fik timeout. Forsøger igen…',
	'core.network.serverError': 'Serveren har problemer. Prøv igen om et øjeblik.',
	'core.network.notFound': 'Det indhold kunne ikke findes.',
	'core.network.rateLimited': 'For mange anmodninger. Venligst sænk farten.',

	// Auth
	'core.auth.unauthenticated': 'Log ind igen for at opfriske din session.',
	'core.auth.forbidden': 'Din konto har ikke adgang til dette indhold.',
	'core.auth.refreshFailed': 'Kunne ikke opfriske din session. Log ind igen.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Tryk eller klik et sted for at starte afspilning.',
	'core.policy.userGestureRequired': 'Tryk for at aktivere lyd.',
	'core.policy.pipDenied': 'Billede-i-billede er ikke tilladt i denne sammenhæng.',
	'core.policy.fullscreenDenied': 'Fuldskærm er ikke tilladt i denne sammenhæng.',
	'core.policy.wakeLockDenied': 'Skærmen kan blive mørkere under afspilning.',

	// Media
	'core.media.unsupported': 'Dette format understøttes ikke af din browser.',
	'core.media.decodeFailed': 'Afspilning mislykkedes — skifter til næste tilgængelige kilde.',
	'core.media.allDecodeFailed': 'Ingen afspilningsbar kilde er tilgængelig for dette indhold.',

	// DRM
	'core.drm.outputProtection': 'Dit display opfylder ikke beskyttelseskravene for dette indhold.',
	'core.drm.licenseFailed': 'Kunne ikke få en licens til dette indhold.',
	'core.drm.keySystemUnsupported': 'Din browser understøtter ikke det påkrævede beskyttelsessystem.',

	// State / dev
	'core.state.queueEmpty': 'Der er intet i køen.',
	'core.state.notReady': 'Afspilleren er ikke klar endnu.',

	// A11y announcements
	'core.a11y.playing': 'Afspiller {title}',
	'core.a11y.paused': 'Pauseret',
	'core.a11y.stopped': 'Stoppet',
	'core.a11y.seeking': 'Søger til {time}',
	'core.a11y.trackChange': 'Afspiller nu {title}',
	'core.a11y.error': 'Der opstod en fejl under afspilning',
	'core.a11y.muted': 'Dæmpet',
	'core.a11y.unmuted': 'Lyd slået til',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Afspilning sat på pause — et andet faneblad afspilles nu.',
	'plugin.media-session.unsupported': 'OS-mediekontroller er ikke tilgængelige i denne browser.',
};

export default daTranslations;
