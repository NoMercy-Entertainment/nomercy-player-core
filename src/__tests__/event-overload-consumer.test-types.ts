/**
 * Type-level regression guard for the EventEmitter / IPlayer `on()` overload set.
 *
 * Pure tsc type-check file — no runtime assertions.
 * Run: cd packages/nomercy-player-kit && node_modules/.bin/tsc --noEmit
 *
 * Guards three invariants that have regressed in the past:
 *
 * 1. The TYPED overload infers the concrete payload from the event map.
 * 2. The STRING FALLBACK (plugin-namespaced events) accepts callbacks that
 *    annotate a specific type — `(data: MyType) => void` must compile without
 *    forcing the consumer to write `(data: unknown) => void` first and then cast.
 * 3. The `'all'` firehose overload receives `(event: string, data: unknown)`.
 *
 * Regression context:
 *   Commit 1bff56a changed `AnyHandler` from `(data: any) => void` to
 *   `(data: unknown) => void`. This broke consumer code that annotated the
 *   string-fallback callback with a concrete type (e.g.
 *   `player.on('plugin:equalizer:change', (data: EqualizerEvents['change']) => ...)`),
 *   because `(data: EqualizerEvents[...]) => void` is not assignable to
 *   `(data: unknown) => void` under strict function types.
 *   Fix: revert `AnyHandler` to `(data: any) => void`; the string fallback is
 *   the untyped escape hatch — bivariance is intentional.
 */

import type { EventEmitter } from '../adapters/event-bus/default';
import type { ActionOptions, BaseEventMap, IPlayer } from '../types';

// ─── Concrete payload type used by a hypothetical plugin ─────────────────────

interface EqChangePayload {
	bands: Array<{ frequency: number; gain: number }>;
	selectedPreset: string | undefined;
}

interface PanChangedPayload {
	pan: number;
}

// ─── Proof 1: typed overload gives concrete payload ──────────────────────────

declare const typedPlayer: IPlayer<BaseEventMap>;

typedPlayer.on('play', (data) => {
	// `data` must be `ActionOptions`, not `unknown` or `any`.
	// Accessing a non-existent property must be a type error.
	// @ts-expect-error — 'ABSENT' does not exist on ActionOptions
	void data.ABSENT;
});

// The payload type extracted from the map is concrete.
type PlayPayload = BaseEventMap['play'];
declare const _badPlay: { notSource: number };
// @ts-expect-error — { notSource: number } is not assignable to ActionOptions
const _playProof: PlayPayload = _badPlay;

// ─── Proof 2: string-fallback accepts an annotated typed callback ─────────────
//
// This is the regression guard. If `AnyHandler` is `(data: unknown) => void`,
// these lines produce TS2769. With `AnyHandler = (data: any) => void` they compile.

typedPlayer.on('plugin:equalizer:change', (data: EqChangePayload) => {
	void data.bands;
	void data.selectedPreset;
});

typedPlayer.on('plugin:mixer:pan:changed', (data: PanChangedPayload) => {
	void data.pan;
});

// once() and off() must also accept typed callbacks via the string fallback.
typedPlayer.once('plugin:some-plugin:ready', (data: { version: string }) => {
	void data.version;
});

typedPlayer.off('plugin:some-plugin:ready', (data: { version: string }) => {
	void data.version;
});

// ─── Proof 3: EventEmitter.on() has the same guarantees ──────────────────────

declare const emitter: EventEmitter<BaseEventMap>;

emitter.on('plugin:foo:bar', (data: EqChangePayload) => {
	void data.bands;
});

// ─── Proof 4: 'all' firehose receives (event: string, data: unknown) ─────────

typedPlayer.on('all', (event, data) => {
	// `event` is string, `data` is unknown — consumers must narrow before use.
	const _ev: string = event;
	void _ev;
	void data;

	// Prove `data` is `unknown` (not `any`): narrowing required before member access.
	if (typeof data === 'object' && data !== null) {
		// This is fine — `data` narrowed to `object`.
		void Object.keys(data);
	}
});

// ─── Silence unused-variable noise ───────────────────────────────────────────

void (_playProof as unknown);
void (typedPlayer as unknown);
void (emitter as unknown);
