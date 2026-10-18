// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { StubPlayer } from '../testing';

describe('StubPlayer.auth', () => {
	it('auth(null) clears the config and emits auth:refreshed once', () => {
		const player = new StubPlayer();
		const seen: unknown[] = [];
		player.on('auth:refreshed', payload => seen.push(payload));
		player.auth({ bearerToken: 'x' });
		seen.length = 0;
		player.auth(null);
		expect(player._rawAuth()).toBeUndefined();
		expect(seen).toHaveLength(1);
	});

	it('emits auth:refreshed on a config write', () => {
		const player = new StubPlayer();
		let count = 0;
		player.on('auth:refreshed', () => count++);
		player.auth({ bearerToken: 'x' });
		expect(count).toBe(1);
	});
});
