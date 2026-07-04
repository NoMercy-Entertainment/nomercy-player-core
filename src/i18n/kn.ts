// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Kannada core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'kn',
 *   translations: {
 *     ...defaultTranslations,
 *     kn: knTranslations,
 *   },
 * });
 */
export const knTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕ ಇಲ್ಲ.',
	'core.network.timeout': 'ಸಂಪರ್ಕ ಸಮಯ ಮುಕ್ತಾಯ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸುತ್ತಿದೆ…',
	'core.network.serverError': 'ಸರ್ವರ್ ಸಮಸ್ಯೆ ಹೊಂದಿದೆ. ಇದೀಗ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
	'core.network.notFound': 'ಆ ವಿಷಯ ಕಂಡುಬಂದಿಲ್ಲ.',
	'core.network.rateLimited': 'ಹೆಚ್ಚು ವಿನಂತಿ. ದಯವಿಟ್ಟು ನಿದಾನಗೊಳಿಸಿ.',

	// Auth
	'core.auth.unauthenticated': 'ನಿಮ್ಮ ಸೆಷನ್ ಮರುಪ್ರಾರಂಭಿಸಲು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.',
	'core.auth.forbidden': 'ನಿಮ್ಮ ಖಾತೆ ಈ ವಿಷಯಕ್ಕೆ ಪ್ರವೇಶ ಹೊಂದಿಲ್ಲ.',
	'core.auth.refreshFailed': 'ನಿಮ್ಮ ಸೆಷನ್ ಮರುಪ್ರಾರಂಭಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.',

	// Browser policy
	'core.policy.autoplayBlocked': 'ಪ್ಲೇಬ್ಯಾಕ್ ಪ್ರಾರಂಭಿಸಲು ಎಲ್ಲಿ ಟ್ಯಾಪ್ ಅಥವಾ ಕ್ಲಿಕ್ ಮಾಡಿ.',
	'core.policy.userGestureRequired': 'ಆಡಿಯೋ ಸಕ್ರಿಯಗೊಳಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ.',
	'core.policy.pipDenied': 'ಈ ಸನ್ನಿವೇಶದಲ್ಲಿ ಪಿಕ್ಚರ್-ಇನ್-ಪಿಕ್ಚರ್ ಅನುಮತಿ ಇಲ್ಲ.',
	'core.policy.fullscreenDenied': 'ಈ ಸನ್ನಿವೇಶದಲ್ಲಿ ಪೂರ್ಣ ಪರದೆ ಅನುಮತಿ ಇಲ್ಲ.',
	'core.policy.wakeLockDenied': 'ಪ್ಲೇಬ್ಯಾಕ್ ಸಮಯದಲ್ಲಿ ಪರದೆ ಮರೆ ಮಾಡುವುದು ಮುಖ್ಯ.',

	// Media
	'core.media.unsupported': 'ನಿಮ್ಮ ಬ್ರೌಜರ್ ಈ ಸ್ವರೂಪವನ್ನು ಸಮರ್ಥನೆ ಮಾಡುತ್ತಿಲ್ಲ.',
	'core.media.decodeFailed': 'ಪ್ಲೇಬ್ಯಾಕ್ ವಿಫಲ — ಮುಂದಿನ ಲಭ್ಯ ಸ್ಟೋರಿಗೆ ಬದಲಾಯಿಸುತ್ತಿದೆ.',
	'core.media.allDecodeFailed': 'ಈ ವಿಷಯಕ್ಕೆ ಯಾವುದೇ ಪ್ಲೇಬಲ್ ಮೂಲ ಲಭ್ಯವಿಲ್ಲ.',

	// DRM
	'core.drm.outputProtection': 'ನಿಮ್ಮ ಡಿಸ್ಪ್ಲೇ ಈ ವಿಷಯದ ಸುರಕ್ಷೆ ಅಗತ್ಯವನ್ನು ಪೂರೈಸುತ್ತಿಲ್ಲ.',
	'core.drm.licenseFailed': 'ಈ ವಿಷಯಕ್ಕೆ ಲೈಸೆನ್ಸ್ ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.',
	'core.drm.keySystemUnsupported': 'ನಿಮ್ಮ ಬ್ರೌಜರ್ ಅಗತ್ಯ ಸುರಕ್ಷೆ ವ್ಯವಸ್ಥೆಯನ್ನು ಸಮರ್ಥನೆ ಮಾಡುತ್ತಿಲ್ಲ.',

	// State / dev
	'core.state.queueEmpty': 'ಕ್ಯೂಗಳಿಯಲ್ಲಿ ಯಾವುದೇ ಸಂವಾದ ಇಲ್ಲ.',
	'core.state.notReady': 'ಪ್ಲೇಯರ್ ಇನ್ನೂ ತಯಾರಿಯಾಗಿಲ್ಲ.',

	// A11y announcements
	'core.a11y.playing': '{title} ಚಲಿಸುತ್ತಿದೆ',
	'core.a11y.paused': 'ತಾಳ್ಮೆ',
	'core.a11y.stopped': 'ನಿಲ್ಲಿಸಲಾಗಿದೆ',
	'core.a11y.seeking': '{time} ಗೆ ಹುಡುಕುತ್ತಿದೆ',
	'core.a11y.trackChange': 'ಈಗ {title} ಚಲಿಸುತ್ತಿದೆ',
	'core.a11y.error': 'ಪ್ಲೇಬ್ಯಾಕ್ ಸಮಯದಲ್ಲಿ ದೋಷ ಸಂಭವಿಸಿದೆ',
	'core.a11y.muted': 'ನಿರ್ನಾದ',
	'core.a11y.unmuted': 'ಶಬ್ದ ಸಕ್ರಿಯ',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'ಪ್ಲೇಬ್ಯಾಕ್ ಅನುಸ್ಥಗಿತ — ಇತರ ಟ್ಯಾಬ್ ಈಗ ಚಲಿಸುತ್ತಿದೆ.',
	'plugin.media-session.unsupported': 'OS ಮೀಡಿಯಾ ನಿಯಂತ್ರಣ ಈ ಬ್ರೌಜರ್ನಲ್ಲಿ ಲಭ್ಯವಿಲ್ಲ.',
};

export default knTranslations;
