/**
 * Dutch translations for the shared `CastSenderPlugin`. Mirrors `en.ts`.
 */
export default {
	'plugin.cast-sender.unavailable': 'Casten is niet beschikbaar op dit apparaat.',
	'plugin.cast-sender.connecting': 'Verbinden met {device}…',
	'plugin.cast-sender.connected': 'Casten naar {device}',
	'plugin.cast-sender.disconnected': 'Verbinding met {device} verbroken',
	'plugin.cast-sender.error.session-failed': 'Cast-sessie kon niet worden gestart.',
	'plugin.cast-sender.error.load-failed': 'Het cast-apparaat weigerde de media.',
	'plugin.cast-sender.error.generic': 'Er is een castfout opgetreden.',
	'plugin.cast-sender.action.connect': 'Casten',
	'plugin.cast-sender.action.disconnect': 'Stop met casten',
	'plugin.cast-sender.state.buffering': 'Bufferen…',
	'plugin.cast-sender.state.playing': 'Speelt op {device}',
	'plugin.cast-sender.state.paused': 'Gepauzeerd op {device}',
} satisfies Record<string, string>;
