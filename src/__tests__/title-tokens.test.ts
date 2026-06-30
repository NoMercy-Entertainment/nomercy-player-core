// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Tests for the generic title-token interpolation engine and its wiring into
 * the queue ingest pipeline.
 *
 * Groups:
 *   A — interpolateTitleTokens: pure function contract
 *   B — queue ingest: tokens resolved in place on every entry path
 *   C — music-style player: no registry → title untouched
 */

import type { ITranslator } from '../adapters/translator/ITranslator';
import type { TokenRegistry } from '../core/title-tokens';
import type { BasePlaylistItem } from '../types';
import { describe, expect, it } from 'vitest';

import { MediaList } from '../adapters/media-list/default';
import { queueMethods } from '../core/mixins/queue';
import { interpolateTitleTokens } from '../core/title-tokens';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTranslator(
	seasonTpl: string = 'S{number}',
	episodeTpl: string = 'E{number}',
): ITranslator {
	return {
		t(key: string, vars?: Record<string, string>): string {
			const tpl = key.endsWith('.season') ? seasonTpl : episodeTpl;
			return tpl.replace('{number}', vars?.['number'] ?? '');
		},
		language(): string { return 'en'; },
		addTranslations(): void {},
		translation(): undefined { return undefined; },
		removeTranslations(): void {},
		dispose(): void {},
	} as unknown as ITranslator;
}

const SE_REGISTRY: TokenRegistry = {
	S: 'plugin.desktop-ui.token.season',
	E: 'plugin.desktop-ui.token.episode',
};

function makeQueueInternals(opts: {
	registry?: TokenRegistry;
	translator?: ITranslator;
}): ThisParameterType<typeof queueMethods.queue> {
	return {
		_queueList: new MediaList<BasePlaylistItem>(),
		_backlogList: new MediaList<BasePlaylistItem>(),
		_queueWired: true,
		_titleTokenRegistry: opts.registry ?? {},
		_translator: opts.translator,
		normalizePlaylistItem: undefined,
		options: {},
		emit: () => {},
	} as unknown as ThisParameterType<typeof queueMethods.queue>;
}

// ── A: interpolateTitleTokens pure-function contract ──────────────────────────

describe('interpolateTitleTokens()', () => {
	it('replaces a %S token', () => {
		expect(interpolateTitleTokens('%S1', makeTranslator(), SE_REGISTRY)).toBe('S1');
	});

	it('replaces a %E token', () => {
		expect(interpolateTitleTokens('%E5', makeTranslator(), SE_REGISTRY)).toBe('E5');
	});

	it('replaces both tokens in one string with surrounding text', () => {
		expect(
			interpolateTitleTokens('%S1 %E1 - Now Is Not the End', makeTranslator(), SE_REGISTRY),
		).toBe('S1 E1 - Now Is Not the End');
	});

	it('preserves text surrounding a single token', () => {
		expect(interpolateTitleTokens('Recap: %S2', makeTranslator(), SE_REGISTRY)).toBe('Recap: S2');
		expect(interpolateTitleTokens('%E12 - The Reckoning', makeTranslator(), SE_REGISTRY)).toBe('E12 - The Reckoning');
	});

	it('handles multi-digit season and episode numbers', () => {
		expect(interpolateTitleTokens('%S10', makeTranslator(), SE_REGISTRY)).toBe('S10');
		expect(interpolateTitleTokens('%E12', makeTranslator(), SE_REGISTRY)).toBe('E12');
	});

	it('returns a no-token string unchanged', () => {
		expect(interpolateTitleTokens('The Reckoning', makeTranslator(), SE_REGISTRY)).toBe('The Reckoning');
	});

	it('returns empty string for empty input', () => {
		expect(interpolateTitleTokens('', makeTranslator(), SE_REGISTRY)).toBe('');
	});

	it('localizes the episode prefix letter (nl: A)', () => {
		expect(
			interpolateTitleTokens('%S1 %E1', makeTranslator('S{number}', 'A{number}'), SE_REGISTRY),
		).toBe('S1 A1');
	});

	it('replaces multiple tokens of the same type in one string', () => {
		expect(interpolateTitleTokens('%S1 and %S2', makeTranslator(), SE_REGISTRY)).toBe('S1 and S2');
	});

	it('leaves an unregistered letter verbatim', () => {
		expect(interpolateTitleTokens('%X3 title', makeTranslator(), SE_REGISTRY)).toBe('%X3 title');
	});

	it('returns text unchanged when translator is undefined', () => {
		expect(interpolateTitleTokens('%S1 title', undefined, SE_REGISTRY)).toBe('%S1 title');
	});

	it('returns text unchanged when registry is empty', () => {
		expect(interpolateTitleTokens('%S1 title', makeTranslator(), {})).toBe('%S1 title');
	});

	it('is idempotent: already-resolved text passes through unchanged', () => {
		const once = interpolateTitleTokens('%S1 %E1 - Pilot', makeTranslator(), SE_REGISTRY);
		expect(interpolateTitleTokens(once, makeTranslator(), SE_REGISTRY)).toBe(once);
	});
});

// ── B: queue ingest resolves tokens in place ──────────────────────────────────

describe('queue ingest — token resolution', () => {
	it('resolves %S/%E tokens in place when a registry and translator are present', () => {
		const internals = makeQueueInternals({
			registry: SE_REGISTRY,
			translator: makeTranslator(),
		});
		queueMethods.queue.call(internals, [{ id: 1, title: '%S1 %E2 - Pilot' }]);

		const items1 = queueMethods.queue.call(internals) as ReadonlyArray<BasePlaylistItem>;
		expect(items1[0]?.title).toBe('S1 E2 - Pilot');
	});

	it('resolves tokens on queueAppend and queuePrepend', () => {
		const internals = makeQueueInternals({
			registry: SE_REGISTRY,
			translator: makeTranslator(),
		});
		queueMethods.queueAppend.call(internals, { id: 1, title: '%S2 %E3 - Later' });
		queueMethods.queuePrepend.call(internals, { id: 2, title: '%E1 - Early' });

		const items = queueMethods.queue.call(internals) as ReadonlyArray<BasePlaylistItem>;
		expect(items[0]?.title).toBe('E1 - Early');
		expect(items[1]?.title).toBe('S2 E3 - Later');
	});

	it('leaves title unchanged when item has no tokens', () => {
		const internals = makeQueueInternals({
			registry: SE_REGISTRY,
			translator: makeTranslator(),
		});
		queueMethods.queue.call(internals, [{ id: 1, title: 'A Plain Movie Title' }]);

		const items2 = queueMethods.queue.call(internals) as ReadonlyArray<BasePlaylistItem>;
		expect(items2[0]?.title).toBe('A Plain Movie Title');
	});

	it('leaves title unchanged when registry is empty (music-style player)', () => {
		const internals = makeQueueInternals({
			registry: {},
			translator: makeTranslator(),
		});
		queueMethods.queue.call(internals, [{ id: 1, title: '%S1 %E1 - Phantom Token' }]);

		const items3 = queueMethods.queue.call(internals) as ReadonlyArray<BasePlaylistItem>;
		expect(items3[0]?.title).toBe('%S1 %E1 - Phantom Token');
	});

	it('leaves title unchanged when translator is absent', () => {
		const internals = makeQueueInternals({
			registry: SE_REGISTRY,
			translator: undefined,
		});
		queueMethods.queue.call(internals, [{ id: 1, title: '%S1 %E1 - No Translator' }]);

		const items4 = queueMethods.queue.call(internals) as ReadonlyArray<BasePlaylistItem>;
		expect(items4[0]?.title).toBe('%S1 %E1 - No Translator');
	});

	it('is idempotent: re-ingesting a resolved item does not double-resolve', () => {
		const internals = makeQueueInternals({
			registry: SE_REGISTRY,
			translator: makeTranslator(),
		});
		queueMethods.queue.call(internals, [{ id: 1, title: '%S1 %E1 - Pilot' }]);
		const resolved = queueMethods.queue.call(internals) as ReadonlyArray<BasePlaylistItem>;
		const first = resolved[0];
		if (!first)
			throw new Error('expected item');

		queueMethods.queue.call(internals, [{ id: first.id, title: first.title }]);
		const items5 = queueMethods.queue.call(internals) as ReadonlyArray<BasePlaylistItem>;
		expect(items5[0]?.title).toBe('S1 E1 - Pilot');
	});
});

// ── C: registerTitleTokens merges into the registry ───────────────────────────

describe('registerTitleTokens()', () => {
	it('merges tokens into the existing registry', () => {
		const internals = makeQueueInternals({ registry: {} });
		queueMethods.registerTitleTokens.call(internals, {
			S: 'plugin.desktop-ui.token.season',
			E: 'plugin.desktop-ui.token.episode',
		});
		expect((internals as unknown as { _titleTokenRegistry: TokenRegistry })._titleTokenRegistry).toEqual({
			S: 'plugin.desktop-ui.token.season',
			E: 'plugin.desktop-ui.token.episode',
		});
	});

	it('does not clear prior registrations on a second call', () => {
		const internals = makeQueueInternals({ registry: { S: 'plugin.desktop-ui.token.season' } });
		queueMethods.registerTitleTokens.call(internals, { E: 'plugin.desktop-ui.token.episode' });
		const reg = (internals as unknown as { _titleTokenRegistry: TokenRegistry })._titleTokenRegistry;
		expect(reg).toHaveProperty('S');
		expect(reg).toHaveProperty('E');
	});
});
