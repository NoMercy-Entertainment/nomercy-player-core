import type { ErrorScope } from './code';
import type { Severity } from './severity';

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
 * Thrown when a method is called at the wrong lifecycle phase — e.g. `play()`
 * during `'disposed'`, or `seek()` before `'ready'`. Codes follow
 * `core:state/<reason>`. Use `stateError()` to construct.
 */
export class StateError extends PlayerError {
	override readonly name = 'StateError';
}

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

/**
 * Construct a `StateError` scoped to the core with `severity: 'error'`.
 *
 * Use when a method is called at the wrong lifecycle phase or with invalid
 * internal state. The log message is auto-prefixed with `code` so grep-friendly
 * without needing the full `PlayerErrorInit` shape.
 *
 * Code convention: `core:state/<reason>` — e.g. `core:state/queue-empty`.
 */
export function stateError(
	code: string,
	message: string,
	context?: Record<string, unknown>,
): StateError {
	return new StateError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}
