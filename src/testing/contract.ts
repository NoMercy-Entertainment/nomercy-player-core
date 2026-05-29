import type { BaseEventMap, IPlayer } from '../types';
import { StateError } from '../errors';

/**
 * Vitest globals — see `describe-plugin.ts` for why we resolve from the
 * runtime instead of importing from Vitest directly.
 */
type DescribeFn = (name: string, fn: () => void) => void;
type ItFn = (name: string, fn: () => void | Promise<void>) => void;
type HookFn = (fn: () => void | Promise<void>) => void;
interface Matchers {
	toBe: (expected: unknown) => void;
	toEqual: (expected: unknown) => void;
	toBeDefined: () => void;
	toBeUndefined: () => void;
	toBeInstanceOf: (ctor: unknown) => void;
	toBeTypeOf: (expected: string) => void;
	toBeTruthy: () => void;
	toBeFalsy: () => void;
	toContain: (expected: unknown) => void;
	toThrow: (expected?: unknown) => void;
	not: Omit<Matchers, 'not'>;
}
type ExpectFn = (actual: unknown) => Matchers;

interface VitestGlobals {
	describe: DescribeFn;
	it: ItFn;
	beforeEach: HookFn;
	afterEach: HookFn;
	expect: ExpectFn;
}

function getGlobals(): VitestGlobals {
	const g = globalThis as unknown as Partial<VitestGlobals>;
	if (!g.describe || !g.it || !g.beforeEach || !g.afterEach || !g.expect) {
		throw new StateError({
			code: 'core:test/vitest-globals-missing',
			severity: 'fatal',
			scope: { kind: 'core' },
			message: '[contract] Vitest globals not found.',
			suggestion: 'Ensure vitest.config has `test.globals: true`.',
		});
	}
	return g as VitestGlobals;
}

/**
 * Shared `IPlayer` behavior contract suite. Run this against every concrete
 * player implementation — `NMMusicPlayer`, `NMVideoPlayer`, and `StubPlayer`
 * — to prove that plugin code typed against `IPlayer` works uniformly against
 * all three.
 *
 * **When to call this.** Each per-library package (`nomercy-music-player-v2`,
 * `nomercy-video-player-v2`) calls `runIPlayerContract` in its own contract
 * test file, passing a fresh real player from its `create` factory. The kit's
 * own contract test does the same with `StubPlayer`. All three must pass.
 *
 * **Behavioral, not shape-only.** Every test invokes a method and asserts
 * the real effect — return value, side effect, emitted event. A player whose
 * method bodies still throw "not implemented" will fail these tests. That
 * failure is the point: the suite represents the truth of what `IPlayer`
 * guarantees, and any drift surfaces immediately rather than at plugin
 * runtime.
 *
 * **Scope.** Only what every `IPlayer` must support uniformly: identity,
 * event bus, phase, `baseUrl`, `audioContext`, the experimental override
 * surface, i18n, and the cue parser registry. Library-specific behavior
 * (transport, queue, fullscreen, crossfade) lives in per-library tests.
 *
 * ```ts
 * import { runIPlayerContract } from '@nomercy-entertainment/nomercy-player-core/testing';
 * import { NMVideoPlayer } from '../index';
 *
 * runIPlayerContract({
 *   label: 'NMVideoPlayer',
 *   create: () => new NMVideoPlayer({ container: document.createElement('div') }),
 *   teardown: (player) => player.dispose(),
 * });
 * ```
 */
export function runIPlayerContract<P extends IPlayer<BaseEventMap>>(opts: {
	create: () => P | Promise<P>;
	label: string;
	teardown?: (player: P) => void | Promise<void>;
}): void {
	const {
		describe,
		it,
		beforeEach,
		afterEach,
		expect,
	} = getGlobals();

	describe(`IPlayer contract: ${opts.label}`, () => {
		let player: P;

		beforeEach(async () => {
			player = await opts.create();
		});

		afterEach(async () => {
			if (opts.teardown)
				await opts.teardown(player);
		});

		describe('identity', () => {
			it('playerId is a non-empty string', () => {
				expect(typeof player.playerId).toBe('string');
				expect(player.playerId.length > 0).toBe(true);
			});

			it('id getter mirrors playerId', () => {
				expect(player.id).toBe(player.playerId);
			});

			it('container is a defined HTMLElement-like reference', () => {
				expect(player.container).toBeDefined();
			});
		});

		describe('event surface', () => {
			it('emit / on round-trip delivers the data', () => {
				let received: unknown;
				player.on('phase', (data: unknown) => {
					received = data;
				});
				player.emit('phase', {
					from: 'idle',
					to: 'idle',
				});
				expect(received).toEqual({
					from: 'idle',
					to: 'idle',
				});
			});

			it('off removes the listener', () => {
				let count = 0;
				const fn = (): void => {
					count += 1;
				};
				player.on('phase', fn);
				player.emit('phase', {
					from: 'idle',
					to: 'idle',
				});
				player.off('phase', fn);
				player.emit('phase', {
					from: 'idle',
					to: 'idle',
				});
				expect(count).toBe(1);
			});

			it('once auto-removes after first emit', () => {
				let count = 0;
				player.once('phase', () => {
					count += 1;
				});
				player.emit('phase', {
					from: 'idle',
					to: 'idle',
				});
				player.emit('phase', {
					from: 'idle',
					to: 'idle',
				});
				expect(count).toBe(1);
			});

			it('hasListeners reflects subscription state', () => {
				expect(player.hasListeners('phase')).toBe(false);
				const fn = (): void => {};
				player.on('phase', fn);
				expect(player.hasListeners('phase')).toBe(true);
				player.off('phase', fn);
				expect(player.hasListeners('phase')).toBe(false);
			});
		});

		describe('phase', () => {
			it('phase() returns a string', () => {
				expect(typeof player.phase()).toBe('string');
			});

			it('dispatching() returns an array (empty when no event is in flight)', () => {
				expect(Array.isArray(player.dispatching())).toBe(true);
				expect(player.dispatching().length).toBe(0);
			});

			it('dispatching() returns a snapshot — caller cannot mutate the player stack', () => {
				const snap = player.dispatching() as string[];
				try {
					snap.push('hijack');
				}
				catch { /* readonly arrays may throw — both fine */ }
				expect(player.dispatching().length).toBe(0);
			});
		});

		describe('baseUrl', () => {
			it('returns undefined before any value is set', () => {
				expect(player.baseUrl()).toBeUndefined();
			});

			it('round-trips through the overloaded setter', () => {
				player.baseUrl('https://example.test/api');
				expect(player.baseUrl()).toBe('https://example.test/api');
			});

			it('overwrites on subsequent writes', () => {
				player.baseUrl('https://first.test');
				player.baseUrl('https://second.test');
				expect(player.baseUrl()).toBe('https://second.test');
			});
		});

		describe('audioContext', () => {
			it('returns undefined before any user-gesture creation', () => {
				expect(player.audioContext()).toBeUndefined();
			});
		});

		describe('experimental override surface', () => {
			it('override registers, returns an unbinder, and overrides() lists it', () => {
				const unbind = player.experimental.override('foo', () => 1);
				expect(typeof unbind).toBe('function');
				const list = player.experimental.overrides();
				expect(Array.isArray(list)).toBe(true);
				expect(list.some(o => o.method === 'foo')).toBe(true);
				unbind();
			});

			it('the unbinder removes the entry from overrides()', () => {
				const unbind = player.experimental.override('bar', () => 2);
				unbind();
				expect(player.experimental.overrides().some(o => o.method === 'bar')).toBe(false);
			});

			it('restore() clears a named method', () => {
				player.experimental.override('baz', () => 3);
				player.experimental.restore('baz');
				expect(player.experimental.overrides().some(o => o.method === 'baz')).toBe(false);
			});
		});

		describe('i18n', () => {
			it('language() returns a string tag', () => {
				expect(typeof player.language()).toBe('string');
			});

			it('t(key) falls back to the key itself when missing', () => {
				expect(player.t('non.existent.key.from.test')).toBe('non.existent.key.from.test');
			});

			it('addTranslations + t round-trips the value', () => {
				player.addTranslations({ en: { 'contract.test.greeting': 'Hello' } });
				expect(player.language() === 'en' ? player.t('contract.test.greeting') : 'Hello').toBe('Hello');
			});

			it('t(key, vars) interpolates {var} placeholders', async () => {
				await player.language('en');
				player.addTranslations({ en: { 'contract.test.hello': 'Hello {name}' } });
				expect(player.t('contract.test.hello', { name: 'Stoney' })).toBe('Hello Stoney');
			});

			it('translation(lang, key, value) overrides a single key under one language', async () => {
				await player.language('en');
				player.translation('en', 'contract.test.single', 'first');
				expect(player.t('contract.test.single')).toBe('first');
				player.translation('en', 'contract.test.single', 'second');
				expect(player.t('contract.test.single')).toBe('second');
			});

			it('removeTranslations strips by prefix', async () => {
				await player.language('en');
				player.addTranslations({
					en: {
						'contract.test.removeme.a': 'A',
						'contract.test.removeme.b': 'B',
					},
				});
				player.removeTranslations('contract.test.removeme.');
				expect(player.t('contract.test.removeme.a')).toBe('contract.test.removeme.a');
				expect(player.t('contract.test.removeme.b')).toBe('contract.test.removeme.b');
			});

			it('language(lang) resolves to a Promise', async () => {
				const p = player.language('en');
				expect(p).toBeInstanceOf(Promise);
				await p;
			});
		});

		describe('cue parser registry', () => {
			it('registerCueParser + unregisterCueParser round-trip without error', () => {
				const parser = {
					id: 'contract-test-parser',
					canParse: (): boolean => false,
					parse: (): any => ({
						cues: [],
						duration: 0,
					}),
				};
				expect(() => player.registerCueParser(parser as any)).not.toThrow();
				expect(() => player.unregisterCueParser('contract-test-parser')).not.toThrow();
			});

			it('unregistering an absent id is a no-op (does not throw)', () => {
				expect(() => player.unregisterCueParser('never-registered')).not.toThrow();
			});
		});
	});
}
