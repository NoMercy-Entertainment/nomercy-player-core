// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * English translations for the shared `CastSenderPlugin`. Default-exports
 * the bundle so `translationsFromGlob` picks it up automatically.
 *
 * Keys are namespaced under `plugin.cast-sender.*`. Add new languages by
 * dropping a sibling `<tag>.ts` file (`fr.ts`, `de.ts`, `pt-BR.ts`, …) —
 * the glob in the plugin file picks them up at build time.
 */
export default {
	'plugin.cast-sender.unavailable': 'Casting is not available on this device.',
	'plugin.cast-sender.connecting': 'Connecting to {device}…',
	'plugin.cast-sender.connected': 'Casting to {device}',
	'plugin.cast-sender.disconnected': 'Disconnected from {device}',
	'plugin.cast-sender.error.session-failed': 'Could not start the cast session.',
	'plugin.cast-sender.error.load-failed': 'The cast device refused the media.',
	'plugin.cast-sender.error.generic': 'A cast error occurred.',
	'plugin.cast-sender.action.connect': 'Cast',
	'plugin.cast-sender.action.disconnect': 'Stop casting',
	'plugin.cast-sender.state.buffering': 'Buffering…',
	'plugin.cast-sender.state.playing': 'Playing on {device}',
	'plugin.cast-sender.state.paused': 'Paused on {device}',
} satisfies Record<string, string>;
