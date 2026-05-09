/**
 * `CueParser`-shape wrappers around the built-in low-level parse functions
 * (`parseLrc`, `parseVttSubtitles`, `parseVttSprite`). These are the parsers
 * the kit auto-registers during `setup()` per spec §G / §24.7 — consumers
 * don't have to install them manually.
 *
 * Resolution heuristic: `canParse` checks the URL extension first
 * (`.lrc`/`.vtt`), then the optional content-type (lyric MIME for LRC,
 * `text/vtt` for VTT). Sprite-VTT shares the `.vtt` extension so it ranks
 * BEHIND plain VTT in registration order — sprite is opt-in via either
 * naming convention (`*.sprite.vtt`) OR consumer's explicit register.
 */

import type { CueParser } from '../parser-registry';
import type { LrcPayload } from './lrc';
import type { VTTSpritePayload, VTTSubtitlePayload } from './vtt';
import { parseLrc } from './lrc';
import { parseVttSprite, parseVttSubtitles } from './vtt';

const LRC_EXT_RE = /\.lrc(?:\?|$)/i;
const LRC_MIME_RE = /^application\/x-(lrc|lyrics)$|^text\/lrc$/i;
const VTT_EXT_RE = /\.vtt(\?|$)/i;
const VTT_MIME_RE = /^text\/vtt$/i;
const SPRITE_VTT_HINT_RE = /sprite\.vtt(\?|$)|sprites?\.vtt(\?|$)/i;

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
 * The full default-parser bundle. The kit registers these as low-priority
 * (prepend) entries during setup() so consumer-supplied parsers always win.
 */
export const builtInCueParsers: ReadonlyArray<CueParser> = [
	lrcParser,
	vttSubtitleParser,
	spriteVttParser,
];
