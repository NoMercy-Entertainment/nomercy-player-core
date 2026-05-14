import type { Internals } from '../state';


export function disposeSidecarSubtitle(self: Internals): void {
	const ctx = self._sidecarSubtitle;
	if (!ctx) return;
	try { ctx.tracker.dispose(); }
	catch { /* defensive */ }
	self._sidecarSubtitle = undefined;
}
