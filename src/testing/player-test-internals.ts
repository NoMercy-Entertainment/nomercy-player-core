// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CueParserRegistry } from '../adapters/cue-parser/registry';
import type { PlayerPhase } from '../types';

/**
 * Typed access to player internals used exclusively in kit unit tests.
 *
 * Public methods and events must be accessed via the real typed player surface
 * (`queue()`, `emit('play', ...)`, etc.) — no cast needed for those. This
 * interface covers only the handful of genuine internal fields and dispatch-
 * stack helpers that tests probe directly.
 *
 * Cast via `as unknown as PlayerTestInternals` — never `as any`. If an
 * internal is renamed in production code, TypeScript will flag this interface
 * and every test site that references it.
 */
export interface PlayerTestInternals {
	/** Current lifecycle phase. Read by tests that need to assert or force a phase. */
	_phase: PlayerPhase;

	/** Registered cue parser registry. Tests introspect parser resolution. */
	_cueParsers: CueParserRegistry;

	/** Push a dispatching event name onto the stack (simulates a before* dispatch in flight). */
	pushDispatch(name: string): void;

	/** Pop the innermost dispatching event name. */
	popDispatch(): string | undefined;
}
