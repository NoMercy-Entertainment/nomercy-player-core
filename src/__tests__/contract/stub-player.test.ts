// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { runIPlayerContract, StubPlayer } from '../../testing';

/**
 * Validates that `StubPlayer` satisfies the `IPlayer` contract — same suite the
 * real `NMMusicPlayer` and `NMVideoPlayer` run against themselves. If StubPlayer
 * drifts from the contract, this test surfaces it before any plugin tests do.
 */
runIPlayerContract({
	create: () => new StubPlayer(),
	label: 'StubPlayer',
});
