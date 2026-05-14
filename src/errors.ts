/**
 * Error framework — typed hierarchy, severity tiers, scoped events, retry
 * policy, structured plugin throws, code helpers.
 *
 * String codes (`core:auth/forbidden`, `fillz:viz/canvas-init-failed`) are the
 * universal identifier and always work. Numeric ids built via `makeCode({...})`
 * are supplementary and opt-in.
 */

// ──────────────────────────────────────────────────────────────────────────
// Severity
// ──────────────────────────────────────────────────────────────────────────

/** Literal union for typo-safe severity. */
export type Severity = 'fatal' | 'error' | 'warning' | 'info';

/**
 * Runtime constants — paired with the Severity type via `as const` so
 * consumers who prefer constant comparisons get them, while typing stays
 * a clean literal union.
 */
export const SEVERITY = {
	FATAL: 'fatal',
	ERROR: 'error',
	WARNING: 'warning',
	INFO: 'info',
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Scope
// ──────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────
// Numeric code helpers — encourage registry use without forcing it
// ──────────────────────────────────────────────────────────────────────────

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

/** Map literal severity string → 1/2/3/4 used in numeric codes. */
export const SEVERITY_LEVEL: Record<Severity, 1 | 2 | 3 | 4> = {
	info: 1,
	warning: 2,
	error: 3,
	fatal: 4,
};

/** Reserved vendor block ids. */
export const VENDOR = {
	KIT: 1,
	MUSIC: 2,
	VIDEO: 3,
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Error class hierarchy
// ──────────────────────────────────────────────────────────────────────────

export interface PlayerErrorInit {
	code: string;
	id?: number;
	severity?: Severity;
	scope: ErrorScope;
	message?: string;
	cause?: unknown;
	context?: Record<string, unknown>;
	/**
	 * Best-effort actionable hint for the consumer's UI / for the user.
	 *
	 * Examples:
	 *  - HEVC unsupported in Firefox: "HEVC requires a Chromium-based browser
	 *    with the codec installed. Try Chrome, Edge, or Brave."
	 *  - Autoplay blocked: "Tap or click anywhere to start playback."
	 *  - 403: "Your account doesn't have access to this content."
	 *  - 5xx: "The server is having issues. Try again in a moment."
	 *
	 * Default suggestions live in the registry per code; consumers can override
	 * at construction. Always present-tense and actionable when possible —
	 * never "an error has occurred".
	 */
	suggestion?: string;
}

/**
 * Base error class. All kit + plugin errors descend from this. Carries:
 *  - `code`   — string id, always present (`core:auth/forbidden`, `fillz:viz/...`)
 *  - `id`     — optional numeric id from the registry
 *  - `scope`  — discriminated union
 *  - `severity` — fatal/error/warning/info
 *  - `cause`  — chained underlying error (any type)
 *  - `context` — current track id, time, url, status, etc.
 */
export class PlayerError extends Error {
	override readonly name: string = 'PlayerError';
	readonly code: string;
	readonly id?: number;
	readonly severity: Severity;
	readonly scope: ErrorScope;
	override readonly cause?: unknown;
	readonly context?: Record<string, unknown>;
	readonly suggestion?: string;

	constructor(init: PlayerErrorInit) {
		super(init.message ?? init.code);
		this.code = init.code;
		this.id = init.id;
		this.severity = init.severity ?? 'error';
		this.scope = init.scope;
		this.cause = init.cause;
		this.context = init.context;
		this.suggestion = init.suggestion;
	}

	/** True if context.httpStatus is in the requested 1xx-5xx century. */
	isHttp(century: 1 | 2 | 3 | 4 | 5): boolean {
		const s = this.context?.['httpStatus'];
		return typeof s === 'number' && s >= century * 100 && s < (century + 1) * 100;
	}
}

export class NetworkError extends PlayerError {
	override readonly name: string = 'NetworkError';
}

export class AuthError extends NetworkError {
	override readonly name: string = 'AuthError';
}

export class MediaFormatError extends PlayerError {
	override readonly name = 'MediaFormatError';
}

export class StreamError extends PlayerError {
	override readonly name = 'StreamError';
}

export class DrmError extends PlayerError {
	override readonly name = 'DrmError';
}

export class BrowserPolicyError extends PlayerError {
	override readonly name = 'BrowserPolicyError';
}

export class StateError extends PlayerError {
	override readonly name = 'StateError';
}

export class PluginError extends PlayerError {
	override readonly name = 'PluginError';
}

export class ResourceError extends PlayerError {
	override readonly name = 'ResourceError';
}

// ──────────────────────────────────────────────────────────────────────────
// Error events
// ──────────────────────────────────────────────────────────────────────────

/**
 * Event payload delivered to `'fatal' | 'error' | 'warning' | 'info'`
 * listeners. Provides DOM-style propagation control:
 *
 *  - `markHandled()`            — kit shuts up; other handlers still run
 *  - `stopImmediatePropagation()`— other handlers do NOT fire for this event
 *  - `preventDefault()`         — kit-side default action (e.g. auto-retry) is suppressed
 */
export interface PlayerErrorEvent {
	error: PlayerError;
	severity: Severity;
	scope: ErrorScope;
	timestamp: number;

	markHandled(): void;
	isHandled(): boolean;
	stopImmediatePropagation(): void;
	isPropagationStopped(): boolean;
	preventDefault(): void;
	isDefaultPrevented(): boolean;
}

/**
 * Build a `PlayerErrorEvent` payload around an existing `PlayerError`.
 *
 * Wraps the error in the cancellable-event shape that `'fatal'` / `'error'` /
 * `'warning'` / `'info'` listeners expect: per-event state (`isHandled`,
 * `isPropagationStopped`, `isDefaultPrevented`) lives in closure-bound flags,
 * and the corresponding `markHandled` / `stopImmediatePropagation` /
 * `preventDefault` mutators flip them. Listeners that don't call those
 * methods get classic fire-and-forget behaviour.
 */
export function makePlayerErrorEvent(
	error: PlayerError,
	severity: Severity,
	scope: ErrorScope,
	timestamp: number = Date.now(),
): PlayerErrorEvent {
	let handled = false;
	let propagationStopped = false;
	let defaultPrevented = false;
	return {
		error,
		severity,
		scope,
		timestamp,
		markHandled: () => { handled = true; },
		isHandled: () => handled,
		stopImmediatePropagation: () => { propagationStopped = true; },
		isPropagationStopped: () => propagationStopped,
		preventDefault: () => { defaultPrevented = true; },
		isDefaultPrevented: () => defaultPrevented,
	};
}


// ──────────────────────────────────────────────────────────────────────────
// Factory functions — kit-internal helpers for the common throw shape.
// All apply `severity: 'error'`, `scope: { kind: 'core' }`, and prefix the
// human message with the code so logs are self-identifying.
// ──────────────────────────────────────────────────────────────────────────

export function stateError(code: string, message: string, context?: Record<string, unknown>): StateError {
	return new StateError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}

export function resourceError(code: string, message: string, context?: Record<string, unknown>): ResourceError {
	return new ResourceError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}

export function browserPolicyError(
	code: string,
	message: string,
	opts?: {
		suggestion?: string;
		context?: Record<string, unknown>;
	},
): BrowserPolicyError {
	return new BrowserPolicyError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		suggestion: opts?.suggestion,
		context: opts?.context,
	});
}

export function mediaFormatError(code: string, message: string, context?: Record<string, unknown>): MediaFormatError {
	return new MediaFormatError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}

export function pluginError(
	code: string,
	message: string,
	opts?: {
		severity?: Severity;
		pluginId?: string;
		context?: Record<string, unknown>;
	},
): PluginError {
	return new PluginError({
		code,
		severity: opts?.severity ?? 'error',
		scope: opts?.pluginId
			? { kind: 'plugin', id: opts.pluginId }
			: { kind: 'core' },
		message: `${code}: ${message}`,
		context: opts?.context,
	});
}


// ──────────────────────────────────────────────────────────────────────────
// Retry policy
// ──────────────────────────────────────────────────────────────────────────

export interface RetryConfig {
	attempts: number;
	backoff?: 'linear' | 'exponential';
	baseMs?: number;
	maxMs?: number;
	refreshFirst?: boolean;
}

/**
 * Map keyed by error code OR HTTP-range matcher. Resolution order, most
 * specific wins:
 *   1. Exact code:        `'core:auth/forbidden'`
 *   2. Category prefix:   `'core:auth/'`
 *   3. HTTP range:        `'4xx'` | `'5xx'`
 *   4. Wildcard fallback: `'*'`
 */
export type RetryPolicy = Record<string, RetryConfig>;

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
	'core:network/timeout': {
		attempts: 5,
		backoff: 'exponential',
		baseMs: 500,
		maxMs: 30_000,
	},
	'core:network/server-error': {
		attempts: 3,
		backoff: 'exponential',
		baseMs: 500,
		maxMs: 10_000,
	},
	'core:stream/fragment-failed': {
		attempts: 5,
		backoff: 'linear',
		baseMs: 200,
		maxMs: 5_000,
	},
	'core:auth/unauthenticated': {
		attempts: 1,
		refreshFirst: true,
	},
	'core:auth/forbidden': { attempts: 0 },
	'core:media/codec-unsupported': { attempts: 0 },
	// HTMLMediaElement MediaError.code mappings (forwarded by html5VideoBackend).
	// aborted: user or browser aborted the resource fetch — no retry.
	'media/aborted': { attempts: 0 },
	// network: fetch failed mid-stream — retry with back-off.
	'media/network': {
		attempts: 3,
		backoff: 'exponential',
		baseMs: 1_000,
		maxMs: 8_000,
	},
	// decode error on the current rendition — try next rendition, no generic retry.
	'media/decode-fatal-variant': { attempts: 0 },
	// decode error across all renditions / format unsupported — no recovery.
	'media/decode-fatal-all': { attempts: 0 },
	'core:state/queue-empty': { attempts: 0 },
	'4xx': { attempts: 0 },
	'5xx': {
		attempts: 3,
		backoff: 'exponential',
		baseMs: 500,
		maxMs: 10_000,
	},
	'*': { attempts: 0 },
};
