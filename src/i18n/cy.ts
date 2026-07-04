// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Welsh core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'cy',
 *   translations: {
 *     ...defaultTranslations,
 *     cy: cyTranslations,
 *   },
 * });
 */
export const cyTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Dim cysylltiad rhyngrwyd.',
	'core.network.timeout': 'Cysylltiad wedi dod i ben. Yn ceisio eto…',
	'core.network.serverError': 'Mae\'r gweinydd yn cael problemau. Ceisiwch eto mewn ychydig.',
	'core.network.notFound': 'Ni ellid dod o hyd i\'r cynnwys hwnnw.',
	'core.network.rateLimited': 'Gormod o geisiadau. Arafu os gwelwch yn dda.',

	// Auth
	'core.auth.unauthenticated': 'Mewngofnodwch eto i adnewyddu eich sesiwn.',
	'core.auth.forbidden': 'Nid oes gan eich cyfrif fynediad i\'r cynnwys hwn.',
	'core.auth.refreshFailed': 'Ni ellid adnewyddu eich sesiwn. Mewngofnodwch eto.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Tapiwch neu cliciwch yn unrhyw le i ddechrau\'r chwaraeiad.',
	'core.policy.userGestureRequired': 'Tapiwch i alluogi sain.',
	'core.policy.pipDenied': 'Nid yw Llun mewn Llun yn cael ei ganiatáu yn y cyd-destun hwn.',
	'core.policy.fullscreenDenied': 'Nid yw sgrin lawn yn cael ei ganiatáu yn y cyd-destun hwn.',
	'core.policy.wakeLockDenied': 'Gall y sgrin ddywyll yn ystod chwaraeiad.',

	// Media
	'core.media.unsupported': 'Nid yw\'r fformat hwn yn cael ei gynnal gan eich porwr.',
	'core.media.decodeFailed': 'Chwaraeiad wedi methu — newid i\'r ffynhonnell ddilynol sydd ar gael.',
	'core.media.allDecodeFailed': 'Nid oes ffynhonnell chwaraeable ar gael ar gyfer y cynnwys hwn.',

	// DRM
	'core.drm.outputProtection': 'Nid yw eich arddangosfa yn cyfarfod y gofynion diogelu ar gyfer y cynnwys hwn.',
	'core.drm.licenseFailed': 'Ni ellid cael trwydded ar gyfer y cynnwys hwn.',
	'core.drm.keySystemUnsupported': 'Nid yw eich porwr yn cynnal y system ddiogelu sydd ei hangen.',

	// State / dev
	'core.state.queueEmpty': 'Nid oes dim yn y ciw.',
	'core.state.notReady': 'Nid yw\'r chwaraeydd yn barod eto.',

	// A11y announcements
	'core.a11y.playing': 'Yn chwarae {title}',
	'core.a11y.paused': 'Atalwyd',
	'core.a11y.stopped': 'Wedi stopio',
	'core.a11y.seeking': 'Yn chwilio am {time}',
	'core.a11y.trackChange': 'Yn chwarae {title} nawr',
	'core.a11y.error': 'Digwyddodd gwall yn ystod chwaraeiad',
	'core.a11y.muted': 'Distaw',
	'core.a11y.unmuted': 'Sain ymlaen',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Chwaraeiad wedi atal — tab arall yn chwarae nawr.',
	'plugin.media-session.unsupported': 'Nid yw adraddau cyfryngau\'r OS ar gael yn y porwr hwn.',
};

export default cyTranslations;
