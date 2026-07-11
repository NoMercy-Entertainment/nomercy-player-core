// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended coverage for `i18nMethods`.
 *
 * Pinned consequences:
 *  I18N-E1. t(key) returns the key itself when no translation is loaded.
 *  I18N-E2. t(PluginClass, key) prepends plugin.<id>. and resolves.
 *  I18N-E3. addTranslations() merges a bundle; t(key) resolves after merge.
 *  I18N-E4. translation(lang, key) single-key getter returns stored value.
 *  I18N-E5. translation(lang, key, value) single-key setter persists; getter confirms.
 *  I18N-E6. removeTranslations(prefix) removes matching keys across all langs.
 *  I18N-E7. Plugin loadTranslations(lang) hook is called during language() and its
 *           keys are auto-namespaced under plugin.<id>.
 *  I18N-E8. BCP-47 fallback: switching to en-GB loads both en-GB and en bundles;
 *           t() resolves the en key when en-GB does not have it.
 */

import type { BaseEventMap, PluginCtorWithId, Translations } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	Plugin,
	resolvePlayerConstructor,
	translationsFromGlob,
} from '../index';

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = {} as HTMLElement;

	get id(): string {
		return this.playerId;
	}

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare addPlugin: (PluginClass: PluginCtorWithId) => this;
	declare removePlugin: (PluginClass: PluginCtorWithId) => void;
	declare t: {
		(key: string, vars?: Record<string, string>): string;
		(PluginClass: PluginCtorWithId, key: string, vars?: Record<string, string>): string;
	};

	declare language: { (): string; (lang: string): Promise<void> };

	declare addTranslations: (bundle: Translations) => void;

	declare translation: {
		(lang: string, key: string): string | undefined;
		(lang: string, key: string, value: string): void;
	};

	declare removeTranslations: (prefix: string, lang?: string) => void;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing') {
			return resolved.instance as unknown as this;
		}
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void {
		_instances.clear();
	}
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

function makeSetupPlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId).setup({});
}

function waitForInstall(mockPlayer: MockPlayer, id: string): Promise<void> {
	return new Promise<void>((resolve) => {
		const handler = (data: unknown): void => {
			const payload = data as { id: string };
			if (payload.id !== id)
				return;
			mockPlayer.off('plugin:installed', handler);
			resolve();
		};
		mockPlayer.on('plugin:installed', handler);
	});
}

describe('i18nMethods - extended (I18N-E)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('I18N-E1: t(key) returns the key itself when no translation is registered', () => {
		const player = makePlayer('i18n-1');

		expect(player.t('some.missing.key')).toBe('some.missing.key');
	});

	it('I18N-E2: t(PluginClass, key) prepends plugin.<id>. and resolves', () => {
		const player = makePlayer('i18n-2');

		class MyPlugin extends Plugin {
			static override readonly id = 'my-plugin';
			static override readonly description = 'test';
		}

		player.addTranslations({
			en: { 'plugin.my-plugin.hello': 'Hello from plugin' },
		});

		const result = player.t(MyPlugin as unknown as PluginCtorWithId, 'hello');

		expect(result).toBe('Hello from plugin');
	});

	it('I18N-E3: addTranslations() merges bundle; t(key) resolves after merge', () => {
		const player = makePlayer('i18n-3');

		expect(player.t('core.network.offline')).toBe('core.network.offline');

		player.addTranslations({
			en: { 'core.network.offline': 'You are offline' },
		});

		expect(player.t('core.network.offline')).toBe('You are offline');
	});

	it('I18N-E4: translation(lang, key) getter returns the stored value', () => {
		const player = makePlayer('i18n-4');
		player.addTranslations({ nl: { 'test.key': 'Testwaarde' } });

		expect(player.translation('nl', 'test.key')).toBe('Testwaarde');
	});

	it('I18N-E4b: translation(lang, key) returns undefined for a missing key', () => {
		const player = makePlayer('i18n-4b');

		expect(player.translation('en', 'no.such.key')).toBeUndefined();
	});

	it('I18N-E5: translation(lang, key, value) setter persists; getter confirms', () => {
		const player = makePlayer('i18n-5');

		player.translation('fr', 'greet.hello', 'Bonjour');

		expect(player.translation('fr', 'greet.hello')).toBe('Bonjour');
	});

	it('I18N-E6: removeTranslations(prefix) removes matching keys across all langs', () => {
		const player = makePlayer('i18n-6');
		player.addTranslations({
			en: { 'plugin.rm.a': 'A', 'plugin.rm.b': 'B', 'plugin.other.x': 'X' },
			nl: { 'plugin.rm.a': 'A-NL' },
		});

		player.removeTranslations('plugin.rm.');

		expect(player.t('plugin.rm.a')).toBe('plugin.rm.a');
		expect(player.t('plugin.rm.b')).toBe('plugin.rm.b');
		expect(player.t('plugin.other.x')).toBe('X');
	});

	it('I18N-E6b: loadTranslations hook dedup: called only once per plugin+lang pair', async () => {
		const hookFn = vi.fn(async (_lang: string): Promise<Record<string, string>> => ({
			greeting: 'Hello',
		}));

		class DedupPlugin extends Plugin {
			static override readonly id = 'dedup-plugin';
			static override readonly description = 'dedup';

			protected override async loadTranslations(lang: string): Promise<Record<string, string>> {
				return hookFn(lang);
			}
		}

		const player = makeSetupPlayer('i18n-6b');
		await player.ready();

		const installed = waitForInstall(player, 'dedup-plugin');
		player.addPlugin(DedupPlugin as unknown as PluginCtorWithId);
		await installed;

		await player.language('en');
		await player.language('en');

		expect(hookFn).toHaveBeenCalledTimes(1);
	});

	it('I18N-E6c: loadTranslations hook error is caught and does not rethrow', async () => {
		class ThrowPlugin extends Plugin {
			static override readonly id = 'throw-plugin';
			static override readonly description = 'throw';

			protected override async loadTranslations(_lang: string): Promise<Record<string, string>> {
				throw new Error('intentional');
			}
		}

		const player = makeSetupPlayer('i18n-6c');
		await player.ready();

		const installed = waitForInstall(player, 'throw-plugin');
		player.addPlugin(ThrowPlugin as unknown as PluginCtorWithId);
		await installed;

		await expect(player.language('en')).resolves.toBeUndefined();
	});

	describe('I18N-E7: plugin loadTranslations instance hook', () => {
		it('hook keys are namespaced under plugin.<id>. when language() is called', async () => {
			const hookFn = vi.fn(async (lang: string): Promise<Record<string, string> | undefined> => {
				if (lang === 'en')
					return { greeting: 'Hello from hook' };
				return undefined;
			});

			class HookPlugin extends Plugin {
				static override readonly id = 'hook-plugin';
				static override readonly description = 'hook test';

				protected override async loadTranslations(lang: string): Promise<Record<string, string> | undefined> {
					return hookFn(lang);
				}
			}

			const player = makeSetupPlayer('i18n-7');
			await player.ready();

			const installed = waitForInstall(player, 'hook-plugin');
			player.addPlugin(HookPlugin as unknown as PluginCtorWithId);
			await installed;

			// loadTranslations is invoked when language() is called on the player.
			// The mixin iterates registered plugins and calls the instance hook.
			await player.language('en');

			expect(hookFn).toHaveBeenCalledWith('en');
			expect(player.t('plugin.hook-plugin.greeting')).toBe('Hello from hook');
		});

		it('hook returning undefined is safe: no keys added, no throw', async () => {
			const hookFn = vi.fn(async (_lang: string): Promise<undefined> => undefined);

			class NullHookPlugin extends Plugin {
				static override readonly id = 'null-hook';
				static override readonly description = 'null hook';

				protected override async loadTranslations(lang: string): Promise<undefined> {
					return hookFn(lang);
				}
			}

			const player = makeSetupPlayer('i18n-7b');
			await player.ready();

			const installed = waitForInstall(player, 'null-hook');
			player.addPlugin(NullHookPlugin as unknown as PluginCtorWithId);
			await installed;

			await player.language('en');

			expect(hookFn).toHaveBeenCalledTimes(1);
			expect(player.t('plugin.null-hook.x')).toBe('plugin.null-hook.x');
		});
	});

	it('I18N-E6d: lazy translation loader throwing is caught silently', async () => {
		const throwLoader = vi.fn(async (): Promise<never> => {
			throw new Error('loader-failed');
		});

		class LazyThrowPlugin extends Plugin {
			static override readonly id = 'lazy-throw';
			static override readonly description = 'lazy throw';
			static override readonly translations: Translations = translationsFromGlob({
				'./i18n/en.ts': throwLoader,
			});
		}

		const player = makeSetupPlayer('i18n-6d');
		await player.ready();

		const installed = waitForInstall(player, 'lazy-throw');
		player.addPlugin(LazyThrowPlugin as unknown as PluginCtorWithId);
		await installed;

		await expect(player.language('en')).resolves.toBeUndefined();
		expect(throwLoader).toHaveBeenCalled();
	});

	it('I18N-E6e: lazy translation dedup: same tag loaded only once per plugin', async () => {
		let callCount = 0;
		const trackingLoader = async (): Promise<{ default: Record<string, string> }> => {
			callCount++;
			return { default: { 'plugin.dedup-lazy.k': 'V' } };
		};

		class DedupLazyPlugin extends Plugin {
			static override readonly id = 'dedup-lazy';
			static override readonly description = 'dedup lazy';
			static override readonly translations: Translations = translationsFromGlob({
				'./i18n/en.ts': trackingLoader,
			});
		}

		const player = makeSetupPlayer('i18n-6e');
		await player.ready();

		const installed = waitForInstall(player, 'dedup-lazy');
		player.addPlugin(DedupLazyPlugin as unknown as PluginCtorWithId);
		await installed;

		await player.language('en');
		await player.language('en');

		expect(callCount).toBe(1);
	});

	it('BUG2: a plugin with BOTH static translations AND a loadTranslations hook — the hook still fires', async () => {
		const frLoader = vi.fn(async () => ({ default: { 'plugin.dual-source.static': 'Static FR' } }));
		const hookFn = vi.fn(async (lang: string): Promise<Record<string, string> | undefined> => {
			if (lang === 'fr')
				return { greeting: 'Hi' };
			return undefined;
		});

		class DualSourcePlugin extends Plugin {
			static override readonly id = 'dual-source';
			static override readonly description = 'dual source';
			static override readonly translations: Translations = translationsFromGlob({
				'./i18n/fr.ts': frLoader,
			});

			protected override async loadTranslations(lang: string): Promise<Record<string, string> | undefined> {
				return hookFn(lang);
			}
		}

		const player = makeSetupPlayer('i18n-bug2');
		await player.ready();

		const installed = waitForInstall(player, 'dual-source');
		player.addPlugin(DualSourcePlugin as unknown as PluginCtorWithId);
		await installed;

		await player.language('fr');

		expect(hookFn).toHaveBeenCalledWith('fr');
		expect(player.t('plugin.dual-source.greeting')).toBe('Hi');
		expect(player.t('plugin.dual-source.static')).toBe('Static FR');
	});

	describe('I18N-E8: BCP-47 fallback chain via language() setter', () => {
		it('en-GB loads both en-GB and en bundles; t() falls back to en key', async () => {
			const enLoader = vi.fn(async () => ({ default: { 'plugin.fallback.shared': 'EN-shared' } }));
			const enGBLoader = vi.fn(async () => ({ default: { 'plugin.fallback.regional': 'EN-GB-regional' } }));

			class FallbackPlugin extends Plugin {
				static override readonly id = 'fallback';
				static override readonly description = 'fallback test';
				static override readonly translations: Translations = translationsFromGlob({
					'./i18n/en.ts': enLoader,
					'./i18n/en-GB.ts': enGBLoader,
				});
			}

			const player = makeSetupPlayer('i18n-8');
			await player.ready();

			const installed = waitForInstall(player, 'fallback');
			player.addPlugin(FallbackPlugin as unknown as PluginCtorWithId);
			await installed;

			await player.language('en-GB');

			expect(enGBLoader).toHaveBeenCalledTimes(1);
			expect(enLoader).toHaveBeenCalledTimes(1);

			expect(player.t('plugin.fallback.regional')).toBe('EN-GB-regional');
			expect(player.t('plugin.fallback.shared')).toBe('EN-shared');
		});
	});
});
