import type { Cue, CueList } from '../../cues/cue';
import { createCueList } from '../../cues/cue';

export interface VTTSubtitlePayload {
	/** Cue text with all inline tags stripped. Use for plain-text consumers
	 *  (chrome / accessibility tools, DOM-less environments). */
	text: string;
	/** Raw cue body with `<i>`, `<b>`, `<u>` markup preserved (and unrecognised
	 *  tags `<c>`, `<v>`, `<ruby>`, `<rt>`, `<lang>` + inline timestamps already
	 *  stripped). Renderers should pass this to `buildSubtitleFragment()` to
	 *  produce a sanitised `DocumentFragment` with real DOM nodes. */
	markup?: string;
	/** Inferred styles (legacy convenience for consumers that just need
	 *  bold / italic / color flags without rendering). The `markup` field is
	 *  the source of truth. */
	styles?: { color?: string; bold?: boolean; italic?: boolean };
	/** WebVTT `line:` cue setting normalised to a percentage 0–100. Vertical
	 *  positioning hint — renderers map this to a `top:` style and clear
	 *  `bottom:`. Default-positioned cues (no `line:`) leave this undefined,
	 *  letting the renderer pick its own safe-area bottom inset. */
	linePosition?: number;
	/** WebVTT `align:` cue setting normalised to `start | center | end`
	 *  (legacy `middle` → `center`, `left` → `start`, `right` → `end`). */
	alignment?: 'start' | 'center' | 'end';
	/** WebVTT `size:` cue setting (0–100, percent of the cue area). When
	 *  present, renderers shrink the area horizontally and centre it. */
	size?: number;
}

/** Parsed sprite-sheet crop from a VTT sprite cue (`#xywh=x,y,w,h`). */
export interface VTTSpritePayload {
	url: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * Minimal WebVTT parser.
 *
 * Spec reference: https://www.w3.org/TR/webvtt1/
 *
 * Supports:
 *  - WEBVTT magic header (required)
 *  - Cue id lines (optional, ignored — we don't index by id)
 *  - Timestamp lines: `HH:MM:SS.mmm --> HH:MM:SS.mmm` (HH optional)
 *  - Multi-line cue payloads
 *  - NOTE blocks (skipped)
 *  - STYLE / REGION blocks (skipped)
 *  - Inline tags `<b>`, `<i>`, `<c.classname>`, `<v Speaker>` — preserved in
 *    the raw text, stripped for `parseVttSubtitles` output
 *
 * Does NOT support (intentionally — out of scope for the cue-list use cases):
 *  - `position:` and `vertical:` cue settings
 *  - Karaoke timestamps inside cue payloads
 *  - Right-to-left text shaping (the renderer's problem, not the parser's)
 */

const TIMESTAMP_LINE_RE = /^((?:\d{1,3}:)?\d{2}:\d{2}(?:\.\d{1,3})?)\s+-->\s+((?:\d{1,3}:)?\d{2}:\d{2}(?:\.\d{1,3})?)(\s+(?:\S.*)?)?$/;
const TAG_STRIP_RE = /<[^>]+>/g;
/** Strip everything except the inline tags renderers know how to draw safely:
 *  `<i>`, `<b>`, `<u>` (with closing variants). `<c.foo>`, `<v Speaker>`,
 *  `<ruby>`, `<rt>`, `<lang ...>`, and inline timestamp tags are removed so
 *  consumers using `buildSubtitleFragment` produce an identical DOM tree. */
const UNRECOGNISED_TAG_RE = /<\/?(?:c(?:\.[^>]*)?|v(?:\s[^>]*)?|ruby|rt|lang(?:\.[^>]*)?)>/gi;
const TIMESTAMP_TAG_RE = /<\d{2}:\d{2}:\d{2}\.\d{3}>/g;
const SPRITE_FRAGMENT_RE = /^([^#]+)#xywh=(-?\d+),(-?\d+),(\d+),(\d+)$/;

interface CueSettings {
	linePosition?: number;
	alignment?: 'start' | 'center' | 'end';
	size?: number;
}

interface RawCue {
	start: number;
	end: number;
	body: string;
	settings: CueSettings;
}

/** Low-level: returns cues whose payload is the raw text body (no inline-tag stripping). */
export function parseVtt(text: string): CueList<string> {
	const raw = parseRaw(text);
	return createCueList(raw.map(c => ({
		start: c.start,
		end: c.end,
		payload: c.body,
	})));
}

/**
 * Subtitle consumers: returns cues with both a plain `text` field and a
 * `markup` field that preserves the renderer-safe inline tags (`<i>`, `<b>`,
 * `<u>`). Cue settings on the timing line (`align:`, `line:`, `size:`) are
 * also surfaced so renderers can reproduce per-cue positioning without
 * re-parsing the source.
 */
export function parseVttSubtitles(text: string): CueList<VTTSubtitlePayload> {
	const raw = parseRaw(text);
	return createCueList<VTTSubtitlePayload>(raw.map((c) => {
		const cleaned = c.body.replace(TAG_STRIP_RE, '').trim();
		// Markup keeps `<i>` / `<b>` / `<u>` for the renderer; everything else
		// is dropped at parse time so consumers never need to re-sanitise.
		const markup = c.body
			.replace(TIMESTAMP_TAG_RE, '')
			.replace(UNRECOGNISED_TAG_RE, '')
			.trim();
		const styles: VTTSubtitlePayload['styles'] = {};
		if (/<b>/.test(c.body))
			styles.bold = true;
		if (/<i>/.test(c.body))
			styles.italic = true;
		const colorClassMatch = c.body.match(/<c\.([\w-]+)>/);
		if (colorClassMatch)
			styles.color = colorClassMatch[1];
		const payload: VTTSubtitlePayload = { text: cleaned };
		if (markup && markup !== cleaned)
			payload.markup = markup;
		else if (cleaned)
			payload.markup = cleaned;
		if (Object.keys(styles).length > 0)
			payload.styles = styles;
		if (c.settings.linePosition !== undefined)
			payload.linePosition = c.settings.linePosition;
		if (c.settings.alignment !== undefined)
			payload.alignment = c.settings.alignment;
		if (c.settings.size !== undefined)
			payload.size = c.settings.size;
		return {
			start: c.start,
			end: c.end,
			payload,
		};
	}));
}

/**
 * Sprite VTT consumers: cue body is a URL with `#xywh=x,y,w,h` fragment.
 * Optional `baseUrl` is prepended for relative paths.
 */
export function parseVttSprite(text: string, baseUrl?: string): CueList<VTTSpritePayload> {
	const raw = parseRaw(text);
	const cues: Cue<VTTSpritePayload>[] = [];

	for (const c of raw) {
		const m = c.body.trim().match(SPRITE_FRAGMENT_RE);
		if (!m)
			continue; // skip cues that aren't sprite-formatted
		const url = m[1]!;
		cues.push({
			start: c.start,
			end: c.end,
			payload: {
				url: baseUrl && !url.match(/^https?:\/\//) ? joinUrl(baseUrl, url) : url,
				x: Number.parseInt(m[2]!, 10),
				y: Number.parseInt(m[3]!, 10),
				w: Number.parseInt(m[4]!, 10),
				h: Number.parseInt(m[5]!, 10),
			},
		});
	}

	return createCueList(cues);
}

// ─────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────

function parseRaw(text: string): RawCue[] {
	if (!text)
		return [];

	// Strip UTF-8 BOM if present (W3C WebVTT 1.0 §4 — many editors save with BOM).
	const stripped = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

	const normalized = stripped.replace(/\r\n|\r/g, '\n');
	const blocks = normalized.split(/\n{2,}/);

	if (blocks.length === 0)
		return [];

	// First block must contain WEBVTT magic. Per W3C WebVTT 1.0 §4, the
	// "WEBVTT" string must be followed by a U+0020 SPACE, U+0009 TAB, end of
	// line, or end of file — `WEBVTTfoo` is NOT valid.
	const first = blocks[0]?.trim();
	if (!first)
		return [];
	if (first === 'WEBVTT') {
		// ok
	}
	else if (first.startsWith('WEBVTT ') || first.startsWith('WEBVTT\t') || first.startsWith('WEBVTT\n')) {
		// "WEBVTT - description" / tab / newline variants — valid header forms.
	}
	else {
		return [];
	}

	const cues: RawCue[] = [];

	for (let i = 1; i < blocks.length; i++) {
		const block = blocks[i]?.trim();
		if (!block)
			continue;

		if (block.startsWith('NOTE') || block.startsWith('STYLE') || block.startsWith('REGION'))
			continue;

		const lines = block.split('\n');
		// Find the timestamp line — it's either line 0 or line 1 (cue id is optional)
		let tsLineIdx = -1;
		let tsMatch: RegExpExecArray | null = null;
		for (let j = 0; j < Math.min(2, lines.length); j++) {
			const m = TIMESTAMP_LINE_RE.exec(lines[j]!);
			if (m) {
				tsLineIdx = j;
				tsMatch = m as RegExpExecArray;
				break;
			}
		}
		if (tsLineIdx < 0 || !tsMatch)
			continue;

		const start = parseTimestamp(tsMatch[1]!);
		const end = parseTimestamp(tsMatch[2]!);
		if (Number.isNaN(start) || Number.isNaN(end))
			continue;

		// W3C WebVTT 1.0 §5.5 — cue settings on the same timing line (`align:start line:50%`).
		const settings = parseCueSettings(tsMatch[3]);

		const body = lines.slice(tsLineIdx + 1).join('\n')
.trim();
		cues.push({
			start,
			end,
			body,
			settings,
		});
	}

	return cues;
}

/**
 * Parse the cue-settings string that follows the end timestamp on a WebVTT
 * timing line (W3C WebVTT 1.0 §5.5). Recognises `align`, `line`, and `size`.
 * `vertical:` and `position:` are intentionally dropped — out of scope for the
 * cue-list use cases.
 *
 * Numeric settings tolerate either `50` or `50%`; the trailing `%` is optional
 * in legacy files. Unrecognised values are dropped silently so a malformed cue
 * still renders centred at the safe-area baseline.
 */
function parseCueSettings(raw: string | undefined): CueSettings {
	const out: CueSettings = {};
	if (!raw)
		return out;
	const tokens = raw.trim().split(/\s+/);
	for (const tok of tokens) {
		if (!tok)
			continue;
		const sep = tok.indexOf(':');
		if (sep < 0)
			continue;
		const key = tok.slice(0, sep).toLowerCase();
		const value = tok.slice(sep + 1);

		if (key === 'align') {
			const v = value.toLowerCase();
			if (v === 'start' || v === 'left')
				out.alignment = 'start';
			else if (v === 'end' || v === 'right')
				out.alignment = 'end';
			else if (v === 'center' || v === 'middle' || v === 'centre')
				out.alignment = 'center';
		}
		else if (key === 'line') {
			// `line:auto` and line numbers (negative integers) aren't meaningful
			// here — only honour percent values 0–100.
			const n = parsePercent(value);
			if (n !== null)
				out.linePosition = n;
		}
		else if (key === 'size') {
			const n = parsePercent(value);
			if (n !== null)
				out.size = n;
		}
	}
	return out;
}

function parsePercent(raw: string): number | null {
	const m = raw.match(/^(-?\d+(?:\.\d+)?)%?$/);
	if (!m)
		return null;
	const n = Number(m[1]);
	if (!Number.isFinite(n) || n < 0 || n > 100)
		return null;
	return n;
}

function parseTimestamp(ts: string): number {
	// Accepts HH:MM:SS.mmm or MM:SS.mmm (HH optional)
	const parts = ts.split(':');
	let h = 0; let m = 0; let s = 0;
	if (parts.length === 3) {
		h = Number.parseInt(parts[0]!, 10);
		m = Number.parseInt(parts[1]!, 10);
		s = Number.parseFloat(parts[2]!);
	}
	else if (parts.length === 2) {
		m = Number.parseInt(parts[0]!, 10);
		s = Number.parseFloat(parts[1]!);
	}
	else {
		return Number.NaN;
	}
	return h * 3600 + m * 60 + s;
}

function joinUrl(base: string, relative: string): string {
	if (relative.startsWith('/')) {
		const baseOrigin = base.match(/^https?:\/\/[^/]+/)?.[0];
		return baseOrigin ? baseOrigin + relative : relative;
	}
	const baseDir = base.replace(/[^/]*$/, '');
	return baseDir + relative;
}
