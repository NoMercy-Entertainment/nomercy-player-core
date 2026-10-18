// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------
/**
 * Type-level proof that `listen()` infers the handler's event from the target
 * and the event name, on both the plugin helper and the lifecycle registry.
 * Checked by `tsc --noEmit`.
 */

import type { ILifecycleRegistry } from '../adapters/lifecycle-registry/ILifecycleRegistry';
import type { BaseEventMap, IPlayer } from '../types';
import { Plugin } from '../core/plugin';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
declare function assertType<_T extends true>(): void;

class ListenFixture extends Plugin<IPlayer<BaseEventMap>, Record<string, never>, Record<string, never>> {
	static override readonly id = 'listen-fixture';
	static override readonly description = 'listen typing fixture';

	check(video: HTMLVideoElement, button: HTMLButtonElement, svg: SVGSVGElement, plain: EventTarget): void {
		this.listen(window, 'keydown', (event) => {
			assertType<Equal<typeof event, KeyboardEvent>>(); void event;
			void event.key;
		});
		this.listen(document, 'visibilitychange', () => document.visibilityState);
		this.listen(video, 'timeupdate', (event) => {
			assertType<Equal<typeof event, Event>>(); void event;
		});
		this.listen(video, 'volumechange', event => event.target);
		this.listen(button, 'wheel', (event) => {
			assertType<Equal<typeof event, WheelEvent>>(); void event;
			void event.deltaY;
		});
		this.listen(svg, 'pointerdown', (event) => {
			assertType<Equal<typeof event, PointerEvent>>(); void event;
		});
		this.listen(button, 'click', (event) => {
			assertType<Equal<typeof event, PointerEvent>>(); void event;
		}, { passive: true });
		// A bare string on a plain EventTarget keeps working, typed as Event.
		this.listen(plain, 'anything', (event) => {
			assertType<Equal<typeof event, Event>>(); void event;
		});
		this.listen(window, 'custom-event', (event) => {
			assertType<Equal<typeof event, Event>>(); void event;
		});
		// @ts-expect-error 'ABSENT' is not on KeyboardEvent
		this.listen(window, 'keydown', event => event.ABSENT);
	}
}

declare const registry: ILifecycleRegistry;
registry.listen(window, 'keydown', (event) => {
	assertType<Equal<typeof event, KeyboardEvent>>(); void event;
});
registry.listen(document.body, 'click', (event) => {
	assertType<Equal<typeof event, PointerEvent>>(); void event;
}, true);
registry.listen(new EventTarget(), 'x', (event) => {
	assertType<Equal<typeof event, Event>>(); void event;
});

void ListenFixture;
