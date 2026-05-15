/**
 * Where an error came from. Discriminated union — TS narrows `id` based on
 * `kind`. Plugin ids are vendored: bare names (`'lyrics'`) are kit-implicit
 * core; explicit `<vendor>:<name>` for everything else.
 */
export type ErrorScope
	= | { kind: 'core' }
		| { kind: 'backend'; id: 'audio-element' | 'webaudio' | 'video' | 'html5' | 'mse' | 'webcodecs' }
		| { kind: 'stream'; id: 'native' | 'hls' | 'dash' }
		| { kind: 'cue'; id: 'lrc' | 'vtt' | 'sprite-vtt' | 'ttml' }
		| { kind: 'network' }
		| { kind: 'auth' }
		| { kind: 'plugin'; id: string };

/**
 * 8-digit positional schema:
 *
 *   V V V  S  C C  E E
 *   └─┬─┘  │  └┬┘  └┬┘
 *     │    │   │    └── event   (00-99)
 *     │    │   └─────── category (00-99)
 *     │    └─────────── severity (1=info, 2=warning, 3=error, 4=fatal)
 *     └──────────────── vendor   (000-999)
 *
 * Plugin authors register a vendor block via PR to the kit's registry, OR
 * skip registration entirely and live on string codes.
 */
export interface CodeFields {
	vendor: number;
	severity: 1 | 2 | 3 | 4;
	category: number;
	event: number;
}

/** Build an 8-digit numeric code from positional fields. */
export function makeCode(fields: CodeFields): number {
	const {
		vendor,
		severity,
		category,
		event,
	} = fields;
	if (vendor < 0 || vendor > 999)
		throw new RangeError(`vendor ${vendor} out of range`);
	if (category < 0 || category > 99)
		throw new RangeError(`category ${category} out of range`);
	if (event < 0 || event > 99)
		throw new RangeError(`event ${event} out of range`);
	return vendor * 100_000 + severity * 10_000 + category * 100 + event;
}

/** Decompose a numeric code back into fields. */
export function parseCode(code: number): CodeFields {
	return {
		vendor: Math.floor(code / 100_000),
		severity: Math.floor((code % 100_000) / 10_000) as 1 | 2 | 3 | 4,
		category: Math.floor((code % 10_000) / 100),
		event: code % 100,
	};
}

/** Render numeric code as zero-padded 8-character string for logs. */
export function formatCode(code: number): string {
	return code.toString().padStart(8, '0');
}

/** Reserved vendor block ids. */
export const VENDOR = {
	KIT: 1,
	MUSIC: 2,
	VIDEO: 3,
} as const;
