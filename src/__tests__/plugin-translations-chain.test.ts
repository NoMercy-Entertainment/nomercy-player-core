/**
 * Plugin translation chain registration.
 *
 * Contract: when a Plugin subclass declares `static translations`, the kit
 * walks the prototype chain and registers EVERY ancestor's bundle
 * independently. Without this, the subclass's static would shadow the
 * parent's and the parent's keys would silently disappear.
 *
 * Each plugin ships ONLY its own keys. The kit composes the chain at
 * `addPlugin()` time; on `removePlugin()` a single `removeTranslations`
 * call sweeps the shared `plugin.<id>.` prefix so all ancestor keys go
 * away in one pass.
 */

import type { BaseEventMap, Translations } from '../types';
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
	container: HTMLElement = <HTMLElement>{};

	get id(): string { return this.playerId; }

	declare options: any;
	declare setup: (config: any) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare addPlugin: (PluginClass: any) => this;
	declare removePlugin: (PluginClass: any) => void;
	declare t: (key: string, vars?: Record<string, string>) => string;
	declare language: (lang: string) => Promise<void>;

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

	static _resetRegistry(): void { _instances.clear(); }
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

class BasePlugin extends Plugin {
	static override readonly id: string = 'chain-test';
	static override readonly description: string = 'base';
	static override readonly translations: Translations = {
		en: { 'plugin.chain-test.base-only': 'BASE-EN', 'plugin.chain-test.shared': 'BASE-shared-EN' },
		nl: { 'plugin.chain-test.base-only': 'BASIS-NL', 'plugin.chain-test.shared': 'BASIS-shared-NL' },
	};
}

class ChildPlugin extends BasePlugin {
	static override readonly description: string = 'child';
	static override readonly translations: Translations = {
		en: { 'plugin.chain-test.child-only': 'CHILD-EN', 'plugin.chain-test.shared': 'CHILD-shared-EN' },
		nl: { 'plugin.chain-test.child-only': 'KIND-NL', 'plugin.chain-test.shared': 'KIND-shared-NL' },
	};
}

describe('Plugin translation chain registration', () => {
	beforeEach(() => MockPlayer._resetRegistry());

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('registers BOTH base and child translations when only the child is added', async () => {
		const p = makePlayer('chain1').setup({});
		await p.ready();
		p.addPlugin(ChildPlugin);

		// Base-only key — would be missing if child shadowed the parent.
		expect(p.t('plugin.chain-test.base-only')).toBe('BASE-EN');
		// Child-only key.
		expect(p.t('plugin.chain-test.child-only')).toBe('CHILD-EN');
		// Shared key — child wins on collision (registered last in chain order).
		expect(p.t('plugin.chain-test.shared')).toBe('CHILD-shared-EN');
	});

	it('registers Dutch keys from both ancestors', async () => {
		const p = makePlayer('chain2').setup({});
		await p.ready();
		p.addPlugin(ChildPlugin);
		await p.language('nl');
		expect(p.t('plugin.chain-test.base-only')).toBe('BASIS-NL');
		expect(p.t('plugin.chain-test.child-only')).toBe('KIND-NL');
		expect(p.t('plugin.chain-test.shared')).toBe('KIND-shared-NL');
	});

	it('removing the plugin clears every key under its id', async () => {
		const p = makePlayer('chain3').setup({});
		await p.ready();
		p.addPlugin(ChildPlugin);
		p.removePlugin(ChildPlugin);
		// Removal walks the `plugin.<id>.` prefix so both parent + child
		// keys are gone in one pass.
		expect(p.t('plugin.chain-test.base-only')).toBe('plugin.chain-test.base-only');
		expect(p.t('plugin.chain-test.child-only')).toBe('plugin.chain-test.child-only');
	});

	it('a plain (no-ancestor-translations) plugin still works', async () => {
		class Loner extends Plugin {
			static override readonly id: string = 'loner';
			static override readonly description: string = 'loner';
			static override readonly translations: Translations = {
				en: { 'plugin.loner.x': 'X' },
			};
		}
		const p = makePlayer('loner').setup({});
		await p.ready();
		p.addPlugin(Loner);
		expect(p.t('plugin.loner.x')).toBe('X');
	});
});

/**
 * Lazy translation chain — the "no Chinese when Dutch" contract.
 *
 * When a plugin's `static translations` is the LAZY shape (produced by
 * `translationsFromGlob` with function loaders), the kit MUST only invoke
 * the loaders for the active language and its BCP-47 parent chain. Other
 * languages stay out of memory until `setLanguage` requests them.
 */
describe('Plugin lazy translation chain', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	/** addPlugin is fire-and-forget; wait for the install event before asserting. */
	const waitForInstall = (p: any, id: string): Promise<void> => new Promise<void>((resolve) => {
		const handler = (data: { id: string }): void => {
			if (data.id !== id)
				return;
			(p as any).off('plugin:installed', handler);
			resolve();
		};
		(p as any).on('plugin:installed', handler);
	});

	it('loads ONLY the active language at addPlugin time — Chinese stays untouched', async () => {
		const enLoader = vi.fn(async () => ({ default: { 'plugin.lazy.k': 'EN' } }));
		const nlLoader = vi.fn(async () => ({ default: { 'plugin.lazy.k': 'NL' } }));
		const zhLoader = vi.fn(async () => ({ default: { 'plugin.lazy.k': 'ZH' } }));

		const lazy = translationsFromGlob({
			'./i18n/en.ts': enLoader,
			'./i18n/nl.ts': nlLoader,
			'./i18n/zh.ts': zhLoader,
		});

		class LazyPlugin extends Plugin {
			static override readonly id: string = 'lazy';
			static override readonly description: string = 'lazy';
			static override readonly translations: Translations = lazy;
		}

		const p = makePlayer('lazy1').setup({});
		await p.ready();
		await p.language('nl');
		const installed = waitForInstall(p, 'lazy');
		p.addPlugin(LazyPlugin);
		await installed;

		expect(p.t('plugin.lazy.k')).toBe('NL');
		// Critical: ONLY the active language was loaded. The plugin add path
		// walks the BCP-47 chain (`nl`) and stops there. Chinese never paid
		// the cost of being parsed / merged.
		expect(nlLoader).toHaveBeenCalledTimes(1);
		expect(zhLoader).not.toHaveBeenCalled();
	});

	it('walks the BCP-47 parent chain — pt-BR loads pt-BR + pt only', async () => {
		const ptBR = vi.fn(async () => ({ default: { 'plugin.lazy.regional': 'BR' } }));
		const pt = vi.fn(async () => ({ default: { 'plugin.lazy.shared': 'PT' } }));
		const en = vi.fn(async () => ({ default: { 'plugin.lazy.shared': 'EN' } }));
		const zh = vi.fn(async () => ({ default: { 'plugin.lazy.shared': 'ZH' } }));

		class LazyPlugin extends Plugin {
			static override readonly id: string = 'lazy';
			static override readonly description: string = 'lazy';
			static override readonly translations: Translations = translationsFromGlob({
				'./i18n/pt-BR.ts': ptBR,
				'./i18n/pt.ts': pt,
				'./i18n/en.ts': en,
				'./i18n/zh.ts': zh,
			});
		}

		const p = makePlayer('lazy2').setup({});
		await p.ready();
		await p.language('pt-BR');
		const installed = waitForInstall(p, 'lazy');
		p.addPlugin(LazyPlugin);
		await installed;

		expect(ptBR).toHaveBeenCalledTimes(1);
		expect(pt).toHaveBeenCalledTimes(1);
		// English and Chinese are NOT in the active chain — stay out of memory.
		expect(en).not.toHaveBeenCalled();
		expect(zh).not.toHaveBeenCalled();

		// pt-BR-specific key resolves from pt-BR.
		expect(p.t('plugin.lazy.regional')).toBe('BR');
		// Shared key falls back to pt (pt-BR doesn't define it).
		expect(p.t('plugin.lazy.shared')).toBe('PT');
	});

	it('language() to a NEW language fires the lazy loader for that language', async () => {
		const en = vi.fn(async () => ({ default: { 'plugin.lazy.k': 'EN' } }));
		const fr = vi.fn(async () => ({ default: { 'plugin.lazy.k': 'FR' } }));

		class LazyPlugin extends Plugin {
			static override readonly id: string = 'lazy';
			static override readonly description: string = 'lazy';
			static override readonly translations: Translations = translationsFromGlob({
				'./i18n/en.ts': en,
				'./i18n/fr.ts': fr,
			});
		}

		const p = makePlayer('lazy3').setup({});
		await p.ready();
		const installed = waitForInstall(p, 'lazy');
		p.addPlugin(LazyPlugin);
		await installed;

		expect(en).toHaveBeenCalledTimes(1);
		expect(fr).not.toHaveBeenCalled();

		await p.language('fr');
		expect(fr).toHaveBeenCalledTimes(1);
		expect(p.t('plugin.lazy.k')).toBe('FR');
	});

	it('eager bundles (no lazy marker) still work alongside lazy ones', async () => {
		// Subclass eager + base lazy — both must register correctly.
		const baseEn = vi.fn(async () => ({ default: { 'plugin.lazy.base': 'BASE-EN' } }));

		class LazyBase extends Plugin {
			static override readonly id: string = 'lazy';
			static override readonly description: string = 'lazy-base';
			static override readonly translations: Translations = translationsFromGlob({
				'./i18n/en.ts': baseEn,
			});
		}

		class EagerChild extends LazyBase {
			static override readonly description: string = 'eager-child';
			static override readonly translations: Translations = {
				en: { 'plugin.lazy.child': 'CHILD-EN' },
			};
		}

		const p = makePlayer('lazy4').setup({});
		await p.ready();
		const installed = waitForInstall(p, 'lazy');
		p.addPlugin(EagerChild);
		await installed;

		expect(p.t('plugin.lazy.base')).toBe('BASE-EN');
		expect(p.t('plugin.lazy.child')).toBe('CHILD-EN');
	});
});
