import type { Cue, CueList } from '../cue';
import { createCueList } from '../cue';

export interface LrcWordCue {
	start: number;
	text: string;
}

export interface LrcPayload {
	text: string;
	words?: LrcWordCue[];
}

/**
 * LRC + enhanced LRC parser.
 *
 * Plain LRC line:        `[mm:ss.xx]line text`
 * Enhanced (word-level): `[mm:ss.xx]<mm:ss.xx>word <mm:ss.xx>word <mm:ss.xx>word`
 * Multi-timestamp line:  `[00:10.50][01:30.50]chorus repeats — emit one cue per timestamp`
 * Metadata tags:         `[ar:Artist]`, `[ti:Title]`, `[al:Album]`, `[length:mm:ss]` — ignored for the cue list
 *
 * Cue end times are derived from the start of the next cue. The last cue's end
 * defaults to its start + 5 seconds since LRC has no end-time field.
 */

// Match a leading [mm:ss.xx] or [mm:ss] or [mm:ss.xxx]
const TIMESTAMP_RE = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;
// Detect metadata tags like [ar:...] [ti:...] — letter-prefixed contents
const METADATA_TAG_RE = /^\[[a-z]+:[^\]]*\]$/i;
// Word-level timestamp inside a cue body: <mm:ss.xx>
const WORD_TIMESTAMP_RE = /<(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?>/g;

const DEFAULT_TRAILING_DURATION = 5; // seconds added to the last cue's end

export function parseLrc(text: string): CueList<LrcPayload> {
	if (!text)
		return createCueList<LrcPayload>([]);

	const rawCues: { start: number; payload: LrcPayload }[] = [];

	for (const line of text.split(/\r\n|\r|\n/)) {
		const trimmed = line.trim();
		if (!trimmed)
			continue;

		// Skip metadata tags entirely — `[ar:Some Artist]` is not a cue.
		// Metadata tags have a letter immediately after `[`, whereas cue
		// timestamps are digits.
		if (METADATA_TAG_RE.test(trimmed))
			continue;

		// Collect ALL leading timestamps — one line can have several when the
		// same lyric repeats at multiple times (chorus pattern).
		const timestamps: number[] = [];
		TIMESTAMP_RE.lastIndex = 0;
		let lastEnd = 0;

		// `RegExp.exec` with the global flag is the canonical sequential-match
		// idiom. Hoist the assignment out of the loop condition so the no-
		// cond-assign rule stays satisfied without a disable comment.
		for (
			let match = TIMESTAMP_RE.exec(trimmed);
			match !== null;
			match = TIMESTAMP_RE.exec(trimmed)
		) {
			// Only treat as a leading timestamp if it's contiguous from `lastEnd`
			// (i.e. no non-bracket characters between them).
			if (match.index !== lastEnd)
				break;
			timestamps.push(toSeconds(match[1]!, match[2]!, match[3]));
			lastEnd = match.index + match[0].length;
		}

		if (timestamps.length === 0)
			continue; // no cue here, skip

		const body = trimmed.slice(lastEnd);
		const payload = parseBodyForWords(body);

		for (const start of timestamps) {
			rawCues.push({
				start,
				payload,
			});
		}
	}

	// Sort by start, then derive end from the next cue's start.
	rawCues.sort((a, b) => a.start - b.start);

	const cues: Cue<LrcPayload>[] = rawCues.map((cue, idx) => {
		const nextStart = rawCues[idx + 1]?.start;
		const end = nextStart !== undefined ? nextStart : cue.start + DEFAULT_TRAILING_DURATION;
		return {
			start: cue.start,
			end,
			payload: cue.payload,
		};
	});

	return createCueList(cues);
}

function parseBodyForWords(body: string): LrcPayload {
	WORD_TIMESTAMP_RE.lastIndex = 0;

	if (!body.includes('<')) {
		return { text: body };
	}

	const words: LrcWordCue[] = [];
	let plainText = '';
	let cursor = 0;

	for (
		let match = WORD_TIMESTAMP_RE.exec(body);
		match !== null;
		match = WORD_TIMESTAMP_RE.exec(body)
	) {
		// Text between previous tag (or start) and this tag belongs to the
		// previous timestamp's word; if no previous, it's pre-tag text we keep.
		const between = body.slice(cursor, match.index);
		if (words.length > 0 && between) {
			words[words.length - 1]!.text = between.trim();
		}
		else {
			plainText += between;
		}

		const ts = toSeconds(match[1]!, match[2]!, match[3]);
		words.push({
			start: ts,
			text: '',
		});
		cursor = match.index + match[0].length;
	}

	// Trailing text after the last word-timestamp belongs to the last word
	const trailing = body.slice(cursor);
	if (words.length > 0 && trailing) {
		words[words.length - 1]!.text = trailing.trim();
	}
	else if (trailing) {
		plainText += trailing;
	}

	// Pull the conditional INSIDE the trim() call so the chain depth on any
	// branch stays at 2 (`map().join()` or just `plainText`) — that keeps
	// `style/newline-per-chained-call` happy without breaking layout.
	const source = words.length > 0 ? words.map(w => w.text).join(' ') : plainText;
	const text = source.trim();

	return words.length > 0
		? {
				text,
				words,
			}
		: { text };
}

function toSeconds(mmStr: string, ssStr: string, fracStr?: string): number {
	const mm = Number.parseInt(mmStr, 10);
	const ss = Number.parseInt(ssStr, 10);
	let frac = 0;
	if (fracStr) {
		// Pad/truncate to 3 digits for ms, then divide by 1000
		const padded = fracStr.length === 3 ? fracStr : fracStr.length === 2 ? `${fracStr}0` : fracStr.length === 1 ? `${fracStr}00` : fracStr.slice(0, 3);
		frac = Number.parseInt(padded, 10) / 1000;
	}
	return mm * 60 + ss + frac;
}
