// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Georgian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ka',
 *   translations: {
 *     ...defaultTranslations,
 *     ka: kaTranslations,
 *   },
 * });
 */
export const kaTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'ინტერნეტის კავშირი არ არის.',
	'core.network.timeout': 'კავშირის ხანგრძლივობა. ხელახლა ცდა…',
	'core.network.serverError': 'სერვერს პრობლემები აქვს. სცადეთ ხელახლა მომენტში.',
	'core.network.notFound': 'ეს შინაარსი ვერ მოიძებნა.',
	'core.network.rateLimited': 'ძალიან ბევრი მოთხოვნა. გთხოვთ გაანელოთ.',

	// Auth
	'core.auth.unauthenticated': 'ხელახლა შეხვიდით თქვენი სესიის განახლებისთვის.',
	'core.auth.forbidden': 'თქვენს ანგარიშს არ აქვს წვდომა ამ შინაარსთან.',
	'core.auth.refreshFailed': 'თქვენი სესია ვერ განახლდა. ხელახლა შეხვიდით.',

	// Browser policy
	'core.policy.autoplayBlocked': 'დააჭირეთ ან დააკლიკეთ ყველგან დაკვრის დასაწყებად.',
	'core.policy.userGestureRequired': 'დააჭირეთ აუდიოს ჩასართავად.',
	'core.policy.pipDenied': 'ფото ფოტოში არ არის დაშვებული ამ კონტექსტში.',
	'core.policy.fullscreenDenied': 'სრული ეკრანი არ არის დაშვებული ამ კონტექსტში.',
	'core.policy.wakeLockDenied': 'ეკრანი შესაძლოა დაბნელდეს დაკვრის დროს.',

	// Media
	'core.media.unsupported': 'ეს ფორმატი არ არის მხარდაჭერილი თქვენი ბრაუზერით.',
	'core.media.decodeFailed': 'დაკვრა ვერ მოხერხდა — გადასვლა შემდეგ ხელმისაწვდომ წყაროზე.',
	'core.media.allDecodeFailed': 'ამ შინაარსის ხელმისაწვდომი დაკვრის წყარო არ არის.',

	// DRM
	'core.drm.outputProtection': 'თქვენი დისპლეი არ აკმაყოფილებს ამ შინაარსის დაცვის მოთხოვნებს.',
	'core.drm.licenseFailed': 'ამ შინაარსის ლიცენზია ვერ მოიპოვა.',
	'core.drm.keySystemUnsupported': 'თქვენი ბრაუზერი არ მხარს უჭერს საჭირო დაცვის სისტემას.',

	// State / dev
	'core.state.queueEmpty': 'რიგში არაფერი არ არის.',
	'core.state.notReady': 'დამკვრელი ჯერ არ არის მზად.',

	// A11y announcements
	'core.a11y.playing': '{title}-ის დაკვრა',
	'core.a11y.paused': 'შეჩერებული',
	'core.a11y.stopped': 'შეჩერებული',
	'core.a11y.seeking': 'ძებნა {time}-ში',
	'core.a11y.trackChange': 'ახლა {title}-ის დაკვრა',
	'core.a11y.error': 'შეცდომა დაკვრის დროს',
	'core.a11y.muted': 'დამუქრული',
	'core.a11y.unmuted': 'ხმა ჩართული',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'დაკვრა შეჩერდა — სხვა ჯამი ახლა ხდება.',
	'plugin.media-session.unsupported': 'ოპერაციული სისტემის მედია კონტროლი არ არის ხელმისაწვდომი ამ ბრაუზერში.',
};

export default kaTranslations;
