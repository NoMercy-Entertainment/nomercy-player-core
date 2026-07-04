// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Hebrew core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'he',
 *   translations: {
 *     ...defaultTranslations,
 *     he: heTranslations,
 *   },
 * });
 */
export const heTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'אין חיבור אינטרנט.',
	'core.network.timeout': 'תוקף הזמן של החיבור. ניסיון חוזר…',
	'core.network.serverError': 'לשרת יש בעיות. נסה שוב בעוד רגע.',
	'core.network.notFound': 'לא ניתן היה למצוא את התוכן הזה.',
	'core.network.rateLimited': 'יותר מדי בקשות. אנא להאט.',

	// Auth
	'core.auth.unauthenticated': 'התחבר שוב כדי לרענן את ההפעלה שלך.',
	'core.auth.forbidden': 'לחשבונך אין גישה לתוכן זה.',
	'core.auth.refreshFailed': 'לא הצלחתי לרענן את ההפעלה שלך. התחבר שוב.',

	// Browser policy
	'core.policy.autoplayBlocked': 'הקש או לחץ בכל מקום כדי להתחיל הצגה.',
	'core.policy.userGestureRequired': 'הקש כדי להפעיל את הקול.',
	'core.policy.pipDenied': 'תמונה בתמונה לא מורשית בהקשר זה.',
	'core.policy.fullscreenDenied': 'מסך מלא לא מורשה בהקשר זה.',
	'core.policy.wakeLockDenied': 'המסך עלול להתעמעם במהלך ההצגה.',

	// Media
	'core.media.unsupported': 'הדפדפן שלך אינו תומך בפורמט זה.',
	'core.media.decodeFailed': 'הצגה נכשלה — עברת למקור הבא הזמין.',
	'core.media.allDecodeFailed': 'אין מקור להצגה זמין לתוכן זה.',

	// DRM
	'core.drm.outputProtection': 'התצוגה שלך אינה עומדת בדרישות הגנה לתוכן זה.',
	'core.drm.licenseFailed': 'לא הצלחנו לקבל רישיון לתוכן זה.',
	'core.drm.keySystemUnsupported': 'הדפדפן שלך אינו תומך במערכת ההגנה הנדרשת.',

	// State / dev
	'core.state.queueEmpty': 'אין שום דבר בתור.',
	'core.state.notReady': 'הנגן עדיין לא מוכן.',

	// A11y announcements
	'core.a11y.playing': 'בהצגה {title}',
	'core.a11y.paused': 'מושהה',
	'core.a11y.stopped': 'עצור',
	'core.a11y.seeking': 'חיפוש אל {time}',
	'core.a11y.trackChange': 'בהצגה כעת {title}',
	'core.a11y.error': 'שגיאה אירעה במהלך ההצגה',
	'core.a11y.muted': 'מושתק',
	'core.a11y.unmuted': 'קול מופעל',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'הצגה הושהתה — כרטסיה אחרת מצגינה כעת.',
	'plugin.media-session.unsupported': 'בקרי מדיה של מערכת הפעלה אינם זמינים בדפדפן זה.',
};

export default heTranslations;
