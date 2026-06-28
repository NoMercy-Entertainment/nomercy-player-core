// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import pkg from '../../package.json';
import { KIT_VERSION } from '../core/kit-version';

// KIT_VERSION gates plugin compatibility at registration time. It was stale
// (2.0.0-beta.1 while the package was rc.5), silently rejecting current
// plugins. Phase 0 single-sourced it from package.json. This test fails if it
// ever drifts back out of sync.
describe('KIT_VERSION stays in sync with package.json', () => {
	it('equals the package version exactly', () => {
		expect(KIT_VERSION).toBe(pkg.version);
	});

	it('is not the stale beta value that B4 fixed', () => {
		expect(KIT_VERSION).not.toBe('2.0.0-beta.1');
	});
});
