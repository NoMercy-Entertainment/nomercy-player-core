import type { AttemptCtx, Outcome } from './types';

/**
 * Decode a successful response body per `ctx.responseType`. Returns a `'value'`
 * outcome on success, or a `'throw'` outcome wrapping the parse failure.
 *
 * `'text'` is the default; an optional `ctx.parser` post-processes the string
 * (e.g. JSON.parse, custom format). Parser exceptions and malformed JSON both
 * surface as `core:network/parse-failed` so consumers can catch the class.
 */
export async function decodeBody<T>(response: Response, ctx: AttemptCtx<T>): Promise<Outcome<T>> {
	if (ctx.responseType === 'arrayBuffer') {
		const buffer = await response.arrayBuffer();
		return {
			kind: 'value',
			value: buffer as unknown as T,
		};
	}

	if (ctx.responseType === 'json') {
		try {
			const parsed = await response.json() as T;
			return {
				kind: 'value',
				value: parsed,
			};
		}
		catch (parseErr) {
			return {
				kind: 'throw',
				error: ctx.netErr('core:network/parse-failed', response.status, 'response body is not valid JSON', parseErr),
			};
		}
	}

	const text = await response.text();

	if (ctx.parser) {
		try {
			return {
				kind: 'value',
				value: ctx.parser(text),
			};
		}
		catch (parseErr) {
			return {
				kind: 'throw',
				error: ctx.netErr('core:network/parse-failed', response.status, 'response parser threw', parseErr),
			};
		}
	}

	return {
		kind: 'value',
		value: text as unknown as T,
	};
}
