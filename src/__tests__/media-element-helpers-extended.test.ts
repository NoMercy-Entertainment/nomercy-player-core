// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * media-element helpers — the surface `media-element-helpers.test.ts` does not
 * cover (that file owns isHls / supportsNativeHls / attachHlsOrFallback /
 * destroyHlsInstance basics).
 *
 * Test groups:
 *  - attachHlsOrFallback — native fallback without an auth token
 *  - destroyHlsInstance — repeat-call safety
 *  - createAuthorizationXhrSetup — conditional Authorization stamping
 *  - attachDomBridgesTo — handler bookkeeping + emit forwarding (direct form)
 *  - resetMediaElement — pause / src removal / load, defensive on throw
 *  - resolveOrCreateMediaElement — reuse vs create vs adopt ownership matrix
 *  - createSecondaryAudioElement — hidden secondary audio construction
 *  - primeSecondaryElement — readyState gate + optional seek
 *  - waitForMediaElementMetadata — immediate / resolve / reject paths
 *  - capability helpers — captureStream / sinkId / mediaKeys guarded forms
 */

import type { BackendState } from '../adapters/media-element/backend-state';
import { describe, expect, it, vi } from 'vitest';
import { BACKEND_STATE } from '../adapters/media-element/backend-state';
import {
	attachDomBridgesTo,
	attachHlsOrFallback,
	captureStreamFromElement,
	createAuthorizationXhrSetup,
	createSecondaryAudioElement,
	destroyHlsInstance,
	getMediaKeysFromElement,
	getSinkIdFromElement,
	primeSecondaryElement,
	resetMediaElement,
	resolveOrCreateMediaElement,
	setMediaKeysOnElement,
	setSinkIdOnElement,
	waitForMediaElementMetadata,
} from '../adapters/media-element/helpers';
import { BrowserPolicyError } from '../errors';

describe('attachHlsOrFallback — fallback without auth token', () => {
	it('sets el.src to the bare url when no auth param is supplied', () => {
		class UnsupportedHls {
			static isSupported(): boolean {
				return false;
			}
		}
		const el = document.createElement('audio');
		el.load = vi.fn();

		const handle = attachHlsOrFallback(UnsupportedHls, el, 'https://x/live.m3u8', undefined, {});

		expect(handle).toBeUndefined();
		expect(el.src).toBe('https://x/live.m3u8');
	});
});

describe('destroyHlsInstance — repeat-call safety', () => {
	it('can be called twice on the same handle without throwing', () => {
		const handle = {
			detachMedia: vi.fn(),
			destroy: vi.fn(),
			stopLoad: vi.fn(),
			startLoad: vi.fn(),
		};

		destroyHlsInstance(handle);
		expect(() => destroyHlsInstance(handle)).not.toThrow();
		expect(handle.destroy).toHaveBeenCalledTimes(2);
	});

	it('works on a handle without detachMedia', () => {
		const handle = {
			destroy: vi.fn(),
			stopLoad: vi.fn(),
			startLoad: vi.fn(),
		};

		expect(() => destroyHlsInstance(handle)).not.toThrow();
		expect(handle.destroy).toHaveBeenCalledTimes(1);
	});
});

describe('createAuthorizationXhrSetup()', () => {
	it('stamps the Authorization header when a value is present', () => {
		const setup = createAuthorizationXhrSetup('Bearer tok-1');
		const xhr = { setRequestHeader: vi.fn() } as unknown as XMLHttpRequest;

		setup(xhr);

		expect(xhr.setRequestHeader).toHaveBeenCalledTimes(1);
		expect(xhr.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer tok-1');
	});

	it('does not touch the request when the value is undefined', () => {
		const setup = createAuthorizationXhrSetup(undefined);
		const xhr = { setRequestHeader: vi.fn() } as unknown as XMLHttpRequest;

		setup(xhr);

		expect(xhr.setRequestHeader).not.toHaveBeenCalled();
	});

	it('does not stamp for an empty string value', () => {
		const setup = createAuthorizationXhrSetup('');
		const xhr = { setRequestHeader: vi.fn() } as unknown as XMLHttpRequest;

		setup(xhr);

		expect(xhr.setRequestHeader).not.toHaveBeenCalled();
	});
});

describe('attachDomBridgesTo()', () => {
	function wire(): {
		el: HTMLMediaElement;
		emitted: Array<{ event: string; data: unknown }>;
		states: BackendState[];
		state: () => BackendState;
	} {
		const el = document.createElement('audio');
		const emitted: Array<{ event: string; data: unknown }> = [];
		const states: BackendState[] = [];
		let currentState: BackendState = BACKEND_STATE.IDLE;

		attachDomBridgesTo(
			el,
			(event, data) => emitted.push({
				event,
				data,
			}),
			(state) => {
				currentState = state;
				states.push(state);
			},
			() => currentState,
		);

		return {
			el,
			emitted,
			states,
			state: () => currentState,
		};
	}

	it('returns one tracked handler per registration (13 emits + 6 state handlers)', () => {
		const el = document.createElement('audio');
		const handlers = attachDomBridgesTo(el, () => {}, () => {}, () => BACKEND_STATE.IDLE);
		expect(handlers).toHaveLength(19);
		for (const entry of handlers) {
			expect(typeof entry.event).toBe('string');
			expect(typeof entry.handler).toBe('function');
		}
	});

	it('forwards each standard DOM event with its Event object as data', () => {
		const { el, emitted } = wire();
		const domEvents = [
			'loadstart',
			'loadedmetadata',
			'canplay',
			'play',
			'playing',
			'pause',
			'ended',
			'timeupdate',
			'waiting',
			'stalled',
			'ratechange',
			'encrypted',
			'error',
		];

		for (const name of domEvents) {
			el.dispatchEvent(new Event(name));
		}

		expect(emitted.map(entry => entry.event)).toEqual(domEvents);
		for (const entry of emitted) {
			expect(entry.data).toBeInstanceOf(Event);
		}
	});

	it('drives the loading → ready → playing → paused state sequence', () => {
		const { el, states } = wire();

		el.dispatchEvent(new Event('loadstart'));
		el.dispatchEvent(new Event('loadedmetadata'));
		el.dispatchEvent(new Event('play'));
		el.dispatchEvent(new Event('pause'));

		expect(states).toEqual([
			BACKEND_STATE.LOADING,
			BACKEND_STATE.READY,
			BACKEND_STATE.PLAYING,
			BACKEND_STATE.PAUSED,
		]);
	});

	it('the pause guard leaves idle and error states untouched', () => {
		const idleWire = wire();
		idleWire.el.dispatchEvent(new Event('pause'));
		expect(idleWire.states).toEqual([]);

		const errorWire = wire();
		errorWire.el.dispatchEvent(new Event('error'));
		errorWire.el.dispatchEvent(new Event('pause'));
		expect(errorWire.state()).toBe(BACKEND_STATE.ERROR);
	});

	it('maps ended to paused', () => {
		const { el, state } = wire();
		el.dispatchEvent(new Event('play'));
		el.dispatchEvent(new Event('ended'));
		expect(state()).toBe(BACKEND_STATE.PAUSED);
	});
});

describe('resetMediaElement()', () => {
	it('pauses, removes the src attribute, and reloads the pipeline', () => {
		const el = document.createElement('audio');
		el.setAttribute('src', 'https://x/track.mp3');
		const pauseSpy = vi.spyOn(el, 'pause');
		const loadSpy = vi.spyOn(el, 'load');

		resetMediaElement(el);

		expect(pauseSpy).toHaveBeenCalledTimes(1);
		expect(el.hasAttribute('src')).toBe(false);
		expect(loadSpy).toHaveBeenCalledTimes(1);
	});

	it('continues past a throwing pause()', () => {
		const el = document.createElement('audio');
		el.setAttribute('src', 'https://x/track.mp3');
		el.pause = (): void => {
			throw new Error('pause boom');
		};
		const loadSpy = vi.spyOn(el, 'load');

		expect(() => resetMediaElement(el)).not.toThrow();
		expect(el.hasAttribute('src')).toBe(false);
		expect(loadSpy).toHaveBeenCalledTimes(1);
	});

	it('swallows a throwing load()', () => {
		const el = document.createElement('audio');
		el.load = (): void => {
			throw new Error('load boom');
		};

		expect(() => resetMediaElement(el)).not.toThrow();
	});
});

describe('resolveOrCreateMediaElement()', () => {
	it('prefers a pre-existing element from opts and never claims ownership', () => {
		const container = document.createElement('div');
		const provided = document.createElement('audio');

		const result = resolveOrCreateMediaElement(container, 'audio', { element: provided });

		expect(result.element).toBe(provided);
		expect(result.ownsElement).toBe(false);
		expect(container.contains(provided)).toBe(false);
	});

	it('adopts an existing child of the container without ownership', () => {
		const container = document.createElement('div');
		const existing = document.createElement('video');
		container.appendChild(existing);

		const result = resolveOrCreateMediaElement<HTMLVideoElement>(container, 'video');

		expect(result.element).toBe(existing);
		expect(result.ownsElement).toBe(false);
	});

	it('creates and appends a new element when the container has none, claiming ownership', () => {
		const container = document.createElement('div');

		const result = resolveOrCreateMediaElement<HTMLAudioElement>(container, 'audio');

		expect(result.element.tagName).toBe('AUDIO');
		expect(result.ownsElement).toBe(true);
		expect(container.contains(result.element)).toBe(true);
	});

	it('creates a detached element when no container is given', () => {
		const result = resolveOrCreateMediaElement<HTMLVideoElement>(undefined, 'video');

		expect(result.element.tagName).toBe('VIDEO');
		expect(result.ownsElement).toBe(true);
		expect(result.element.parentElement).toBeNull();
	});
});

describe('createSecondaryAudioElement()', () => {
	it('creates a hidden auto-preload audio element appended to the container', () => {
		const container = document.createElement('div');

		const el = createSecondaryAudioElement(container, null);

		expect(el.tagName).toBe('AUDIO');
		expect(el.preload).toBe('auto');
		expect(el.style.display).toBe('none');
		expect(container.contains(el)).toBe(true);
	});

	it('propagates crossOrigin anonymous from the primary element', () => {
		const el = createSecondaryAudioElement(undefined, 'anonymous');
		expect(el.crossOrigin).toBe('anonymous');
	});

	it('leaves crossOrigin unset when the primary has none', () => {
		const el = createSecondaryAudioElement(undefined, null);
		expect(el.crossOrigin).toBeNull();
	});

	it('stays detached when no container is given', () => {
		const el = createSecondaryAudioElement(undefined, null);
		expect(el.parentElement).toBeNull();
	});
});

describe('primeSecondaryElement()', () => {
	function readyElement(readyState: number): HTMLAudioElement {
		const el = document.createElement('audio');
		Object.defineProperty(el, 'readyState', {
			configurable: true,
			get: () => readyState,
		});
		return el;
	}

	it('resolves immediately when the element is already ready to play', async () => {
		const el = readyElement(3);
		await expect(primeSecondaryElement(el)).resolves.toBeUndefined();
	});

	it('waits for canplay when the element is not ready yet', async () => {
		const el = document.createElement('audio');
		let settled = false;
		const pending = primeSecondaryElement(el).then(() => {
			settled = true;
		});

		await Promise.resolve();
		expect(settled).toBe(false);

		el.dispatchEvent(new Event('canplay'));
		await pending;
		expect(settled).toBe(true);
	});

	it('seeks to seekMs (milliseconds → seconds) after readiness', async () => {
		const el = readyElement(4);
		await primeSecondaryElement(el, 4500);
		expect(el.currentTime).toBe(4.5);
	});

	it('does not seek for a zero or missing seekMs', async () => {
		const withZero = readyElement(4);
		await primeSecondaryElement(withZero, 0);
		expect(withZero.currentTime).toBe(0);

		const withoutSeek = readyElement(4);
		await primeSecondaryElement(withoutSeek);
		expect(withoutSeek.currentTime).toBe(0);
	});
});

describe('waitForMediaElementMetadata()', () => {
	it('resolves immediately when metadata is already available', async () => {
		const el = document.createElement('audio');
		Object.defineProperty(el, 'readyState', {
			configurable: true,
			get: () => 1,
		});
		await expect(waitForMediaElementMetadata(el)).resolves.toBeUndefined();
	});

	it('resolves when loadedmetadata fires', async () => {
		const el = document.createElement('audio');
		const pending = waitForMediaElementMetadata(el);
		el.dispatchEvent(new Event('loadedmetadata'));
		await expect(pending).resolves.toBeUndefined();
	});

	it('rejects with a fallback Error when the element errors without an error object', async () => {
		const el = document.createElement('audio');
		const pending = waitForMediaElementMetadata(el);
		el.dispatchEvent(new Event('error'));
		await expect(pending).rejects.toThrow('media element error');
	});

	it('rejects with el.error when the element carries one', async () => {
		const el = document.createElement('audio');
		const mediaError = {
			code: 4,
			message: 'MEDIA_ELEMENT_ERROR',
		};
		Object.defineProperty(el, 'error', {
			configurable: true,
			get: () => mediaError,
		});
		const pending = waitForMediaElementMetadata(el);
		el.dispatchEvent(new Event('error'));
		await expect(pending).rejects.toBe(mediaError);
	});
});

describe('capability helpers — guarded forms', () => {
	it('captureStreamFromElement returns the element stream when supported', () => {
		const el = document.createElement('video');
		const stream = captureStreamFromElement(el, 'video');
		expect(stream).toBeInstanceOf(MediaStream);
	});

	it('captureStreamFromElement throws BrowserPolicyError scoped to the backend when unsupported', () => {
		const el = document.createElement('video');
		(el as HTMLMediaElement & { captureStream?: unknown }).captureStream = undefined;

		let caught: unknown;
		try {
			captureStreamFromElement(el, 'webaudio');
		}
		catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(BrowserPolicyError);
		expect((caught as BrowserPolicyError).code).toBe('core:policy/captureStreamUnsupported');
		expect((caught as BrowserPolicyError).scope).toEqual({
			kind: 'backend',
			id: 'webaudio',
		});
	});

	it('setSinkIdOnElement + getSinkIdFromElement round-trip', async () => {
		const el = document.createElement('audio');
		expect(getSinkIdFromElement(el)).toBe('');
		await setSinkIdOnElement(el, 'output-7', 'audio-element');
		expect(getSinkIdFromElement(el)).toBe('output-7');
	});

	it('setSinkIdOnElement rejects with BrowserPolicyError when the API is absent', async () => {
		const el = document.createElement('audio');
		(el as unknown as { setSinkId?: unknown }).setSinkId = undefined;
		await expect(setSinkIdOnElement(el, 'output-7', 'audio-element')).rejects.toMatchObject({
			code: 'core:policy/setSinkIdUnsupported',
			scope: {
				kind: 'backend',
				id: 'audio-element',
			},
		});
	});

	it('getSinkIdFromElement falls back to the empty string when sinkId is missing entirely', () => {
		const bare = {} as HTMLMediaElement;
		expect(getSinkIdFromElement(bare)).toBe('');
	});

	it('getMediaKeysFromElement normalises null to undefined and returns set keys', async () => {
		const el = document.createElement('video');
		expect(getMediaKeysFromElement(el)).toBeUndefined();

		const keys = { fake: 'keys' } as unknown as MediaKeys;
		await setMediaKeysOnElement(el, keys, 'video');
		expect(getMediaKeysFromElement(el)).toBe(keys);
	});

	it('setMediaKeysOnElement rejects with BrowserPolicyError when EME is absent', async () => {
		const el = document.createElement('video');
		(el as unknown as { setMediaKeys?: unknown }).setMediaKeys = undefined;
		await expect(setMediaKeysOnElement(el, {} as unknown as MediaKeys, 'video')).rejects.toMatchObject({
			code: 'core:policy/emeUnsupported',
			scope: {
				kind: 'backend',
				id: 'video',
			},
		});
	});
});
