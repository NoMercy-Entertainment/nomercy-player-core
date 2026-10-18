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
	listen<K extends keyof WindowEventMap>(target: Window, event: K, handler: (event: WindowEventMap[K]) => void, options?: AddEventListenerOptions | boolean): void;
	listen<K extends keyof DocumentEventMap>(target: Document, event: K, handler: (event: DocumentEventMap[K]) => void, options?: AddEventListenerOptions | boolean): void;
	listen<K extends keyof HTMLMediaElementEventMap>(target: HTMLMediaElement, event: K, handler: (event: HTMLMediaElementEventMap[K]) => void, options?: AddEventListenerOptions | boolean): void;
	listen<K extends keyof HTMLElementEventMap>(target: HTMLElement, event: K, handler: (event: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions | boolean): void;
	listen<K extends keyof SVGElementEventMap>(target: SVGElement, event: K, handler: (event: SVGElementEventMap[K]) => void, options?: AddEventListenerOptions | boolean): void;
	listen(target: EventTarget, event: string, handler: (event: Event) => void, options?: AddEventListenerOptions | boolean): void;
	timeout(fn: () => void, ms: number): number;
	interval(fn: () => void, ms: number): number;
	observe<O extends { disconnect(): void }>(observer: O): O;
	abortable(): AbortController;
	frame(fn: (deltaMs: number, time: number) => void): () => void;
	dispose(): void;
	isDisposed(): boolean;
}
