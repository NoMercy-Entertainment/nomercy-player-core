import type { RetryConfig, Severity } from '../errors';

/**
 * Structured throw payload. The kit handles the rest:
 *  - stamps `scope: { kind: 'plugin', id: this.id }`
 *  - resolves numeric `id` from registry if available
 *  - emits the appropriate event (`error` / `warning` / `info`,
 *    plus `plugin:error` / `plugin:warning`)
 *  - applies retry policy (this throw + override below)
 *  - falls back to console if no handler called `markHandled()`
 */
export interface ThrowPayload {
	code: string;
	severity?: Severity;
	message?: string;
	cause?: unknown;
	context?: Record<string, unknown>;
	suggestion?: string;
	/** Override per-throw retry policy. `null` disables retries entirely. */
	retry?: RetryConfig | null;
	/** Numeric id if registered. Optional — string code always works. */
	id?: number;
}

/**
 * Per-error recovery action. Configured per-plugin via `static onError`.
 */
export type PluginRecoveryAction = 'retry-once' | 'fallback' | 'disable' | 'ignore';

/**
 * Internally raised by `this.throw(...)` so the kit can identify structured
 * plugin throws vs raw exceptions. Plugin authors should not construct these
 * directly.
 */
export class PluginThrow extends Error {
	constructor(public readonly payload: ThrowPayload, public readonly pluginId: string) {
		super(payload.message ?? payload.code);
	}
}
