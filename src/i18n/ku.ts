// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Kurdish core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ku',
 *   translations: {
 *     ...defaultTranslations,
 *     ku: kuTranslations,
 *   },
 * });
 */
export const kuTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Tiştî girêdana Înternêt ne heye.',
	'core.network.timeout': 'Demê girêdanê qediya. Dîsa hewl da…',
	'core.network.serverError': 'Severa xelatiyek heye. Piştî demek dîsa hewl bidin.',
	'core.network.notFound': 'Ew naverok nabe tê dîtin.',
	'core.network.rateLimited': 'Zor dayik hev. Xahişê letdê kêm bikin.',

	// Auth
	'core.auth.unauthenticated': 'Dîsa têkevin da ku dûmahî xwe nû bikin.',
	'core.auth.forbidden': 'Hesaba we ji ber vî naverokî ne hûn dihengî.',
	'core.auth.refreshFailed': 'Nikaribe dûmahî xwe nû bike. Dîsa têkevin.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Xêz an dehn li gelu dereyî bikin da ku lîstikan dest pê bike.',
	'core.policy.userGestureRequired': 'Xêz bikin da ku dengî veke.',
	'core.policy.pipDenied': 'Wêneya di wêneyê de di vî çaverî de rê nade.',
	'core.policy.fullscreenDenied': 'Perde-bi-temam di vî çaverî de rê nade.',
	'core.policy.wakeLockDenied': 'Ekran dikare di demên lîstikê de tûj bibe.',

	// Media
	'core.media.unsupported': 'Vî şiveyî vebgerê te ne tê piştgirîkirin.',
	'core.media.decodeFailed': 'Lîstik têk çû — veguherandin ber ber çavkaniya din.',
	'core.media.allDecodeFailed': 'Çavkaniyeyek vê naverokê ji bo lîstikê hene ne.',

	// DRM
	'core.drm.outputProtection': 'Nîşandeya te şertiyek parastinê ya vî naverokê ne pilekan.',
	'core.drm.licenseFailed': 'Lisenzeyek bo vî naverokî negirtin.',
	'core.drm.keySystemUnsupported': 'Vebgerê te pergala parastina desthûn ne piştgir dike.',

	// State / dev
	'core.state.queueEmpty': 'Tiştî di rêzî de ne heye.',
	'core.state.notReady': 'Vebermêj hê de madizin ne.',

	// A11y announcements
	'core.a11y.playing': 'Lîstika {title}',
	'core.a11y.paused': 'Rawestandin',
	'core.a11y.stopped': 'Rawestiya',
	'core.a11y.seeking': 'Bê vî {time}',
	'core.a11y.trackChange': 'Niha {title} lîst dibe',
	'core.a11y.error': 'Xeletî di demên lîstikê de çû',
	'core.a11y.muted': 'Bê deng',
	'core.a11y.unmuted': 'Deng t\'û',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Lîstik rawestand — taba din niha lîst dibe.',
	'plugin.media-session.unsupported': 'Kontrolên medyaya OS di vî vebgerî de hene ne.',
};

export default kuTranslations;
