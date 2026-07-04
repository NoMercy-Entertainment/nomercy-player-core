// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Malayalam core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ml',
 *   translations: {
 *     ...defaultTranslations,
 *     ml: mlTranslations,
 *   },
 * });
 */
export const mlTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'ഇന്റർനെറ്റ് കണക്ഷൻ ഇല്ല.',
	'core.network.timeout': 'കണക്ഷൻ സമയ പൂര്ത്തിയായി. വീണ്ടും ശ്രമിക്കുന്നു…',
	'core.network.serverError': 'സെർവർ പ്രശ്നങ്ങൾ ഉണ്ട്. കുറച്ച് സമയത്ത് വീണ്ടും ശ്രമിക്കുക.',
	'core.network.notFound': 'ആ സামഗ്രി കണ്ടെത്താൻ കഴിഞ്ഞില്ല.',
	'core.network.rateLimited': 'വളരെയധികം അഭ്യർത്ഥനകൾ. കാരുണ്യം കാട്ടിയ് കുറയ്ക്കുക.',

	// Auth
	'core.auth.unauthenticated': 'നിങ്ങളുടെ സെഷൻ പുതുക്കാൻ വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.',
	'core.auth.forbidden': 'നിങ്ങളുടെ അക്കൌണ്ടിന് ഈ സാമഗ്രിയിലേക്കുള്ള പ്രവേശനമില്ല.',
	'core.auth.refreshFailed': 'നിങ്ങളുടെ സെഷൻ പുതുക്കാൻ കഴിഞ്ഞില്ല. വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.',

	// Browser policy
	'core.policy.autoplayBlocked': 'പ്ലേബാക്ക് ആരംഭിക്കാൻ എവിടെയെങ്കിലും ടാപ്പ് അല്ലെങ്കിൽ ക്ലിക്ക് ചെയ്യുക.',
	'core.policy.userGestureRequired': 'ഓഡിയോ സജ്ജമാക്കാൻ ടാപ്പ് ചെയ്യുക.',
	'core.policy.pipDenied': 'ഈ സന്ദർഭത്തിൽ ചിത്രത്തിന്റെ ചിത്രം അനുവദിച്ചിട്ടില്ല.',
	'core.policy.fullscreenDenied': 'ഈ സന്ദർഭത്തിൽ പൂർണ്ണ സ്ക്രീൻ അനുവദിച്ചിട്ടില്ല.',
	'core.policy.wakeLockDenied': 'പ്ലേബാക്കിന്റെ സമയത്ത് സ്ക്രീൻ മങ്ങിയിരിക്കാം.',

	// Media
	'core.media.unsupported': 'ഈ ഫോർമാറ്റ് നിങ്ങളുടെ ബ്രൗസർ പിന്തുണയ്ക്കുന്നില്ല.',
	'core.media.decodeFailed': 'പ്ലേബാക്ക് പരാജയപ്പെട്ടു — അടുത്ത ലഭ്യ ഉറവിലേക്കുള്ള സ്വിച്ച്.',
	'core.media.allDecodeFailed': 'ഈ സാമഗ്രിക്കായി പ്ലേബാക്ക് ചെയ്യാവുന്ന ഉറവിൽ ലഭ്യമല്ല.',

	// DRM
	'core.drm.outputProtection': 'നിങ്ങളുടെ ഡിസ്പ്ലേ ഈ സാമഗ്രിയുടെ സുരക്ഷാ ആവശ്യകതകൾ പൂരിപ്പിക്കുന്നില്ല.',
	'core.drm.licenseFailed': 'ഈ സാമഗ്രിയുടെ ലൈസൻസ് ലഭിക്കാൻ കഴിഞ്ഞില്ല.',
	'core.drm.keySystemUnsupported': 'നിങ്ങളുടെ ബ്രൗസർ ആവശ്യമായ സുരക്ഷാ സിസ്റ്റം പിന്തുണയ്ക്കുന്നില്ല.',

	// State / dev
	'core.state.queueEmpty': 'ക്യൂവിൽ ഒന്നും ഇല്ല.',
	'core.state.notReady': 'പ്ലേയർ ഇതുവരെ തയ്യാറാണ്.',

	// A11y announcements
	'core.a11y.playing': '{title} പ്ലേബാക്ക്',
	'core.a11y.paused': 'നിർത്തി',
	'core.a11y.stopped': 'നിർത്തി',
	'core.a11y.seeking': '{time} തിരയുന്നു',
	'core.a11y.trackChange': 'ഇപ്പോൾ {title} പ്ലേബാക്ക് ചെയ്യുന്നു',
	'core.a11y.error': 'പ്ലേബാക്കിനിടയിൽ ഒരു പിശക് സംഭവിച്ചു',
	'core.a11y.muted': 'നിശ്ശബ്ദം',
	'core.a11y.unmuted': 'ശബ്ദം ഓൺ',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'പ്ലേബാക്ക് നിർത്തിയിരിക്കുന്നു — മറ്റൊരു ടാബ് ഇപ്പോൾ പ്ലേബാക്ക് ചെയ്യുന്നു.',
	'plugin.media-session.unsupported': 'OS മീഡിയ നിയന്ത്രണങ്ങൾ ഈ ബ്രൗസറിൽ ലഭ്യമല്ല.',
};

export default mlTranslations;
