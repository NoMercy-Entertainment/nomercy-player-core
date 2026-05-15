/**
 * Built-in `CueParser` instances for LRC, VTT subtitles, and sprite VTT.
 *
 * The kit auto-registers these at low priority during setup so consumer-supplied
 * parsers for the same URL patterns always take precedence.
 *
 * Resolution order: URL extension is checked first (`.lrc` / `.vtt`), then the
 * optional `contentType`. Sprite VTT shares the `.vtt` extension and ranks
 * behind plain VTT — it activates only when the URL contains `sprite.vtt` or
 * `sprites.vtt`, or when the consumer explicitly registers `spriteVttParser`
 * at higher priority.
 */

import type { CueParser } from './ICueParser';
import type { LrcPayload } from './lrc';
import type { VTTSpritePayload, VTTSubtitlePayload } from './vtt';
import { parseLrc } from './lrc';
import { parseVttSprite, parseVttSubtitles } from './vtt';

const LRC_EXT_RE = /\.lrc(?:\?|$)/i;
const LRC_MIME_RE = /^application\/x-(lrc|lyrics)$|^text\/lrc$/i;
const VTT_EXT_RE = /\.vtt(\?|$)/i;
const VTT_MIME_RE = /^text\/vtt$/i;
const SPRITE_VTT_HINT_RE = /sprite\.vtt(\?|$)|sprites?\.vtt(\?|$)/i;

/** Built-in parser for `.lrc` files and `application/x-lrc` content-type. */
export const lrcParser: CueParser<LrcPayload> = {
	id: 'lrc',
	canParse(url: string, contentType?: string): boolean {
		if (LRC_EXT_RE.test(url))
			return true;
		if (contentType && LRC_MIME_RE.test(contentType))
			return true;
		return false;
	},
	parse(raw: string) {
		return parseLrc(raw);
	},
};

/** Built-in parser for WebVTT subtitle files. Does not match sprite-VTT URLs. */
export const vttSubtitleParser: CueParser<VTTSubtitlePayload> = {
	id: 'vtt',
	canParse(url: string, contentType?: string): boolean {
		// Sprite VTT outranks plain VTT only when the URL hints at sprites; this
		// parser handles plain subtitle VTT.
		if (SPRITE_VTT_HINT_RE.test(url))
			return false;
		if (VTT_EXT_RE.test(url))
			return true;
		if (contentType && VTT_MIME_RE.test(contentType))
			return true;
		return false;
	},
	parse(raw: string) {
		return parseVttSubtitles(raw);
	},
};

/** Built-in parser for sprite WebVTT files (`*.sprite.vtt` / `*.sprites.vtt`). */
export const spriteVttParser: CueParser<VTTSpritePayload> = {
	id: 'sprite-vtt',
	canParse(url: string): boolean {
		// Activates only when the URL strongly hints at sprite content
		// (`*.sprite.vtt` / `*.sprites.vtt`). Pure `.vtt` falls through to
		// `vttSubtitleParser`.
		return SPRITE_VTT_HINT_RE.test(url);
	},
	parse(raw: string, opts?: { baseUrl?: string }) {
		return parseVttSprite(raw, opts?.baseUrl);
	},
};

/**
 * Default parser bundle registered by the kit at startup. Consumers do not
 * need to install these manually. Register a custom parser with the same `id`
 * to replace any of them, or call `player.cueRegistry.unregister(id)` to
 * remove one entirely.
 */
export const builtInCueParsers: ReadonlyArray<CueParser> = [
	lrcParser,
	vttSubtitleParser,
	spriteVttParser,
];
