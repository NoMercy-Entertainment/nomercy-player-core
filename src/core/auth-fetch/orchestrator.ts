import type { AuthFetchOptions } from './types';
import { attemptOnce, sleep } from './attempt';

import { prepareAttempt } from './prepare';

/**
 * Fetch a URL through the player's auth pipeline.
 *
 * Applies the consumer's `auth` config (URL transform, bearer token, per-call
 * and static headers, credentials, signRequest hook), then drives a bounded
 * retry loop over `attemptOnce`. The body is decoded per `opts.responseType`
 * and returned typed as `T`.
 *
 * Retry behaviour, in one sentence per branch:
 *  - 401 → invoke `auth.refreshOnUnauthenticated` once, retry without consuming an attempt slot.
 *  - 403 → throw `core:auth/forbidden` immediately, never refresh, never retry.
 *  - other 4xx → throw the matching `core:network/*` code, no retry.
 *  - 5xx / network / timeout → retry per `RetryConfig`, with the last error
 *    surfacing if the budget runs out.
 *
 * Observability is on by default: `fetch:start`, `fetch:retry`, `fetch:complete`
 * fire on the player bus (or `plugin:<id>:fetch:*` when called from a Plugin).
 * Pass `scope: 'silent'` to suppress.
 *
 * Throws `NetworkError` or `AuthError` only; both extend `PlayerError` and
 * carry `code`, `httpStatus`, `url`, and `cause` for inspection.
 */
export async function authFetch<T = string>(opts: AuthFetchOptions<T>): Promise<T> {
	const ctx = await prepareAttempt<T>(opts);

	ctx.dispatch('start', {
		url: ctx.url,
		pluginId: ctx.pluginId,
	});

	let attempt = 0;

	while (attempt < ctx.maxAttempts) {
		const outcome = await attemptOnce<T>(ctx, attempt + 1);

		if (outcome.kind === 'value') {
			ctx.complete(true, ctx.lastStatus);
			return outcome.value;
		}

		if (outcome.kind === 'throw') {
			ctx.complete(false, ctx.lastStatus);
			throw outcome.error;
		}

		ctx.dispatch('retry', {
			url: ctx.url,
			attempt: attempt + 1,
			reason: outcome.reason,
			delayMs: outcome.delayMs,
			pluginId: ctx.pluginId,
		});

		if (outcome.consumesAttempt) {
			attempt += 1;
		}

		await sleep(outcome.delayMs, ctx.signal);
	}

	ctx.complete(false, ctx.lastStatus);
	throw ctx.lastError ?? ctx.netErr('core:network/timeout', undefined, 'fetch retry budget exhausted');
}
