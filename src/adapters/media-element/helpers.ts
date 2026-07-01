// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { ErrorScope } from '../../errors/code';
import type { BackendState } from './backend-state';

import { appendAuthTokenParam } from '../../core/append-auth-token-param';
import { BrowserPolicyError } from '../../errors';
import { HLS_EXT_RE } from '../stream/hls';
import { BACKEND_STATE } from './backend-state';

export type BackendId = Extract<ErrorScope, { kind: 'backend' }>['id'];

// ─── HLS detection helpers ───────────────────────────────────────────────────

/**
 * Returns true when `url` looks like an HLS manifest by extension.
 *
 * Centralises the `HLS_EXT_RE` predicate so every backend uses one source
 * of truth instead of duplicating the regex test inline.
 */
export function isHls(url: string): boolean {
	return HLS_EXT_RE.test(url);
}

/**
 * Returns true when `el` can play HLS natively without hls.js.
 *
 * Chromium answers `'maybe'` for HLS but cannot actually demux it — trust
 * `'maybe'` only where MSE is absent (iOS Safari), because hls.js cannot
 * run there anyway and native is the only option.
 */
export function supportsNativeHls(el: HTMLMediaElement): boolean {
	const can = el.canPlayType('application/vnd.apple.mpegurl');
	return (
		can === 'probably'
		|| (can === 'maybe' && typeof MediaSource === 'undefined')
	);
}

// ─── HLS handle / config types ───────────────────────────────────────────────

/** Minimal handle shape returned by `attachHlsOrFallback`. */
export interface HlsHandle {
	destroy: () => void;
	stopLoad: () => void;
	startLoad: (startPosition?: number) => void;
}

/**
 * Per-backend hls.js constructor config subset.
 *
 * Each backend passes its own config — defaults and merging are the caller's
 * responsibility. This interface is the union of keys both backends use;
 * video-only keys (`startPosition`, `startFragPrefetch`) are not declared
 * here — the video backend passes them through the plain `Record` escape hatch.
 */
export interface HlsLoaderConfig {
	autoStartLoad?: boolean;
	enableWorker?: boolean;
	lowLatencyMode?: boolean;
	enableCEA708Captions?: boolean;
	startPosition?: number;
	startFragPrefetch?: boolean;
	xhrSetup?: (xhr: XMLHttpRequest) => void;
	[key: string]: unknown;
}

interface HlsCtor {
	new (cfg?: HlsLoaderConfig): HlsHandle & {
		loadSource: (url: string) => void;
		attachMedia: (el: HTMLMediaElement) => void;
	};
	isSupported: () => boolean;
}

/**
 * Wire hls.js onto `el` using the provided `hlsConfig`, or fall back to
 * setting `el.src` directly when hls.js is not supported.
 *
 * Returns the hls.js instance when it was created, or `undefined` when the
 * native / non-MSE fallback was applied. The caller stores the returned handle
 * to call `stopLoad` / `startLoad` / `destroy` later.
 *
 * IMPORTANT: each backend passes its own `hlsConfig` — do NOT add defaults or
 * merge config here. The config is backend-owned.
 */
export function attachHlsOrFallback(
	HlsModule: unknown,
	el: HTMLMediaElement,
	url: string,
	authParam: string | undefined,
	hlsConfig: HlsLoaderConfig,
): HlsHandle | undefined {
	const Hls = HlsModule as HlsCtor;
	if (!Hls.isSupported()) {
		el.src = appendAuthTokenParam(url, authParam);
		(el as HTMLAudioElement).load?.();
		return undefined;
	}
	const hls = new Hls(hlsConfig);
	hls.attachMedia(el);
	hls.loadSource(url);
	return hls;
}

/**
 * Detach media from `hls`, then destroy it, swallowing any errors defensively.
 * Clears the reference the caller passes by value — callers must set their own
 * field to `undefined` after this call.
 */
export function destroyHlsInstance(
	hls: HlsHandle & { detachMedia?: () => void },
): void {
	try {
		hls.detachMedia?.();
	}
	catch {
		/* defensive */
	}
	try {
		hls.destroy();
	}
	catch {
		/* defensive */
	}
}

// ─── DOM-event bridge ─────────────────────────────────────────────────────────

/** One tracked DOM-event handler. Store an array of these and remove them on dispose. */
export interface DomBridgeHandler {
	event: string;
	handler: EventListener;
}

/**
 * Attaches the standard set of DOM → backend event bridges and state-mutation
 * handlers onto `el`. Returns the handler array; the caller stores it for
 * later removal via direct `removeEventListener` loops.
 *
 * `emit` receives raw DOM events and forwards them as backend events.
 * `onStateChange` is called for every state transition; the caller writes
 * the value to its own `currentState` field. `getState` is called by the
 * pause handler to guard against resetting an already-idle or error state.
 */
export function attachDomBridgesTo(
	el: HTMLMediaElement,
	emit: (event: string, data: unknown) => void,
	onStateChange: (state: BackendState) => void,
	getState: () => BackendState,
): DomBridgeHandler[] {
	const handlers: DomBridgeHandler[] = [];

	const track = (domEvent: string, handler: EventListener): void => {
		el.addEventListener(domEvent, handler);
		handlers.push({
			event: domEvent,
			handler,
		});
	};

	track('loadstart', ev => emit('loadstart', ev));
	track('loadedmetadata', ev => emit('loadedmetadata', ev));
	track('canplay', ev => emit('canplay', ev));
	track('play', ev => emit('play', ev));
	track('playing', ev => emit('playing', ev));
	track('pause', ev => emit('pause', ev));
	track('ended', ev => emit('ended', ev));
	track('timeupdate', ev => emit('timeupdate', ev));
	track('waiting', ev => emit('waiting', ev));
	track('stalled', ev => emit('stalled', ev));
	track('ratechange', ev => emit('ratechange', ev));
	track('encrypted', ev => emit('encrypted', ev));
	track('error', ev => emit('error', ev));

	// State-mutation handlers tracked in the same array so detach/dispose
	// always removes them — no separate cleanup path.
	track('loadstart', () => {
		onStateChange(BACKEND_STATE.LOADING);
	});
	track('loadedmetadata', () => {
		onStateChange(BACKEND_STATE.READY);
	});
	track('play', () => {
		onStateChange(BACKEND_STATE.PLAYING);
	});
	track('pause', () => {
		if (getState() !== BACKEND_STATE.IDLE && getState() !== BACKEND_STATE.ERROR) {
			onStateChange(BACKEND_STATE.PAUSED);
		}
	});
	track('ended', () => {
		onStateChange(BACKEND_STATE.PAUSED);
	});
	track('error', () => {
		onStateChange(BACKEND_STATE.ERROR);
	});

	return handlers;
}

// ─── Element lifecycle helpers ────────────────────────────────────────────────

/**
 * Pause `el`, remove its `src` attribute, and call `el.load()` to reset the
 * browser's media pipeline to `HAVE_NOTHING` synchronously. Swallows errors
 * defensively on each step.
 *
 * Call this before wiring a new source to avoid leaking the previous decode
 * pipeline and to clear the browser's internal `ended` flag cleanly.
 */
export function resetMediaElement(el: HTMLMediaElement): void {
	try {
		el.pause();
	}
	catch {
		/* defensive */
	}
	try {
		el.removeAttribute('src');
	}
	catch {
		/* defensive */
	}
	try {
		el.load();
	}
	catch {
		/* defensive */
	}
}

/**
 * Find an existing `<tag>` child inside `container`, or create one and append
 * it. Returns the element and whether the backend owns it (i.e. created it).
 *
 * `opts.element` provides a pre-existing element that takes priority over the
 * container query; in that case `ownsElement` is always `false`.
 */
export function resolveOrCreateMediaElement<T extends HTMLMediaElement>(
	container: HTMLElement | undefined,
	tag: 'audio' | 'video',
	opts?: { element?: T },
): { element: T; ownsElement: boolean } {
	if (opts?.element) {
		return {
			element: opts.element,
			ownsElement: false,
		};
	}

	if (container) {
		const existing = container.querySelector<T>(tag);
		if (existing) {
			return {
				element: existing,
				ownsElement: false,
			};
		}
	}

	const created = (container?.ownerDocument ?? document).createElement(
		tag,
	) as T;
	if (container) {
		container.appendChild(created);
	}
	return {
		element: created,
		ownsElement: true,
	};
}

/**
 * Create a hidden secondary `<audio>` element and append it to `container`
 * if provided. Sets `crossOrigin` to `'anonymous'` when the primary element
 * already has it (needed for Web Audio graph taps on cross-origin streams).
 */
export function createSecondaryAudioElement(
	container: HTMLElement | undefined,
	primaryCrossOrigin: string | null,
): HTMLAudioElement {
	const el = (container?.ownerDocument ?? document).createElement('audio');
	el.preload = 'auto';
	if (primaryCrossOrigin === 'anonymous') {
		el.crossOrigin = 'anonymous';
	}
	el.style.display = 'none';
	if (container) {
		container.appendChild(el);
	}
	return el;
}

/**
 * Wait for the secondary element to reach `readyState >= 3` (HAVE_FUTURE_DATA),
 * then optionally seek to `seekMs`. Resolves immediately when the element is
 * already ready to play.
 */
export async function primeSecondaryElement(
	el: HTMLAudioElement,
	seekMs?: number,
): Promise<void> {
	await new Promise<void>((resolve) => {
		if (el.readyState >= 3) {
			resolve();
			return;
		}
		el.addEventListener('canplay', () => resolve(), { once: true });
	});

	if (seekMs != null && seekMs > 0) {
		el.currentTime = seekMs / 1000;
	}
}

// ─── Capability helpers ───────────────────────────────────────────────────────

/**
 * Call `el.captureStream()`, throwing `BrowserPolicyError` when the method is
 * unavailable. `backendId` appears in the error code so consumers can identify
 * the backend that threw.
 */
export function captureStreamFromElement(
	el: HTMLMediaElement,
	backendId: BackendId,
): MediaStream {
	const fn = (el as HTMLMediaElement & { captureStream?: () => MediaStream })
		.captureStream;
	if (typeof fn !== 'function') {
		throw new BrowserPolicyError({
			code: 'core:policy/captureStreamUnsupported',
			severity: 'error',
			scope: {
				kind: 'backend',
				id: backendId,
			},
			message: `captureStream() is not available in this environment.`,
		});
	}
	return fn.call(el);
}

/**
 * Call `el.setSinkId(deviceId)`, throwing `BrowserPolicyError` when the method
 * is unavailable.
 */
export async function setSinkIdOnElement(
	el: HTMLMediaElement,
	deviceId: string,
	backendId: BackendId,
): Promise<void> {
	const fn = (
		el as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> }
	).setSinkId;
	if (typeof fn !== 'function') {
		throw new BrowserPolicyError({
			code: 'core:policy/setSinkIdUnsupported',
			severity: 'error',
			scope: {
				kind: 'backend',
				id: backendId,
			},
			message: `setSinkId() is not available in this environment.`,
		});
	}
	await fn.call(el, deviceId);
}

/**
 * Return `el.sinkId ?? ''` safely. The spec defines `sinkId` as always a
 * string that defaults to `''` (default output device). Callers that need to
 * throw on missing sinkId must do so in their own layer.
 */
export function getSinkIdFromElement(el: HTMLMediaElement): string {
	return (el as HTMLMediaElement & { sinkId?: string }).sinkId ?? '';
}

/**
 * Return `el.mediaKeys ?? undefined` — normalises the nullable DOM property
 * to an `undefined`-returning signature matching the backend contract.
 */
export function getMediaKeysFromElement(
	el: HTMLMediaElement,
): MediaKeys | undefined {
	return el.mediaKeys ?? undefined;
}

/**
 * Call `el.setMediaKeys(keys)`, throwing `BrowserPolicyError` when the method
 * is unavailable. Applies the guarded form consistently across all backends.
 */
export async function setMediaKeysOnElement(
	el: HTMLMediaElement,
	keys: MediaKeys,
	backendId: BackendId,
): Promise<void> {
	const fn = (
		el as HTMLMediaElement & { setMediaKeys?: (k: MediaKeys) => Promise<void> }
	).setMediaKeys;
	if (typeof fn !== 'function') {
		throw new BrowserPolicyError({
			code: 'core:policy/emeUnsupported',
			severity: 'error',
			scope: {
				kind: 'backend',
				id: backendId,
			},
			message: `setMediaKeys() is not available in this environment.`,
		});
	}
	await fn.call(el, keys);
}

/**
 * Wait for `el` to reach `readyState >= 1` (HAVE_METADATA), resolving on
 * `loadedmetadata` and rejecting on `error`.
 *
 * This is the base form: no timeout, no HLS-error-event listener. Backends
 * that need a timeout or additional rejection conditions (e.g. HLS `stream:error`)
 * implement their own `waitForLoadedMetadata` that either calls this or
 * reimplements the same pattern with extras.
 */
export function waitForMediaElementMetadata(
	el: HTMLMediaElement,
): Promise<void> {
	if (el.readyState >= 1) {
		return Promise.resolve();
	}

	return new Promise<void>((resolve, reject) => {
		const onLoad = (): void => {
			el.removeEventListener('loadedmetadata', onLoad);
			el.removeEventListener('error', onError);
			resolve();
		};
		const onError = (): void => {
			el.removeEventListener('loadedmetadata', onLoad);
			el.removeEventListener('error', onError);
			reject(el.error ?? new Error('media element error'));
		};
		el.addEventListener('loadedmetadata', onLoad, { once: true });
		el.addEventListener('error', onError, { once: true });
	});
}
