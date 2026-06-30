// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Disposable registry contract — every plugin gets one of these. Records every
 * listener / timer / observer / abort controller / RAF that the plugin
 * registers, so a single `dispose()` call tears them all down.
 */
export interface ILifecycleRegistry {
	addCleanup(fn: () => void): void;
	listen(target: EventTarget, event: string, handler: EventListener, options?: AddEventListenerOptions | boolean): void;
	timeout(fn: () => void, ms: number): number;
	interval(fn: () => void, ms: number): number;
	observe<O extends { disconnect(): void }>(observer: O): O;
	abortable(): AbortController;
	frame(fn: (deltaMs: number, time: number) => void): void;
	dispose(): void;
	isDisposed(): boolean;
}
