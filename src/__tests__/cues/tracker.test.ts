/**
 * CueTracker tests — time-driven cue dispatcher used by lyrics, subtitles,
 * sprite previews. Subscribes to a player's `time` and `seek` events; emits
 * `enter` / `exit` for cues as they activate.
 *
 * Test groups:
 *  - Construction (id generation, options)
 *  - attach() / detach() — wires / unwires player listeners
 *  - Time updates — enters new active cues, exits departed ones
 *  - Seek discontinuity — exits all active, enters new active
 *  - Tolerance — picks up upcoming cues within tolerance window
 *  - suspend() / resume()
 *  - history(n) — recent cues, capped at historyMax
 *  - Re-emit on player's `cue:enter` / `cue:exit`
 *  - dispose() — emits exit for active cues
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCueList } from '../../cues/cue';
import { CueTracker } from '../../cues/tracker';
import { StubPlayer } from '../../testing/stub-player';

interface CueData { text: string }

function makeList() {
	return createCueList<CueData>([
		{ start: 0, end: 5, payload: { text: 'A' } },
		{ start: 10, end: 15, payload: { text: 'B' } },
		{ start: 20, end: 25, payload: { text: 'C' } },
	]);
}

describe('CueTracker', () => {
	let player: StubPlayer;

	beforeEach(() => {
		player = new StubPlayer();
	});

	afterEach(() => {
		player.reset();
	});

	describe('construction', () => {
		it('generates a tracker id when none supplied', () => {
			const tracker = new CueTracker(makeList());
			expect(tracker.trackerId).toMatch(/^tracker-/);
			tracker.dispose();
		});

		it('honors explicit trackerId', () => {
			const tracker = new CueTracker(makeList(), { trackerId: 'lyrics' });
			expect(tracker.trackerId).toBe('lyrics');
			tracker.dispose();
		});
	});

	describe('attach() / detach()', () => {
		it('attach wires up time + seek listeners on the player', () => {
			const tracker = new CueTracker(makeList());
			const beforeCount = (player as unknown as { listenerCount: () => number }).listenerCount();
			tracker.attach(player);
			const afterCount = (player as unknown as { listenerCount: () => number }).listenerCount();
			expect(afterCount).toBeGreaterThan(beforeCount);
			tracker.dispose();
		});

		it('detach removes the listeners', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			const attached = (player as unknown as { listenerCount: () => number }).listenerCount();
			tracker.detach();
			const detached = (player as unknown as { listenerCount: () => number }).listenerCount();
			expect(detached).toBeLessThan(attached);
			tracker.dispose();
		});

		it('detach is safe when not attached', () => {
			const tracker = new CueTracker(makeList());
			expect(() => tracker.detach()).not.toThrow();
			tracker.dispose();
		});
	});

	describe('time updates — enter / exit dispatch', () => {
		it('emits enter when entering a cue interval', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			const enter = vi.fn();
			tracker.on('enter', enter);
			player.emit('time', { time: 2 });
			expect(enter).toHaveBeenCalledTimes(1);
			expect(enter.mock.calls[0]![0].payload.text).toBe('A');
			tracker.dispose();
		});

		it('does NOT emit exit on first entry', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			const exit = vi.fn();
			tracker.on('exit', exit);
			player.emit('time', { time: 2 });
			expect(exit).not.toHaveBeenCalled();
			tracker.dispose();
		});

		it('emits exit when leaving a cue interval', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			const exit = vi.fn();
			tracker.on('exit', exit);
			player.emit('time', { time: 2 }); // enter A
			player.emit('time', { time: 7 }); // exit A (between 5 and 10)
			expect(exit).toHaveBeenCalledTimes(1);
			tracker.dispose();
		});

		it('handles transitioning directly from one cue to another', () => {
			const adjacent = createCueList<CueData>([
				{ start: 0, end: 10, payload: { text: 'A' } },
				{ start: 10, end: 20, payload: { text: 'B' } },
			]);
			const tracker = new CueTracker(adjacent);
			tracker.attach(player);
			const enter = vi.fn();
			const exit = vi.fn();
			tracker.on('enter', enter);
			tracker.on('exit', exit);
			player.emit('time', { time: 5 });
			player.emit('time', { time: 15 });
			expect(enter).toHaveBeenCalledTimes(2);
			expect(exit).toHaveBeenCalledTimes(1);
			tracker.dispose();
		});

		it('repeated time within same cue does not re-emit enter', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			const enter = vi.fn();
			tracker.on('enter', enter);
			player.emit('time', { time: 1 });
			player.emit('time', { time: 2 });
			player.emit('time', { time: 3 });
			expect(enter).toHaveBeenCalledTimes(1);
			tracker.dispose();
		});
	});

	describe('seek — discontinuity dispatch', () => {
		it('seek into an active cue emits exit (previous) and enter (new)', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			const enter = vi.fn();
			const exit = vi.fn();
			tracker.on('enter', enter);
			tracker.on('exit', exit);

			player.emit('time', { time: 2 }); // enter A
			player.emit('seek', { time: 22 }); // discontinuity → exit A, enter C
			expect(exit).toHaveBeenCalledTimes(1);
			expect(enter).toHaveBeenCalledTimes(2);
			tracker.dispose();
		});

		it('seek to gap exits active without entering anything', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			const enter = vi.fn();
			const exit = vi.fn();
			tracker.on('enter', enter);
			tracker.on('exit', exit);

			player.emit('time', { time: 2 }); // enter A
			player.emit('seek', { time: 7 }); // gap between A and B
			expect(exit).toHaveBeenCalledTimes(1);
			expect(enter).toHaveBeenCalledTimes(1); // only the original A
			tracker.dispose();
		});
	});

	describe('tolerance — upcoming cue pre-warm', () => {
		it('does not fire enter for a cue outside the tolerance window', () => {
			const tracker = new CueTracker(makeList(), { tolerance: 1 });
			tracker.attach(player);
			const enter = vi.fn();
			tracker.on('enter', enter);
			// B starts at t=10; at t=8 the gap is 2s, beyond tolerance of 1s.
			player.emit('time', { time: 8 });
			expect(enter).not.toHaveBeenCalled();
			tracker.dispose();
		});

		it('fires enter for a cue within the tolerance window', () => {
			const tracker = new CueTracker(makeList(), { tolerance: 1 });
			tracker.attach(player);
			const enter = vi.fn();
			tracker.on('enter', enter);
			// B starts at t=10; at t=9.2 the gap is 0.8s, within tolerance of 1s.
			player.emit('time', { time: 9.2 });
			expect(enter).toHaveBeenCalledTimes(1);
			expect(enter.mock.calls[0]![0].payload.text).toBe('B');
			tracker.dispose();
		});

		it('zero tolerance (default) never pre-fires', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			const enter = vi.fn();
			tracker.on('enter', enter);
			// 0.5s before B — should not fire without tolerance.
			player.emit('time', { time: 9.5 });
			expect(enter).not.toHaveBeenCalled();
			tracker.dispose();
		});
	});

	describe('suspend() / resume()', () => {
		it('suspend prevents enter/exit dispatch on time', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			const enter = vi.fn();
			tracker.on('enter', enter);
			tracker.suspend();
			player.emit('time', { time: 2 });
			expect(enter).not.toHaveBeenCalled();
			tracker.dispose();
		});

		it('resume re-enables dispatch on next time tick', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			const enter = vi.fn();
			tracker.on('enter', enter);
			tracker.suspend();
			player.emit('time', { time: 2 });
			tracker.resume();
			player.emit('time', { time: 3 });
			expect(enter).toHaveBeenCalled();
			tracker.dispose();
		});

		it('suspend prevents seek discontinuity dispatch', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			const exit = vi.fn();
			tracker.on('exit', exit);
			tracker.suspend();
			player.emit('seek', { time: 22 });
			expect(exit).not.toHaveBeenCalled();
			tracker.dispose();
		});
	});

	describe('history()', () => {
		it('returns recently-entered cues newest-first', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			player.emit('time', { time: 2 }); // A
			player.emit('time', { time: 12 }); // B
			player.emit('time', { time: 22 }); // C
			const history = tracker.history();
			expect(history.map(c => c.payload.text)).toEqual(['C', 'B', 'A']);
			tracker.dispose();
		});

		it('caps at historyMax', () => {
			const tracker = new CueTracker(makeList(), { historyMax: 2 });
			tracker.attach(player);
			player.emit('time', { time: 2 });
			player.emit('time', { time: 12 });
			player.emit('time', { time: 22 });
			expect(tracker.history()).toHaveLength(2);
			tracker.dispose();
		});

		it('honors n parameter', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			player.emit('time', { time: 2 });
			player.emit('time', { time: 12 });
			player.emit('time', { time: 22 });
			expect(tracker.history(1)).toHaveLength(1);
			expect(tracker.history(1)[0]!.payload.text).toBe('C');
			tracker.dispose();
		});

		it('returns empty array when nothing entered yet', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			expect(tracker.history()).toEqual([]);
			tracker.dispose();
		});
	});

	describe('player re-emit (cue:enter / cue:exit)', () => {
		it('emits cue:enter on the player when a tracker enter fires', () => {
			const tracker = new CueTracker(makeList(), { trackerId: 'lyrics' });
			tracker.attach(player);
			const handler = vi.fn();
			player.on('cue:enter', handler);
			player.emit('time', { time: 2 });
			expect(handler).toHaveBeenCalled();
			expect(handler.mock.calls[0]![0].trackerId).toBe('lyrics');
			tracker.dispose();
		});

		it('emits cue:exit on the player when a tracker exit fires', () => {
			const tracker = new CueTracker(makeList(), { trackerId: 'subs' });
			tracker.attach(player);
			const handler = vi.fn();
			player.on('cue:exit', handler);
			player.emit('time', { time: 2 });
			player.emit('time', { time: 7 });
			expect(handler).toHaveBeenCalled();
			expect(handler.mock.calls[0]![0].trackerId).toBe('subs');
			tracker.dispose();
		});
	});

	describe('dispose()', () => {
		it('emits exit for currently-active cues', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			const exit = vi.fn();
			tracker.on('exit', exit);
			player.emit('time', { time: 2 });
			tracker.dispose();
			expect(exit).toHaveBeenCalledTimes(1);
		});

		it('detaches from player', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			const before = (player as unknown as { listenerCount: () => number }).listenerCount();
			tracker.dispose();
			const after = (player as unknown as { listenerCount: () => number }).listenerCount();
			expect(after).toBeLessThan(before);
		});

		it('subsequent time events do not fire enter/exit', () => {
			const tracker = new CueTracker(makeList());
			tracker.attach(player);
			tracker.dispose();
			const enter = vi.fn();
			tracker.on('enter', enter);
			player.emit('time', { time: 2 });
			expect(enter).not.toHaveBeenCalled();
		});
	});
});
