/**
 * Initial-language load during setup.
 *
 * The translator only invokes `loadTranslations` on a language SWITCH, so
 * setup must push the startup language through the language() pipeline —
 * otherwise the configured loader never fires and t() returns raw keys.
 */

import type { BaseEventMap, BasePlaylistItem } from '../types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = <HTMLElement>{};

	get id(): string {
		return this.playerId;
	}

	declare options: any;
	declare setup: (config: any) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare t: (key: string) => string;
	declare language: { (): string; (lang: string): Promise<void> };
	declare queue: { (): ReadonlyArray<BasePlaylistItem>; (items: BasePlaylistItem[]): void };

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

describe('setup() initial language load', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('invokes loadTranslations for the configured language during setup', async () => {
		const loader = vi.fn(async (lang: string) =>
			lang === 'nl' ? { skip_intro: 'Intro overslaan' } : undefined);

		const player = makePlayer('lang-test-1').setup({
			language: 'nl',
			loadTranslations: loader,
		});
		await player.ready();

		expect(loader).toHaveBeenCalledWith('nl');
		expect(player.t('skip_intro')).toBe('Intro overslaan');
		expect(player.language()).toBe('nl');
	});

	it('falls back to the browser language when none is configured', async () => {
		const loader = vi.fn(async () => undefined);

		const player = makePlayer('lang-test-2').setup({
			loadTranslations: loader,
		});
		await player.ready();

		const expected = typeof navigator !== 'undefined' ? navigator.language : 'en';
		expect(loader).toHaveBeenCalledWith(expected);
	});

	it('a throwing loader does not block ready()', async () => {
		const player = makePlayer('lang-test-3').setup({
			language: 'de',
			loadTranslations: async () => {
				throw new Error('network down');
			},
		});

		await expect(player.ready()).resolves.toBeUndefined();
		expect(player.t('skip_intro')).toBe('skip_intro');
	});
});
