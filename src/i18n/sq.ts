// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Albanian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'sq',
 *   translations: {
 *     ...defaultTranslations,
 *     sq: sqTranslations,
 *   },
 * });
 */
export const sqTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Nuk ka lidhje interneti.',
	'core.network.timeout': 'Lidhja ka përfunduar. Duke provuar përsëri…',
	'core.network.serverError': 'Serveri ka probleme. Provoni përsëri në një moment.',
	'core.network.notFound': 'Ai përmbajtje nuk mund të gjendet.',
	'core.network.rateLimited': 'Shumë kërkesa. Ju lutemi, ngadalësoni.',

	// Auth
	'core.auth.unauthenticated': 'Hyni përsëri për të rifreskuar seancën tuaj.',
	'core.auth.forbidden': 'Llogaria juaj nuk ka qasje në këtë përmbajtje.',
	'core.auth.refreshFailed': 'Nuk mund të rifreskohej seanca juaj. Hyni përsëri.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Prekni ose klikoni diku për të filluar luajtjen.',
	'core.policy.userGestureRequired': 'Prekni për të aktivizuar audion.',
	'core.policy.pipDenied': 'Fotografia në fotografi nuk lejohet në këtë kontekst.',
	'core.policy.fullscreenDenied': 'Ekrani i plotë nuk lejohet në këtë kontekst.',
	'core.policy.wakeLockDenied': 'Ekrani mund të zbehet gjatë luajtjes.',

	// Media
	'core.media.unsupported': 'Ky format nuk mbështetet nga shfletuesi juaj.',
	'core.media.decodeFailed': 'Luajtja dështoi — kalim në burimin tjetër të disponueshëm.',
	'core.media.allDecodeFailed': 'Nuk ka burimi i disponueshëm luajthm për këtë përmbajtje.',

	// DRM
	'core.drm.outputProtection': 'Ekrani juaj nuk plotëson kërkesat e mbrojtjes për këtë përmbajtje.',
	'core.drm.licenseFailed': 'Nuk mund të merret një licencë për këtë përmbajtje.',
	'core.drm.keySystemUnsupported': 'Shfletuesi juaj nuk mbështet sistemin e mbrojtjes të kërkuar.',

	// State / dev
	'core.state.queueEmpty': 'Nuk ka asgjë në radhë.',
	'core.state.notReady': 'Plejerit nuk është i gatshëm ende.',

	// A11y announcements
	'core.a11y.playing': 'Luajtja {title}',
	'core.a11y.paused': 'E ndalur',
	'core.a11y.stopped': 'I ndaluar',
	'core.a11y.seeking': 'Kërkimi për {time}',
	'core.a11y.trackChange': 'Tani duke luajtur {title}',
	'core.a11y.error': 'Ndodhi një gabim gjatë luajtjes',
	'core.a11y.muted': 'E heshtuar',
	'core.a11y.unmuted': 'Audio aktivizuar',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Luajtja u ndalua — një skela tjetër tani po luaj.',
	'plugin.media-session.unsupported': 'Kontrollet e medies OS nuk janë në dispozicion në këtë shfletues.',
};

export default sqTranslations;
