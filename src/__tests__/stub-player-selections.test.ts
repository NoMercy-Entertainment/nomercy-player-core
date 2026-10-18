// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { StubPlayer } from '../testing';

describe('StubPlayer track selection getters', () => {
	it('quality() reflects the last selection and returns to auto', () => {
		const player = new StubPlayer();
		player.quality(2);
		expect(player.quality()).not.toBe('auto');
		expect((player.quality() as { index: number }).index).toBe(2);
		player.quality('auto');
		expect(player.quality()).toBe('auto');
	});

	it('subtitle() reflects the last selection and null clears it', async () => {
		const player = new StubPlayer();
		await player.subtitle(1);
		expect(player.subtitle()?.index).toBe(1);
		await player.subtitle(null);
		expect(player.subtitle()).toBeNull();
	});

	it('audioTrack() reflects the last selection', async () => {
		const player = new StubPlayer();
		await player.audioTrack(1);
		expect(player.audioTrack()?.index).toBe(1);
	});

	it('reset() clears the selections', async () => {
		const player = new StubPlayer();
		player.quality(2);
		await player.subtitle(1);
		await player.audioTrack(1);
		player.reset();
		expect(player.quality()).toBe('auto');
		expect(player.subtitle()).toBeNull();
		expect(player.audioTrack()).toBeNull();
	});
});
