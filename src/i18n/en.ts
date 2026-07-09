// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Default English translations bundle. Ships with the kit; consumers provide
 * additional bundles via `setup({ translations })` or runtime
 * `player.setLanguage(lang)`.
 *
 * Key namespace: `<scope>.<feature>.<message>`.
 *  - `core.*` keys live here (network / auth / setup / a11y announcements)
 *  - `plugin.<id>.*` keys live with their plugin
 *  - Each player library ships its own bundle for player-specific keys
 *
 * Plugins reach keys via `this.t('key')` (auto-namespaced under the plugin's id).
 * Player-level keys are reached via `player.t('core.network.timeout')`.
 */
export const enTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'No internet connection.',
	'core.network.timeout': 'The connection timed out. Trying again…',
	'core.network.serverError': 'The server is having issues. Try again in a moment.',
	'core.network.notFound': 'That content could not be found.',
	'core.network.rateLimited': 'Too many requests. Please slow down.',

	// Auth
	'core.auth.unauthenticated': 'Sign in again to refresh your session.',
	'core.auth.forbidden': 'Your account doesn\'t have access to this content.',
	'core.auth.refreshFailed': 'Could not refresh your session. Please sign in again.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Tap or click anywhere to start playback.',
	'core.policy.userGestureRequired': 'Tap to enable audio.',
	'core.policy.pipDenied': 'Picture-in-picture is not allowed in this context.',
	'core.policy.fullscreenDenied': 'Fullscreen is not allowed in this context.',
	'core.policy.wakeLockDenied': 'The screen may dim during playback.',

	// Media
	'core.media.unsupported': 'This format is not supported by your browser.',
	'core.media.decodeFailed': 'Playback failed — switching to the next available source.',
	'core.media.allDecodeFailed': 'No playable source is available for this content.',

	// DRM
	'core.drm.outputProtection': 'Your display does not meet the protection requirements for this content.',
	'core.drm.licenseFailed': 'Could not get a license for this content.',
	'core.drm.keySystemUnsupported': 'Your browser does not support the required protection system.',

	// State / dev
	'core.state.queueEmpty': 'There is nothing in the queue.',
	'core.state.notReady': 'The player is not ready yet.',

	// A11y announcements
	'core.a11y.playing': 'Playing {title}',
	'core.a11y.paused': 'Paused',
	'core.a11y.stopped': 'Stopped',
	'core.a11y.seeking': 'Seeking to {time}',
	'core.a11y.trackChange': 'Now playing {title}',
	'core.a11y.error': 'An error occurred during playback',
	'core.a11y.muted': 'Muted',
	'core.a11y.unmuted': 'Unmuted',

	// Kit plugin lifecycle (consumer-facing)
	'plugin.tab-leader.lost': 'Playback paused — another tab is now playing.',
	'plugin.media-session.unsupported': 'OS media controls are not available in this browser.',

	// Chapters
	'core.chapters.untitled': 'Chapter',
};

/**
 * Pre-shipped translations object — consumers spread this into their
 * `setup({ translations })` config to inherit defaults.
 *
 * @example
 * setup({
 *   language: 'nl',
 *   translations: {
 *     ...defaultTranslations,
 *     nl: { ...nlBundle },
 *   },
 * });
 */
export const defaultTranslations = {
	en: enTranslations,
} as const;

export default enTranslations;
