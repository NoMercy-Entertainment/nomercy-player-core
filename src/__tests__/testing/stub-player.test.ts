/**
 * StubPlayer behavior tests — beyond the contract suite (which only checks
 * shape). Verifies the test-driver methods (setPhase, pushDispatch, etc.) and
 * the in-memory implementations (translation table, cue parser registry).
 *
 * Test groups:
 *  - Construction options (id, container, initial phase, initial translations)
 *  - Phase machine — setPhase emits phase event, no-op when same
 *  - Dispatching stack — push/pop/observe
 *  - baseUrl read/write
 *  - audioContext setter
 *  - i18n surface — t/language/addTranslations/translation/removeTranslations + interpolation
 *  - Cue parser registry — register/unregister, prepend
 *  - Experimental override surface
 *  - reset() — clears all in-memory state
 */

import type { CueParser } from '../../adapters/cue-parser/ICueParser';
import type { CueList } from '../../cues/cue';
import { describe, expect, it, vi } from 'vitest';
import { StubPlayer } from '../../testing/stub-player';

describe('StubPlayer', () => {
	describe('construction', () => {
		it('defaults playerId to "stub-player"', () => {
			expect(new StubPlayer().playerId).toBe('stub-player');
		});

		it('honors explicit id option', () => {
			expect(new StubPlayer({ id: 'custom' }).playerId).toBe('custom');
		});

		it('uses provided container', () => {
			const container = document.createElement('div');
			expect(new StubPlayer({ container }).container).toBe(container);
		});

		it('creates a default container when none given', () => {
			expect(new StubPlayer().container).toBeInstanceOf(HTMLDivElement);
		});

		it('starts in idle phase by default', () => {
			expect(new StubPlayer().phase()).toBe('idle');
		});

		it('honors initial phase option', () => {
			expect(new StubPlayer({ phase: 'ready' }).phase()).toBe('ready');
		});

		it('starts with empty dispatching stack', () => {
			expect(new StubPlayer().dispatching()).toEqual([]);
		});

		it('honors initial translations', () => {
			const player = new StubPlayer({ translations: { en: { 'core.greeting': 'Hi' } } });
			expect(player.t('core.greeting')).toBe('Hi');
		});
	});

	describe('phase machine', () => {
		it('setPhase updates phase()', () => {
			const player = new StubPlayer();
			player.setPhase('playing');
			expect(player.phase()).toBe('playing');
		});

		it('setPhase emits phase event with from + to', () => {
			const player = new StubPlayer();
			const handler = vi.fn();
			player.on('phase', handler);
			player.setPhase('ready');
			expect(handler).toHaveBeenCalledWith({ from: 'idle', to: 'ready' });
		});

		it('setPhase no-op when target equals current', () => {
			const player = new StubPlayer();
			const handler = vi.fn();
			player.on('phase', handler);
			player.setPhase('idle');
			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe('dispatching stack', () => {
		it('pushDispatch appends', () => {
			const player = new StubPlayer();
			player.pushDispatch('beforePlay');
			expect(player.dispatching()).toEqual(['beforePlay']);
		});

		it('multiple pushes nest in order', () => {
			const player = new StubPlayer();
			player.pushDispatch('beforePlay');
			player.pushDispatch('beforeMutation');
			expect(player.dispatching()).toEqual(['beforePlay', 'beforeMutation']);
		});

		it('popDispatch returns and removes the innermost', () => {
			const player = new StubPlayer();
			player.pushDispatch('a');
			player.pushDispatch('b');
			expect(player.popDispatch()).toBe('b');
			expect(player.dispatching()).toEqual(['a']);
		});

		it('popDispatch on empty returns undefined', () => {
			expect(new StubPlayer().popDispatch()).toBeUndefined();
		});
	});

	describe('baseUrl', () => {
		it('reads undefined initially', () => {
			expect(new StubPlayer().baseUrl()).toBeUndefined();
		});

		it('write then read returns the value', () => {
			const player = new StubPlayer();
			player.baseUrl('https://example.com');
			expect(player.baseUrl()).toBe('https://example.com');
		});
	});

	describe('audioContext', () => {
		it('reads undefined initially', () => {
			expect(new StubPlayer().audioContext()).toBeUndefined();
		});

		it('setAudioContext sets the value returned by audioContext()', () => {
			const player = new StubPlayer();
			const ctx = {} as AudioContext;
			player.setAudioContext(ctx);
			expect(player.audioContext()).toBe(ctx);
		});
	});

	describe('i18n surface', () => {
		it('t returns the key when no translation present', () => {
			expect(new StubPlayer().t('missing.key')).toBe('missing.key');
		});

		it('t returns the translation when present', () => {
			const player = new StubPlayer({ translations: { en: { greet: 'Hello' } } });
			expect(player.t('greet')).toBe('Hello');
		});

		it('t interpolates {var} placeholders', () => {
			const player = new StubPlayer({ translations: { en: { greet: 'Hello {name}' } } });
			expect(player.t('greet', { name: 'World' })).toBe('Hello World');
		});

		it('t leaves {var} as-is when var is missing', () => {
			const player = new StubPlayer({ translations: { en: { greet: 'Hello {name}' } } });
			expect(player.t('greet', {})).toBe('Hello {name}');
		});

		it('language defaults to "en"', () => {
			expect(new StubPlayer().language()).toBe('en');
		});

		it('language switches active language', async () => {
			const player = new StubPlayer({ translations: { en: { x: 'A' }, nl: { x: 'B' } } });
			await player.language('nl');
			expect(player.language()).toBe('nl');
			expect(player.t('x')).toBe('B');
		});

		it('language initializes empty bundle for unknown language', async () => {
			const player = new StubPlayer();
			await player.language('jp');
			expect(player.t('something')).toBe('something');
		});

		it('addTranslations merges into existing bundle', () => {
			const player = new StubPlayer({ translations: { en: { a: '1' } } });
			player.addTranslations({ en: { b: '2' } });
			expect(player.t('a')).toBe('1');
			expect(player.t('b')).toBe('2');
		});

		it('addTranslations adds new languages', () => {
			const player = new StubPlayer();
			player.addTranslations({ fr: { hi: 'Bonjour' } });
			void player.language('fr');
			expect(player.t('hi')).toBe('Bonjour');
		});

		it('addTranslations overrides existing keys (last write wins)', () => {
			const player = new StubPlayer({ translations: { en: { x: 'old' } } });
			player.addTranslations({ en: { x: 'new' } });
			expect(player.t('x')).toBe('new');
		});

		it('translation sets a single key', () => {
			const player = new StubPlayer();
			player.translation('en', 'greeting', 'Hello');
			expect(player.t('greeting')).toBe('Hello');
		});

		it('removeTranslations removes by prefix from all languages', () => {
			const player = new StubPlayer({
				translations: {
					en: { 'plugin.lyrics.x': 'a', 'plugin.lyrics.y': 'b', 'core.other': 'c' },
					nl: { 'plugin.lyrics.x': 'a-nl' },
				},
			});
			player.removeTranslations('plugin.lyrics.');
			expect(player.t('plugin.lyrics.x')).toBe('plugin.lyrics.x'); // no fallback
			expect(player.t('core.other')).toBe('c');
		});

		it('removeTranslations scoped to a single language', () => {
			const player = new StubPlayer({
				translations: {
					en: { 'plugin.x': 'en-val' },
					nl: { 'plugin.x': 'nl-val' },
				},
			});
			player.removeTranslations('plugin.', 'nl');
			expect(player.t('plugin.x')).toBe('en-val'); // english unaffected
		});
	});

	describe('cue parser registry', () => {
		const dummy = (id: string): CueParser => ({
			id,
			canParse: () => true,
			parse: () => ({ cues: [] } as unknown as CueList),
		});

		it('register adds a parser', () => {
			const player = new StubPlayer();
			player.registerCueParser(dummy('lrc'));
			expect(player.cueParsers().map(p => p.id)).toEqual(['lrc']);
		});

		it('register replaces same-id parser', () => {
			const player = new StubPlayer();
			const a = dummy('vtt');
			const b = dummy('vtt');
			player.registerCueParser(a);
			player.registerCueParser(b);
			expect(player.cueParsers()).toHaveLength(1);
			expect(player.cueParsers()[0]).toBe(b);
		});

		it('register prepends when prepend=true', () => {
			const player = new StubPlayer();
			player.registerCueParser(dummy('a'));
			player.registerCueParser(dummy('b'), true);
			expect(player.cueParsers().map(p => p.id)).toEqual(['b', 'a']);
		});

		it('unregister removes by id', () => {
			const player = new StubPlayer();
			player.registerCueParser(dummy('lrc'));
			player.registerCueParser(dummy('vtt'));
			player.unregisterCueParser('lrc');
			expect(player.cueParsers().map(p => p.id)).toEqual(['vtt']);
		});

		it('unregister no-op when id absent', () => {
			const player = new StubPlayer();
			expect(() => player.unregisterCueParser('absent')).not.toThrow();
		});
	});

	describe('experimental override surface', () => {
		it('override registers + returns unbinder', () => {
			const player = new StubPlayer();
			const unbind = player.experimental.override('foo', () => 'patched');
			const list = player.experimental.overrides();
			expect(list).toHaveLength(1);
			expect(list[0]!.method).toBe('foo');
			expect(list[0]!.by).toBe('consumer');
			unbind();
			expect(player.experimental.overrides()).toHaveLength(0);
		});

		it('restore by method name removes the override', () => {
			const player = new StubPlayer();
			player.experimental.override('foo', () => 'p');
			player.experimental.restore('foo');
			expect(player.experimental.overrides()).toHaveLength(0);
		});
	});

	describe('reset()', () => {
		it('clears all in-memory state', () => {
			const player = new StubPlayer();
			player.on('play', () => {});
			player.setPhase('playing');
			player.pushDispatch('foo');
			player.baseUrl('https://x');
			player.setAudioContext({} as AudioContext);
			player.translation('en', 'k', 'v');
			player.registerCueParser({ id: 'p', canParse: () => true, parse: () => ({ cues: [] } as unknown as CueList) });

			player.reset();

			expect(player.phase()).toBe('idle');
			expect(player.dispatching()).toEqual([]);
			expect(player.baseUrl()).toBeUndefined();
			expect(player.audioContext()).toBeUndefined();
			expect(player.t('k')).toBe('k');
			expect(player.cueParsers()).toEqual([]);
			expect(player.hasListeners('play')).toBe(false);
		});
	});
});
