// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { StubPlayer } from '../testing';

describe('StubPlayer.reset activity tracking', () => {
	it('restores activityTracking to its constructed value', () => {
		const player = new StubPlayer();
		player.activityTracking(false);
		player.reset();
		expect(player.activityTracking()).toBe(true);
	});
});
