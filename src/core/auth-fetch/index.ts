/**
 * Auth-aware fetch shared by `Plugin.fetch()` and the player core's setup-time
 * playlist URL load.
 *
 * Implementation lives in three layers:
 *  - `prepare`      — builds a per-call context bag (closures, factories, budgets).
 *  - `attempt`      — one fetch + classify + decode pass, returns an `Outcome`.
 *  - `orchestrator` — bounded retry loop that consumes outcomes.
 *
 * Public entry point is `authFetch` from the orchestrator.
 */
import { AuthError, NetworkError } from '../../errors';

export { authFetch } from './orchestrator';
export type { AuthFetchOptions } from './types';

/** Type guard helper exposed for player + plugin code that needs to inspect errors. */
export function isAuthError(err: unknown): err is AuthError {
	return err instanceof AuthError;
}

/** Type guard helper exposed for player + plugin code that needs to inspect errors. */
export function isNetworkError(err: unknown): err is NetworkError {
	return err instanceof NetworkError;
}
