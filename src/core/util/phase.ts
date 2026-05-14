import type { PlayerPhase } from '../../types';
import type { Internals } from '../state';


export function transitionPhase(self: Internals, next: PlayerPhase): void {
	const from = self._phase;
	if (from === next)
		return;
	self._phase = next;

	self.emit('phase', {
		from,
		to: next,
	});
}
