// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { mergeConfig } from '../core/config-merge';

describe('mergeConfig', () => {
	describe('primitives', () => {
		it('returns default when user is undefined', () => {
			expect(mergeConfig({ volume: 0.8 }, undefined)).toEqual({ volume: 0.8 });
		});

		it('user primitive overwrites default', () => {
			expect(mergeConfig({ volume: 0.8 }, { volume: 0.5 })).toEqual({ volume: 0.5 });
		});

		it('undefined user value falls through to default', () => {
			expect(mergeConfig({ volume: 0.8 }, { volume: undefined })).toEqual({ volume: 0.8 });
		});

		it('null user value overwrites default', () => {
			interface Config { label: string | null }
			const result: Config = mergeConfig<Config>({ label: 'default' }, { label: null });
			expect(result.label).toBeNull();
		});

		it('false user value overwrites truthy default', () => {
			expect(mergeConfig({ enabled: true }, { enabled: false })).toEqual({ enabled: false });
		});

		it('zero user value overwrites non-zero default', () => {
			expect(mergeConfig({ count: 5 }, { count: 0 })).toEqual({ count: 0 });
		});

		it('empty string user value overwrites default', () => {
			expect(mergeConfig({ label: 'default' }, { label: '' })).toEqual({ label: '' });
		});
	});

	describe('nested objects', () => {
		it('recursively merges nested plain objects', () => {
			interface Buttons { play: boolean; mute: boolean; fullscreen: boolean }
			interface Config { buttons: Buttons }
			const defaults: Config = { buttons: { play: true, mute: true, fullscreen: true } };
			const result = mergeConfig<Config>(defaults, { buttons: { play: false, mute: true, fullscreen: true } });
			expect(result).toEqual({ buttons: { play: false, mute: true, fullscreen: true } });
		});

		it('partially overrides nested plain object — unlisted keys survive', () => {
			interface Config { buttons: { play?: boolean; mute?: boolean; fullscreen?: boolean } }
			const defaults: Config = { buttons: { play: true, mute: true, fullscreen: true } };
			const result = mergeConfig<Config>(defaults, { buttons: { play: false } });
			expect(result).toEqual({ buttons: { play: false, mute: true, fullscreen: true } });
		});

		it('merges 3 levels deep', () => {
			interface Config { a: { b: { c?: number; d?: number } } }
			const defaults: Config = { a: { b: { c: 1, d: 2 } } };
			const result = mergeConfig<Config>(defaults, { a: { b: { c: 99 } } });
			expect(result).toEqual({ a: { b: { c: 99, d: 2 } } });
		});

		it('adds new nested keys from user not in defaults', () => {
			interface Config { buttons: { play?: boolean; theater?: boolean } }
			const defaults: Config = { buttons: { play: true } };
			const result = mergeConfig<Config>(defaults, { buttons: { play: false, theater: true } });
			expect(result).toEqual({ buttons: { play: false, theater: true } });
		});

		it('plain object default is overwritten by null from user', () => {
			interface Config { sub: { lang: string } | null }
			const result = mergeConfig<Config>({ sub: { lang: 'en' } }, { sub: null });
			expect(result.sub).toBeNull();
		});

		it('null default field is overwritten by plain object from user', () => {
			interface Config { sub: { lang: string } | null }
			const result = mergeConfig<Config>({ sub: null }, { sub: { lang: 'en' } });
			expect(result.sub).toEqual({ lang: 'en' });
		});
	});

	describe('arrays', () => {
		it('array user value replaces default array (no concat)', () => {
			const defaults = { tags: ['a', 'b', 'c'] };
			const result = mergeConfig(defaults, { tags: ['x'] });
			expect(result).toEqual({ tags: ['x'] });
		});

		it('empty array from user replaces non-empty default', () => {
			const result = mergeConfig({ tags: ['a', 'b'] }, { tags: [] });
			expect(result).toEqual({ tags: [] });
		});

		it('array default is kept when user omits the key', () => {
			expect(mergeConfig({ tags: ['a', 'b'] }, {})).toEqual({ tags: ['a', 'b'] });
		});
	});

	describe('functions and class instances', () => {
		it('function from user passes through unchanged', () => {
			const defaultFn = (): number => 1;
			const userFn = (): number => 2;
			const result = mergeConfig({ fn: defaultFn }, { fn: userFn });
			expect(result.fn).toBe(userFn);
		});

		it('function default is kept when user omits it', () => {
			const defaultFn = (): number => 1;
			const result = mergeConfig({ fn: defaultFn }, {});
			expect(result.fn).toBe(defaultFn);
		});

		it('class instance from user passes through (not recursed into)', () => {
			class MyStrategy {
				execute(): string { return 'user'; }
			}
			class DefaultStrategy {
				execute(): string { return 'default'; }
			}
			interface Config { strategy: MyStrategy | DefaultStrategy }
			const userStrategy = new MyStrategy();
			const result = mergeConfig<Config>({ strategy: new DefaultStrategy() }, { strategy: userStrategy });
			expect(result.strategy).toBe(userStrategy);
		});

		it('Date from user passes through', () => {
			const defaultDate = new Date('2024-01-01');
			const userDate = new Date('2025-06-15');
			const result = mergeConfig({ since: defaultDate }, { since: userDate });
			expect(result.since).toBe(userDate);
		});

		it('Map from user passes through', () => {
			const defaultMap = new Map([['a', 1]]);
			const userMap = new Map([['b', 2]]);
			const result = mergeConfig({ lookup: defaultMap }, { lookup: userMap });
			expect(result.lookup).toBe(userMap);
		});

		it('Set from user passes through', () => {
			const defaultSet = new Set([1, 2]);
			const userSet = new Set([3, 4]);
			const result = mergeConfig({ items: defaultSet }, { items: userSet });
			expect(result.items).toBe(userSet);
		});
	});

	describe('extra keys', () => {
		it('user keys not present in defaults are included in result', () => {
			interface Config { volume: number; crossfadeEnabled?: boolean }
			const result = mergeConfig<Config>({ volume: 1 }, { volume: 0.5, crossfadeEnabled: true });
			expect(result).toEqual({ volume: 0.5, crossfadeEnabled: true });
		});
	});

	describe('empty inputs', () => {
		it('merging empty user into non-empty defaults returns defaults shape', () => {
			interface Config { a: number; b: { c: number } }
			const defaults: Config = { a: 1, b: { c: 2 } };
			expect(mergeConfig(defaults, {})).toEqual({ a: 1, b: { c: 2 } });
		});

		it('merging non-empty user into empty defaults returns user shape', () => {
			interface Config { a?: number; b?: { c?: number } }
			expect(mergeConfig<Config>({}, { a: 1, b: { c: 2 } })).toEqual({ a: 1, b: { c: 2 } });
		});

		it('merging empty user into empty defaults returns empty object', () => {
			expect(mergeConfig({}, {})).toEqual({});
		});
	});

	describe('mismatched shapes at runtime', () => {
		it('user plain object replaces a string default at runtime', () => {
			const result = mergeConfig({ config: 'simple' } as Record<string, unknown>, { config: { advanced: true } });
			expect(result).toEqual({ config: { advanced: true } });
		});

		it('user string replaces a plain object default at runtime', () => {
			const result = mergeConfig({ config: { advanced: true } } as Record<string, unknown>, { config: 'simple' });
			expect(result).toEqual({ config: 'simple' });
		});
	});

	describe('mutation safety', () => {
		it('does not mutate the defaults object', () => {
			interface Config { buttons: { play: boolean; mute: boolean } }
			const defaults: Config = { buttons: { play: true, mute: true } };
			mergeConfig<Config>(defaults, { buttons: { play: false, mute: true } });
			expect(defaults.buttons.play).toBe(true);
		});

		it('does not mutate the user partial object', () => {
			interface Config { buttons: { play?: boolean; mute?: boolean } }
			const user: Partial<Config> = { buttons: { play: false } };
			mergeConfig<Config>({ buttons: { play: true } }, user);
			expect(user.buttons?.play).toBe(false);
		});
	});

	describe('return type', () => {
		it('result has the same shape as defaults type', () => {
			interface Config { volume: number; label: string }
			const result: Config = mergeConfig<Config>({ volume: 1, label: 'a' }, { volume: 0.5 });
			expect(result.volume).toBe(0.5);
			expect(result.label).toBe('a');
		});
	});
});
