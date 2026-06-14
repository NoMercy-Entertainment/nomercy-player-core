// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Type-level proof of cross-plugin event inference.
 *
 * Pure tsc type-check file. No runtime assertions.
 * Run: cd packages/nomercy-player-kit && node_modules/.bin/tsc --noEmit
 *
 * HOW TO READ THIS FILE:
 *  - Lines with `@ts-expect-error` are intentional: the type system correctly
 *    rejects the expression. If the error stops firing, the guard is broken.
 *  - `satisfies` assertions prove the resolved type matches the expected shape.
 *
 * Current status: FIXED — `PluginEventMap<C>` uses the `__events__` accessor
 * pattern (same pivot as `PlayerEventMap` / `__eventMap__`) so TS resolves the
 * concrete subclass `E` rather than widening to the default.
 */

import type { PluginEventMap } from '../core/plugin';
import type { CanvasPlugin } from '../plugins/canvas';
import type { BaseEventMap, IPlayer } from '../types';
import { Plugin } from '../core/plugin';

// ─── Fixture plugin with a known event map ────────────────────────────────────

interface FooEvents {
	resize: { width: number; height: number };
	tick: { count: number };
}

class FooPlugin extends Plugin<IPlayer<BaseEventMap>, Record<string, never>, FooEvents> {
	static override readonly id = 'foo';
	static override readonly description = 'type-test foo plugin';
}

// ─── Proof 1: PluginEventMap resolves to the concrete event map ───────────────

type FooMap = PluginEventMap<typeof FooPlugin>;
type CanvasMap = PluginEventMap<typeof CanvasPlugin>;

type FooMapKey = keyof FooMap;
type CanvasMapKey = keyof CanvasMap;

// FooMapKey is now 'resize' | 'tick', not `string`.
// 'anything_at_all' is NOT a member — this assignment correctly resolves to 'EXPECTED'.
const _fooKeyProof: 'anything_at_all' extends FooMapKey ? never : 'EXPECTED' = 'EXPECTED';

// CanvasMapKey is now 'mounted' | 'resized' | 'frame', not `string`.
const _canvasKeyProof: 'anything_at_all' extends CanvasMapKey ? never : 'EXPECTED' = 'EXPECTED';

// ─── Proof 2: misspelled event key is rejected ───────────────────────────────

class ConsumerPlugin extends Plugin<IPlayer<BaseEventMap>> {
	static override readonly id = 'consumer';
	static override readonly description = 'type-test consumer plugin';

	probe(): void {
		// 'rezize' is misspelled — TS correctly rejects it now that FooMapKey is
		// the narrow union 'resize' | 'tick' rather than the widened `string`.
		// @ts-expect-error — 'rezize' is not a key of FooEvents
		this.on(FooPlugin, 'rezize', (_data: unknown) => {});
	}

	probePayload(): void {
		// Proof 3: payload is { width: number; height: number }, not `any`.
		// Accessing a non-existent property is a type error.
		this.on(FooPlugin, 'resize', (data) => {
			// @ts-expect-error — 'TOTALLY_ABSENT' does not exist on { width: number; height: number }
			void data.TOTALLY_ABSENT;
		});
	}
}

// ─── Proof 3: payload type is correctly narrowed ─────────────────────────────

// `satisfies` asserts the type WITHOUT widening it — if the resolved type is
// `any`, `satisfies FooEvents['resize']` still passes (any is assignable to
// everything). So we use a structural test that only passes for the exact shape.
type _ResizePayload = FooMap['resize'];

// This declaration would cause a type error if _ResizePayload were `any` — but
// `any satisfies { width: number }` passes. Instead, prove the opposite: an
// incorrect shape is NOT assignable to it.
declare const _badPayload: { notWidth: string };
// @ts-expect-error — { notWidth: string } is not assignable to { width: number; height: number }
const _payloadProof: _ResizePayload = _badPayload;

// ─── Cross-package proof: CanvasPlugin event map resolves correctly ───────────

// CanvasEvents has { mounted, resized, frame } — none of those are 'WRONG'.
const _crossPackageProof: 'WRONG' extends CanvasMapKey ? never : 'EXPECTED' = 'EXPECTED';

// And the correct key IS present — this resolves to { width: number; height: number }.
type _CanvasMounted = CanvasMap['mounted'];
declare const _badCanvasPayload: { notWidth: string };
// @ts-expect-error — { notWidth: string } is not assignable to { width: number; height: number }
const _canvasPayloadProof: _CanvasMounted = _badCanvasPayload;

// ─── Silence unused-variable noise ───────────────────────────────────────────

void (ConsumerPlugin as unknown);
void (_fooKeyProof as unknown);
void (_canvasKeyProof as unknown);
void (_crossPackageProof as unknown);
void (_payloadProof as unknown);
void (_canvasPayloadProof as unknown);
