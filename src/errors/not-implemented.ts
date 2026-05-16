import { PlayerError } from './player';

/**
 * Thrown when a method exists in the public contract but the current backend
 * or library does not support it. Consumers can catch by code:
 *
 * ```ts
 * try { player.subtitles(); }
 * catch (e) {
 *   if (e instanceof NotImplementedError) { ... }
 * }
 * ```
 *
 * Code always follows `core:not-implemented/<feature>`.
 */
export class NotImplementedError extends PlayerError {
	override readonly name = 'NotImplementedError';

	constructor(message: string, feature?: string) {
		const code = feature ? `core:not-implemented/${feature}` : 'core:not-implemented';
		super({
			code,
			severity: 'error',
			scope: { kind: 'core' },
			message,
		});
	}
}
