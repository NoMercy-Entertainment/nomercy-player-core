// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Irish core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ga',
 *   translations: {
 *     ...defaultTranslations,
 *     ga: gaTranslations,
 *   },
 * });
 */
export const gaTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Gan nasc idirlín.',
	'core.network.timeout': 'Nasc trath. Ag iarraidh arís…',
	'core.network.serverError': 'Tá fadhbanna ag an bhfreastalaí. Déan iarracht arís i ngan fhios.',
	'core.network.notFound': 'Níorbh fhéidir an ábhar sin a aimsiú.',
	'core.network.rateLimited': 'An iomarca iarratas. Moilleoidh tú le do thoil.',

	// Auth
	'core.auth.unauthenticated': 'Logáil isteach arís chun do sheisiún a athnuachan.',
	'core.auth.forbidden': 'Níl rochtain ag do chuntas ar an ábhar seo.',
	'core.auth.refreshFailed': 'Níorbh fhéidir do sheisiún a athnuachan. Logáil isteach arís.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Tadhlaigh nó cliceáil in áit ar bith chun an t-imirt a thosú.',
	'core.policy.userGestureRequired': 'Tadhlaigh chun fuaim a chumasú.',
	'core.policy.pipDenied': 'Níl Pictiúr i bPictiúr ceadaithe sa chomhthéacs seo.',
	'core.policy.fullscreenDenied': 'Níl scáileán iomlán ceadaithe sa chomhthéacs seo.',
	'core.policy.wakeLockDenied': 'D\'fhéadfadh an scáileán a dhubh le linn imirt.',

	// Media
	'core.media.unsupported': 'Ní thacaíonn do bhrabhsálaí an fhormáid seo.',
	'core.media.decodeFailed': 'Theip ar imirt — ag athrú go foinse eile ar fáil.',
	'core.media.allDecodeFailed': 'Níl foinse inimrtheach ar fáil don ábhar seo.',

	// DRM
	'core.drm.outputProtection': 'Ní bhíonn do thaispeáint go n-oireann na ceanglais chosanta don ábhar seo.',
	'core.drm.licenseFailed': 'Níorbh fhéidir ceadúnas a fháil don ábhar seo.',
	'core.drm.keySystemUnsupported': 'Ní thacaíonn do bhrabhsálaí leis an gcóras cosanta a éilítear.',

	// State / dev
	'core.state.queueEmpty': 'Níl aon rud san fhila.',
	'core.state.notReady': 'Níl an t-imreoir réidh go fóill.',

	// A11y announcements
	'core.a11y.playing': 'Ag imirt {title}',
	'core.a11y.paused': 'Fospriobtha',
	'core.a11y.stopped': 'Stopta',
	'core.a11y.seeking': 'Ag cuardach go {time}',
	'core.a11y.trackChange': 'Ag imirt {title} anois',
	'core.a11y.error': 'Gur tharla earráid le linn imirt',
	'core.a11y.muted': 'Gan fhuaim',
	'core.a11y.unmuted': 'Guth ar',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Imirt fospriobtha — tá táb eile á imirt anois.',
	'plugin.media-session.unsupported': 'Níl rialúchán meáin an Ghréasáin ar fáil sa bhrabhsálaí seo.',
};

export default gaTranslations;
