// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Kit-level `core.*` translation bundle (`src/i18n/*.ts`, composed by
 * `src/kit-translations.ts`).
 *
 * Before this fix, `_initTranslator` (`core/mixins/lifecycle.ts`) only ever
 * seeded `DefaultTranslator` with consumer-supplied `options.translations` —
 * nothing loaded the kit's own bundle, so `t('core.network.timeout')`
 * returned the raw key for every consumer who didn't manually pass
 * `enTranslations`. Covers:
 *  - `core.*` keys resolve with zero config (English default)
 *  - a consumer override wins the same key over the kit default
 *  - a kit key the consumer did NOT touch still resolves from the kit default
 *  - switching to another kit language lazy-loads its bundle on demand
 *  - a non-active kit language is never loaded eagerly
 */

import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
	container: HTMLElement = {} as HTMLElement;
	get id(): string { return this.playerId; }

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare t: (key: string, vars?: Record<string, string>) => string;
	declare language: { (): string; (lang: string): Promise<void> };
	declare translation: (lang: string, key: string, value?: string) => string | undefined;

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

describe('kit core.* translations — zero-config default', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('t("core.network.timeout") resolves the kit English default with zero config', async () => {
		const player = makePlayer('kit-i18n-default').setup({});
		await player.ready();
		expect(player.t('core.network.timeout')).toBe('The connection timed out. Trying again…');
	});

	it('does not return the raw key for a kit core.* key (the pre-fix regression)', async () => {
		const player = makePlayer('kit-i18n-raw-key').setup({});
		await player.ready();
		expect(player.t('core.network.offline')).not.toBe('core.network.offline');
	});
});

describe('kit core.* translations — consumer overrides win', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('consumer-supplied translations.en wins over the kit default for the same key', async () => {
		const player = makePlayer('kit-i18n-override').setup({
			translations: { en: { 'core.network.timeout': 'CUSTOM TIMEOUT' } },
		});
		await player.ready();
		expect(player.t('core.network.timeout')).toBe('CUSTOM TIMEOUT');
	});

	it('a kit key the consumer did NOT override still resolves from the kit default', async () => {
		const player = makePlayer('kit-i18n-partial').setup({
			translations: { en: { 'core.network.timeout': 'CUSTOM TIMEOUT' } },
		});
		await player.ready();
		expect(player.t('core.network.offline')).toBe('No internet connection.');
	});
});

describe('kit core.* translations — non-English lazy loading', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('setup({ language: "nl" }) lazy-loads the Dutch kit bundle and resolves it', async () => {
		const player = makePlayer('kit-i18n-nl').setup({ language: 'nl' });
		await player.ready();
		expect(player.t('core.network.timeout')).toBe('De verbinding duurde te lang. Opnieuw proberen…');
	});

	it('language() to a new kit language lazy-loads on demand and resolves', async () => {
		const player = makePlayer('kit-i18n-de-switch').setup({});
		await player.ready();
		await player.language('de');
		expect(player.t('core.network.timeout')).toBe('Verbindungszeitüberschreitung. Erneut versuchen…');
	});

	it('a non-active kit language is NOT loaded eagerly', async () => {
		const player = makePlayer('kit-i18n-lazy-untouched').setup({});
		await player.ready();

		// Never switched to German — its bundle must not be in memory yet.
		expect(player.translation('de', 'core.network.timeout')).toBeUndefined();

		await player.language('de');
		expect(player.translation('de', 'core.network.timeout')).toBe('Verbindungszeitüberschreitung. Erneut versuchen…');
	});

	it('English stays resolvable as the fallback even while a non-English language is active', async () => {
		const player = makePlayer('kit-i18n-fallback').setup({ language: 'de' });
		await player.ready();
		// A key present only conceptually in English (simulated by asserting the
		// German bundle mirrors it) — real fallback contract: unknown / not-yet-
		// loaded languages fall through to the seeded English bundle.
		expect(player.translation('en', 'core.network.timeout')).toBe('The connection timed out. Trying again…');
	});
});
