/**
 * Leak harness tests — meta-tests of the test infrastructure itself. If the
 * leak harness is broken, every plugin test that depends on it gives a false
 * positive (no leaks reported even when leaks exist) or false negative (leaks
 * reported on clean teardowns).
 *
 * Test groups:
 *  - countAllListeners — uses listenerCount when available, returns 0 otherwise
 *  - assertNoListenerLeak — passes when balanced, throws when leaks remain
 *  - assertNoListenerLeakOverCycles — runs N cycles, all assertions must pass
 *  - exercise step is optional + invoked between setup and teardown
 */

import { describe, expect, it, vi } from 'vitest';
import { assertNoListenerLeak, assertNoListenerLeakOverCycles, countAllListeners } from '../../testing/leak-harness';
import { StubPlayer } from '../../testing/stub-player';

describe('countAllListeners()', () => {
	it('returns 0 for a fresh player', () => {
		const player = new StubPlayer();
		expect(countAllListeners(player)).toBe(0);
	});

	it('reflects current listener count', () => {
		const player = new StubPlayer();
		player.on('play', () => {});
		player.on('pause', () => {});
		expect(countAllListeners(player)).toBe(2);
	});

	it('returns 0 for a player without listenerCount() method', () => {
		const fake = {} as any;
		expect(countAllListeners(fake)).toBe(0);
	});
});

describe('assertNoListenerLeak()', () => {
	it('resolves when setup and teardown are balanced', async () => {
		const player = new StubPlayer();
		const handler = () => {};
		const result = await assertNoListenerLeak({
			subjectId: 'balanced',
			player,
			setup: () => player.on('play', handler),
			teardown: () => player.off('play', handler),
		});
		expect(result.leaked).toBe(0);
	});

	it('throws when teardown does not remove what setup added', async () => {
		const player = new StubPlayer();
		await expect(assertNoListenerLeak({
			subjectId: 'leaky',
			player,
			setup: () => player.on('play', () => {}),
			teardown: () => {},
		})).rejects.toThrow(/leak-harness/);
	});

	it('error message includes subjectId', async () => {
		const player = new StubPlayer();
		await expect(assertNoListenerLeak({
			subjectId: 'subject-name',
			player,
			setup: () => player.on('play', () => {}),
			teardown: () => {},
		})).rejects.toThrow(/"subject-name"/);
	});

	it('error message includes counts', async () => {
		const player = new StubPlayer();
		await expect(assertNoListenerLeak({
			subjectId: 'x',
			player,
			setup: () => {
				player.on('play', () => {});
				player.on('pause', () => {});
			},
			teardown: () => {},
		})).rejects.toThrow(/leaked 2/);
	});

	it('runs the optional exercise step between setup and teardown', async () => {
		const player = new StubPlayer();
		const handler = () => {};
		const order: string[] = [];

		await assertNoListenerLeak({
			subjectId: 'with-exercise',
			player,
			setup: () => { order.push('setup'); player.on('play', handler); },
			exercise: () => { order.push('exercise'); },
			teardown: () => { order.push('teardown'); player.off('play', handler); },
		});

		expect(order).toEqual(['setup', 'exercise', 'teardown']);
	});

	it('returns numeric snapshot fields', async () => {
		const player = new StubPlayer();
		const handler = () => {};
		const result = await assertNoListenerLeak({
			subjectId: 'snapshot',
			player,
			setup: () => player.on('play', handler),
			teardown: () => player.off('play', handler),
		});
		expect(result.listenersBefore).toBe(0);
		expect(result.listenersAfterSetup).toBe(1);
		expect(result.listenersAfterTeardown).toBe(0);
		expect(result.leaked).toBe(0);
	});

	it('honors a non-zero baseline (existing listeners before setup)', async () => {
		const player = new StubPlayer();
		// Pre-existing listener — must NOT count as a leak.
		player.on('time', () => {});
		const handler = () => {};
		await assertNoListenerLeak({
			subjectId: 'with-baseline',
			player,
			setup: () => player.on('play', handler),
			teardown: () => player.off('play', handler),
		});
		// Pre-existing listener still there; not flagged.
	});

	it('awaits async setup and teardown', async () => {
		const player = new StubPlayer();
		const handler = () => {};
		await assertNoListenerLeak({
			subjectId: 'async',
			player,
			setup: async () => {
				await new Promise(r => setTimeout(r, 1));
				player.on('play', handler);
			},
			teardown: async () => {
				await new Promise(r => setTimeout(r, 1));
				player.off('play', handler);
			},
		});
	});
});

describe('assertNoListenerLeakOverCycles()', () => {
	it('runs the full cycle the requested number of times', async () => {
		const player = new StubPlayer();
		const handler = () => {};
		const setupSpy = vi.fn(() => player.on('play', handler));
		const teardownSpy = vi.fn(() => player.off('play', handler));

		await assertNoListenerLeakOverCycles({
			subjectId: 'cycles',
			player,
			setup: setupSpy,
			teardown: teardownSpy,
			cycles: 3,
		});

		expect(setupSpy).toHaveBeenCalledTimes(3);
		expect(teardownSpy).toHaveBeenCalledTimes(3);
	});

	it('defaults to 5 cycles', async () => {
		const player = new StubPlayer();
		const handler = () => {};
		const setupSpy = vi.fn(() => player.on('play', handler));
		const teardownSpy = vi.fn(() => player.off('play', handler));

		await assertNoListenerLeakOverCycles({
			subjectId: 'default',
			player,
			setup: setupSpy,
			teardown: teardownSpy,
		});

		expect(setupSpy).toHaveBeenCalledTimes(5);
	});

	it('returns one result per cycle', async () => {
		const player = new StubPlayer();
		const handler = () => {};
		const results = await assertNoListenerLeakOverCycles({
			subjectId: 'multi',
			player,
			setup: () => player.on('play', handler),
			teardown: () => player.off('play', handler),
			cycles: 3,
		});
		expect(results).toHaveLength(3);
	});

	it('throws on the first cycle that leaks', async () => {
		const player = new StubPlayer();
		let cycleCount = 0;
		await expect(assertNoListenerLeakOverCycles({
			subjectId: 'leaky',
			player,
			setup: () => {
				cycleCount += 1;
				const handler = () => {};
				player.on('play', handler);
				// Don't capture handler — caller can't remove.
			},
			teardown: () => {},
			cycles: 5,
		})).rejects.toThrow();
		expect(cycleCount).toBe(1);
	});
});
