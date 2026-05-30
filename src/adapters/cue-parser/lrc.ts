import type { Cue, CueList } from '../../core/cues/cue';
import { createCueList } from '../../core/cues/cue';

/** A single word entry in an enhanced LRC cue, with its start timestamp. */
export interface LrcWordCue {
	start: number;
	text: string;
}

/**
 * Payload for a single LRC cue. `text` is always present; `words` is populated
 * only for enhanced LRC lines that carry word-level timestamps.
 */
export interface LrcPayload {
	text: string;
	words?: LrcWordCue[];
}

const TIMESTAMP_RE = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;
const METADATA_TAG_RE = /^\[[a-z]+:[^\]]*\]$/i;
const WORD_TIMESTAMP_RE = /<(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?>/g;

const DEFAULT_TRAILING_DURATION = 5;

/**
 * Parse an LRC or enhanced LRC file into a time-indexed cue list.
 *
 * Plain LRC line:        `[mm:ss.xx]line text`
 * Enhanced (word-level): `[mm:ss.xx]<mm:ss.xx>word <mm:ss.xx>word`
 * Multi-timestamp line:  `[00:10.50][01:30.50]same text — emits one cue per timestamp`
 * Metadata tags:         `[ar:Artist]`, `[ti:Title]` — skipped, not part of the cue list
 *
 * End times are derived from the next cue's start. The last cue gets
 * `start + 5 s` because LRC has no end-time field.
 */
export function parseLrc(text: string): CueList<LrcPayload> {
	if (!text)
		return createCueList<LrcPayload>([]);

	const rawCues: { start: number; payload: LrcPayload }[] = [];

	for (const line of text.split(/\r\n|\r|\n/)) {
		const trimmed = line.trim();
		if (!trimmed)
			continue;

		// `[ar:...]` / `[ti:...]` have a letter after `[`; cue timestamps are digits.
		if (METADATA_TAG_RE.test(trimmed))
			continue;

		const timestamps: number[] = [];
		TIMESTAMP_RE.lastIndex = 0;
		let lastEnd = 0;

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
			continue;

		const body = trimmed.slice(lastEnd);
		const payload = parseBodyForWords(body);

		for (const start of timestamps) {
			rawCues.push({
				start,
				payload,
			});
		}
	}

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

	const trailing = body.slice(cursor);
	if (words.length > 0 && trailing) {
		words[words.length - 1]!.text = trailing.trim();
	}
	else if (trailing) {
		plainText += trailing;
	}

	const source = words.length > 0 ? words.map(word => word.text).join(' ') : plainText;
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
		let padded: string;
		if (fracStr.length === 3)
			padded = fracStr;
		else if (fracStr.length === 2)
			padded = `${fracStr}0`;
		else if (fracStr.length === 1)
			padded = `${fracStr}00`;
		else
			padded = fracStr.slice(0, 3);
		frac = Number.parseInt(padded, 10) / 1000;
	}
	return mm * 60 + ss + frac;
}
