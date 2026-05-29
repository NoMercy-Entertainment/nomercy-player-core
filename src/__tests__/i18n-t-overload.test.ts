/**
 * Tests for the class-typed t(PluginClass, key, vars?) overload added in
 * 2.0.0-beta.1. Covers:
 *  - bare-key form still resolves as before
 *  - class-typed form prepends `plugin.<id>.` automatically
 *  - missing translation falls back to the fully-qualified key (not the raw key)
 *  - vars are interpolated correctly in both forms
 */

import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	Plugin,
	resolvePlayerConstructor,
} from '../index';

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = <HTMLElement>{};

	get id(): string { return this.playerId; }

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare addTranslations: (bundle: import('../types').Translations) => void;
	declare t: {
		(key: string, vars?: Record<string, string>): string;
		(PluginClass: import('../types').PluginCtorWithId, key: string, vars?: Record<string, string>): string;
	};

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

class FakePlugin extends Plugin {
	static override readonly id: string = 'fake-plugin';
	static override readonly description: string = 'test plugin';
}

function makePlayer(): MockPlayer {
	const div = document.createElement('div');
	div.id = 'overload-test';
	document.body.appendChild(div);
	return new MockPlayer('overload-test').setup({});
}

describe('t() overload', () => {
	beforeEach(() => { MockPlayer._resetRegistry(); });
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	describe('bare-key form', () => {
		it('returns the translation value when registered', () => {
			const player = makePlayer();
			player.addTranslations({ en: { 'my.key': 'Hello' } });
			expect(player.t('my.key')).toBe('Hello');
		});

		it('returns the key itself on miss', () => {
			const player = makePlayer();
			expect(player.t('missing.key')).toBe('missing.key');
		});

		it('interpolates vars', () => {
			const player = makePlayer();
			player.addTranslations({ en: { greet: 'Hi {name}' } });
			expect(player.t('greet', { name: 'Arc' })).toBe('Hi Arc');
		});
	});

	describe('class-typed form', () => {
		it('prepends plugin.<id>. and resolves the translation', () => {
			const player = makePlayer();
			player.addTranslations({ en: { 'plugin.fake-plugin.hello': 'Hello from plugin' } });
			expect(player.t(FakePlugin, 'hello')).toBe('Hello from plugin');
		});

		it('falls back to the fully-qualified key on miss (not raw key)', () => {
			const player = makePlayer();
			const result = player.t(FakePlugin, 'not-registered');
			expect(result).toBe('plugin.fake-plugin.not-registered');
		});

		it('interpolates vars in the class-typed form', () => {
			const player = makePlayer();
			player.addTranslations({ en: { 'plugin.fake-plugin.greet': 'Hi {user}' } });
			expect(player.t(FakePlugin, 'greet', { user: 'Stoney' })).toBe('Hi Stoney');
		});
	});
});
