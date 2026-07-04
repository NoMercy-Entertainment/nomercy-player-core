// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Khmer core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'km',
 *   translations: {
 *     ...defaultTranslations,
 *     km: kmTranslations,
 *   },
 * });
 */
export const kmTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'គ្មានការតភ្ជាប់អ៊ីនធឺណិត។',
	'core.network.timeout': 'ការតភ្ជាប់អស់រយៈពេល។ កំពុងព្យាយាម…',
	'core.network.serverError': 'ម៉ាស៊ីនបម្រើមានបញ្ហា។ សូមព្យាយាមម្តងទៀតក្នុងរយៈពេលបន្ដិច។',
	'core.network.notFound': 'មិនអាចរកឃើញខ្លឹមសារនោះ។',
	'core.network.rateLimited': 'ការស្នើសុំច្រើនពេក។ សូមពន្យឺត។',

	// Auth
	'core.auth.unauthenticated': 'ចូលម្តងទៀតដើម្បីឱ្យការងារមានប្រសិទ្ធភាព។',
	'core.auth.forbidden': 'គណនីរបស់អ្នកមិនមានលទ្ធិសម្រាប់ដំណើរការខ្លឹមសារនេះ។',
	'core.auth.refreshFailed': 'មិនអាចឱ្យការងារមានប្រសិទ្ធភាព។ ចូលម្តងទៀត។',

	// Browser policy
	'core.policy.autoplayBlocked': 'ប៉ះឬចុចក្នុងលំហប្រហោងដើម្បីចាប់ផ្តើមលេង។',
	'core.policy.userGestureRequired': 'ប៉ះដើម្បីបង្កើតសម្លេង។',
	'core.policy.pipDenied': 'ឌីអេលពីលើគំនូរមិនត្រូវបានអនុញ្ញាតក្នុងបរិបទនេះ។',
	'core.policy.fullscreenDenied': 'ស្ក្រីនពេញលេញមិនត្រូវបានអនុញ្ញាតក្នុងបរិបទនេះ។',
	'core.policy.wakeLockDenied': 'អេក្រង់អាចងងឹតអំឡុងពេលលេង។',

	// Media
	'core.media.unsupported': 'ប្រភេទនេះមិនត្រូវបានគាំទ្ដដោយកម្មវិធីរុករករបស់អ្នក។',
	'core.media.decodeFailed': 'ការលេងបានបរាជ័យ — ប្តូរទៅប្រភពបន្ទាប់។',
	'core.media.allDecodeFailed': 'គ្មានប្រភពលេងនៃខ្លឹមសារនេះ។',

	// DRM
	'core.drm.outputProtection': 'អេក្រង់របស់អ្នកមិនឆ្លើយតបនឹងតម្រូវការការពារខ្លឹមសារនេះ។',
	'core.drm.licenseFailed': 'មិនអាចទទួលបានលិខិតបង្កើត។',
	'core.drm.keySystemUnsupported': 'កម្មវិធីរុករករបស់អ្នកមិនគាំទ្ដប្រព័ន្ធការពារដែលចាំបាច់។',

	// State / dev
	'core.state.queueEmpty': 'គ្មានអ្វីក្នុងជួរ។',
	'core.state.notReady': 'ឧបករណ៍លេងមិនត្រៀមខ្លួនដោះលែង។',

	// A11y announcements
	'core.a11y.playing': 'កំពុងលេង {title}',
	'core.a11y.paused': 'ផ្អាក',
	'core.a11y.stopped': 'ឈប់',
	'core.a11y.seeking': 'ស្វែងរក {time}',
	'core.a11y.trackChange': 'ឥឡូវកំពុងលេង {title}',
	'core.a11y.error': 'មានកំហុសកំឡុងពេលលេង',
	'core.a11y.muted': 'ស្ងាត់',
	'core.a11y.unmuted': 'សម្លេងបើក',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'ការលេងផ្អាក — ផ្ទាំងផ្សេងទៀតកំពុងលេង។',
	'plugin.media-session.unsupported': 'សម្ភារៈលេងប្រព័ន្ធមិនសម្រាប់ក្នុងកម្មវិធីរុករករបស់អ្នក។',
};

export default kmTranslations;
