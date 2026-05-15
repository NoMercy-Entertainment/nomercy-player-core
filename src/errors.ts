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

/**
 * Thrown when a network request fails — DNS failure, offline, CORS, TCP reset,
 * or any non-HTTP transport error. Subclasses (`AuthError`) narrow further.
 * Check `error.context.httpStatus` when an HTTP status is available.
 */
export class NetworkError extends PlayerError {
	override readonly name: string = 'NetworkError';
}

/**
 * Thrown on 401 (unauthenticated) or 403 (forbidden) HTTP responses. Extends
 * `NetworkError` so generic `instanceof NetworkError` catches still work. The
 * player's built-in retry policy runs `auth.refreshOnUnauthenticated()` on 401
 * before raising this class; 403 propagates immediately with `attempts: 0`.
 */
export class AuthError extends NetworkError {
	override readonly name: string = 'AuthError';
}

/**
 * Thrown when the browser cannot decode the media — unsupported codec, corrupt
 * container, or a format the current rendition cannot handle. Codes follow the
 * pattern `core:media/<reason>` (e.g. `core:media/codec-unsupported`). The
 * retry policy defaults to `attempts: 0`; ABR logic handles rendition fallback.
 */
export class MediaFormatError extends PlayerError {
	override readonly name = 'MediaFormatError';
}

/**
 * Thrown when a streaming pipeline fails — HLS fragment fetch, DASH segment
 * parse, or MSE `appendBuffer` rejection. Scope is always
 * `{ kind: 'stream', id: 'hls' | 'dash' | 'native' }`. Codes follow
 * `core:stream/<reason>`.
 */
export class StreamError extends PlayerError {
	override readonly name = 'StreamError';
}

/**
 * Thrown when a DRM operation fails — `requestMediaKeySystemAccess` denied,
 * license server returned an error, or key expiry. Scope is `{ kind: 'core' }`.
 * Codes follow `core:drm/<reason>`.
 */
export class DrmError extends PlayerError {
	override readonly name = 'DrmError';
}

/**
 * Thrown when the browser's autoplay policy, permissions API, or a similar
 * browser-enforced restriction blocks an action. The `suggestion` field carries
 * a user-readable hint (e.g. "Tap anywhere to start playback.").
 * Codes follow `core:policy/<reason>`. Use `browserPolicyError()` to construct.
 */
export class BrowserPolicyError extends PlayerError {
	override readonly name = 'BrowserPolicyError';
}

/**
 * Thrown when a method is called at the wrong lifecycle phase — e.g. `play()`
 * during `'disposed'`, or `seek()` before `'ready'`. Codes follow
 * `core:state/<reason>`. Use `stateError()` to construct.
 */
export class StateError extends PlayerError {
	override readonly name = 'StateError';
}

/**
 * Thrown when a plugin operation fails — registration errors, missing deps,
 * version mismatches, or plugin-internal faults surfaced through `this.throw()`.
 * Scope is `{ kind: 'plugin', id: '<plugin-id>' }` when the plugin id is known.
 * Use `pluginError()` to construct.
 */
export class PluginError extends PlayerError {
	override readonly name = 'PluginError';
}

/**
 * Thrown when a required resource cannot be loaded — a Web Worker, a WASM
 * module, a stylesheet, or a dynamically-imported chunk. Codes follow
 * `core:resource/<reason>`. Use `resourceError()` to construct.
 */
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

/**
 * Construct a `StateError` scoped to the core with `severity: 'error'`.
 *
 * Use when a method is called at the wrong lifecycle phase or with invalid
 * internal state. The log message is auto-prefixed with `code` so grep-friendly
 * without needing the full `PlayerErrorInit` shape.
 *
 * Code convention: `core:state/<reason>` — e.g. `core:state/queue-empty`.
 */
export function stateError(code: string, message: string, context?: Record<string, unknown>): StateError {
	return new StateError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}

/**
 * Construct a `ResourceError` scoped to the core with `severity: 'error'`.
 *
 * Use when a required resource (Worker, WASM binary, stylesheet, dynamic import)
 * cannot be loaded. The log message is auto-prefixed with `code`.
 *
 * Code convention: `core:resource/<reason>` — e.g. `core:resource/worker-init-failed`.
 */
export function resourceError(code: string, message: string, context?: Record<string, unknown>): ResourceError {
	return new ResourceError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}

/**
 * Construct a `BrowserPolicyError` scoped to the core with `severity: 'error'`.
 *
 * Use when the browser's autoplay policy, Permissions API, or a similar
 * browser-enforced restriction blocks an action. Pass `opts.suggestion` with a
 * present-tense user-facing hint — the UI layer is expected to display it.
 *
 * Code convention: `core:policy/<reason>` — e.g. `core:policy/autoplay-blocked`.
 */
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

/**
 * Construct a `MediaFormatError` scoped to the core with `severity: 'error'`.
 *
 * Use when the browser rejects a codec, container, or rendition. Pass diagnostic
 * data in `context` — at minimum the URL and (where available) the MIME type and
 * codec string.
 *
 * Code convention: `core:media/<reason>` — e.g. `core:media/codec-unsupported`.
 */
export function mediaFormatError(code: string, message: string, context?: Record<string, unknown>): MediaFormatError {
	return new MediaFormatError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}

/**
 * Construct a `PluginError` with an explicit `pluginId` scope.
 *
 * When `opts.pluginId` is supplied the scope becomes
 * `{ kind: 'plugin', id: opts.pluginId }`; otherwise it falls back to
 * `{ kind: 'core' }` for kit-internal plugin-system errors (e.g. missing dep,
 * duplicate id). Severity defaults to `'error'` but can be lowered to `'warning'`
 * or `'info'` for non-fatal advisory conditions.
 *
 * Code convention: `<pluginId>:<area>/<reason>` — e.g. `lyrics:parse/bad-lrc`.
 */
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

/**
 * Per-code retry behaviour. All fields except `attempts` are optional; omitting
 * `backoff` means no delay between retries (immediate). `refreshFirst: true`
 * runs the auth refresh flow before the first retry attempt — used for 401s.
 *
 * `attempts: 0` is the canonical "do not retry" value. The kit checks this before
 * scheduling any delay, so `baseMs` / `maxMs` are irrelevant when `attempts` is 0.
 */
export interface RetryConfig {
	attempts: number;
	backoff?: 'linear' | 'exponential';
	baseMs?: number;
	maxMs?: number;
	refreshFirst?: boolean;
}

/**
 * Map from error-code matcher to `RetryConfig`. The player and `authFetch` walk
 * this map on every error to find the most-specific matching rule. Resolution
 * order, most specific wins:
 *
 *   1. Exact code:        `'core:auth/forbidden'`
 *   2. Category prefix:   `'core:auth/'`
 *   3. HTTP range:        `'4xx'` | `'5xx'`
 *   4. Wildcard fallback: `'*'`
 *
 * Consumers pass a custom policy to `setup({ retryPolicy })` — it's merged over
 * `DEFAULT_RETRY_POLICY` so only the overridden codes need to appear.
 */
export type RetryPolicy = Record<string, RetryConfig>;

/**
 * Built-in retry defaults. Covers the common HTTP + media error codes out of the
 * box. Consumers override individual entries via `setup({ retryPolicy })`.
 * All defaults err on the side of fewer retries — noisy retries are worse than
 * a fast failure for debugging.
 */
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
