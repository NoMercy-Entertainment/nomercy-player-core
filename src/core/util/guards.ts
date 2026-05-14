import { runDispatchBefore } from '../../dispatch';
import type { BeforeDispatchOutcome } from '../../dispatch';
import { stateError } from '../errors';
import type { Internals } from '../state';


export function assertReady(self: Internals): void {
	if (self._phase === 'idle') {
		throw stateError('core:player/not-ready', 'Player has not been setup() yet.');
	}
	if (self._phase === 'disposed' || self._phase === 'disposing') {
		throw stateError('core:player/disposed', 'Player has been disposed.');
	}
}

/**
 * Thin adapter around the shared `runDispatchBefore` helper that resolves the
 * per-call `timeoutMs` from the player's `beforeEventTimeoutMs` config so the
 * kit and `Plugin.dispatchBefore` apply the same default.
 */
export async function dispatchBefore<TData>(self: Internals, beforeEvent: string, data: TData): Promise<BeforeDispatchOutcome<TData>> {
	const timeoutMs = self.options?.beforeEventTimeoutMs;
	return runDispatchBefore<TData>(self, beforeEvent, data, timeoutMs !== undefined ? { timeoutMs } : undefined);
}
